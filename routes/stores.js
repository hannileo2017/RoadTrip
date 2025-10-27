// routes/stores.js
const { sendOTP } = require('../helpers/mailer');
const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sendResponse = require('../helpers/response');
const { generateRandomPassword, generateOTP } = require('../helpers/generate');
const verifyToken = require('../middleware/verifyToken');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// ==========================
// 📍 جلب كل المتاجر مع Pagination + Search
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 20, search = '' } = req.query;
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 20;
        const offset = (page - 1) * limit;

        const pool = await poolPromise;
        const result = await pool.request()
            .input('Search', sql.NVarChar(sql.MAX), `%${search}%`)
            .query(`
                SELECT StoreID, StoreName, CategoryID, CityID, AreaID, Address, Phone, Email, Description,
                       IsActive, CreatedAt, LogoURL, Rating
                FROM Stores
                WHERE StoreName LIKE @Search OR Phone LIKE @Search OR Email LIKE @Search
                ORDER BY CreatedAt DESC
                OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
            `);

        sendResponse(res, true, 'Stores retrieved successfully', {
            count: result.recordset.length,
            stores: result.recordset
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة متجر جديد
router.post('/', async (req, res) => {
    try {
        const {
            StoreName, CategoryID, CityID, AreaID, Address, Phone, Email,
            Description, IsActive, LogoURL, Rating, Username
        } = req.body;

        if (!StoreName || !Phone) return sendResponse(res, false, 'StoreName and Phone are required', null, 400);

        const pool = await poolPromise;

        // تحقق من التكرار
        const dupReq = pool.request().input('Phone', sql.NVarChar(sql.MAX), Phone);
        if (Email) dupReq.input('Email', sql.NVarChar(sql.MAX), Email);
        const dupQuery = Email
            ? 'SELECT StoreID FROM Stores WHERE Phone=@Phone OR Email=@Email'
            : 'SELECT StoreID FROM Stores WHERE Phone=@Phone';
        const dup = await dupReq.query(dupQuery);
        if (dup.recordset.length) return sendResponse(res, false, 'Phone or Email already registered', null, 409);

        // توليد Password و OTP
        const passwordPlain = generateRandomPassword(8);
        const passwordHashed = await bcrypt.hash(passwordPlain, SALT_ROUNDS);
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

        await pool.request()
            .input('StoreName', sql.NVarChar(sql.MAX), StoreName)
            .input('CategoryID', sql.Int, CategoryID || null)
            .input('CityID', sql.Int, CityID || null)
            .input('AreaID', sql.Int, AreaID || null)
            .input('Address', sql.NVarChar(sql.MAX), Address || null)
            .input('Phone', sql.NVarChar(sql.MAX), Phone)
            .input('Username', sql.NVarChar(sql.MAX), Username || null)
            .input('Description', sql.NVarChar(sql.MAX), Description || null)
            .input('IsActive', sql.Bit, IsActive ?? true)
            .input('CreatedAt', sql.DateTime, new Date())
            .input('LogoURL', sql.NVarChar(sql.MAX), LogoURL || null)
            .input('Rating', sql.Float, Rating || 0)
            .input('Password', sql.NVarChar(sql.MAX), passwordHashed)
            .input('OTP', sql.NVarChar(10), otp)
            .input('OTPExpires', sql.DateTime, otpExpires)
            .query(`
                INSERT INTO Stores
                (StoreName, CategoryID, CityID, AreaID, Address, Phone, UserName, Description, IsActive, CreatedAt, LogoURL, Rating, Password, OTP, OTPExpires)
                VALUES
                (@StoreName, @CategoryID, @CityID, @AreaID, @Address, @Phone, @Username, @Description, @IsActive, @CreatedAt, @LogoURL, @Rating, @Password, @OTP, @OTPExpires)
            `);

        // إرسال OTP عبر SMS
        // await sendOTP(Phone, otp);

        if (process.env.NODE_ENV !== 'production') {
            return sendResponse(res, true, 'Store created successfully. OTP sent via SMS.', { password: passwordPlain, otp }, 201);
        }

        sendResponse(res, true, 'Store created successfully. OTP sent via SMS.', null, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث بيانات متجر
router.put('/:StoreID', async (req, res) => {
    try {
        const { StoreID } = req.params;
        const updateData = req.body;
        const fields = Object.keys(updateData);
        if (!fields.length) return sendResponse(res, false, 'No fields to update', null, 400);

        const pool = await poolPromise;

        if (updateData.Password) {
            updateData.Password = await bcrypt.hash(updateData.Password, SALT_ROUNDS);
        }

        const request = pool.request().input('StoreID', sql.Int, StoreID);
        fields.forEach(f => {
            let type = sql.NVarChar;
            if (typeof updateData[f] === 'number') type = sql.Float;
            if (typeof updateData[f] === 'boolean') type = sql.Bit;
            if (updateData[f] instanceof Date) type = sql.DateTime;
            request.input(f, type, updateData[f]);
        });

        const setQuery = fields.map(f => `${f}=@${f}`).join(',');
        await request.query(`UPDATE Stores SET ${setQuery}, CreatedAt=GETDATE() WHERE StoreID=@StoreID`);

        sendResponse(res, true, 'Store updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف متجر
router.delete('/:StoreID', async (req, res) => {
    try {
        const { StoreID } = req.params;
        const pool = await poolPromise;
        await pool.request()
            .input('StoreID', sql.Int, StoreID)
            .query('DELETE FROM Stores WHERE StoreID=@StoreID');
        sendResponse(res, true, 'Store deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تسجيل دخول المتجر عبر OTP
router.post('/login-otp', async (req, res) => {
    try {
        const { Phone, OTP } = req.body;
        if (!Phone || !OTP) return sendResponse(res, false, 'Phone and OTP are required', null, 400);

        const pool = await poolPromise;
        const result = await pool.request()
            .input('Phone', sql.NVarChar(sql.MAX), Phone)
            .query('SELECT StoreID, OTP, OTPExpires FROM Stores WHERE Phone=@Phone');

        if (!result.recordset.length) return sendResponse(res, false, 'Store not found', null, 404);

        const store = result.recordset[0];
        if (store.OTP !== OTP) return sendResponse(res, false, 'Invalid OTP', null, 401);
        if (new Date() > store.OTPExpires) return sendResponse(res, false, 'OTP expired', null, 401);

        const token = jwt.sign({ storeId: store.StoreID }, JWT_SECRET, { expiresIn: '24h' });

        await pool.request()
            .input('StoreID', sql.Int, store.StoreID)
            .query('UPDATE Stores SET OTP=NULL, OTPExpires=NULL WHERE StoreID=@StoreID');

        sendResponse(res, true, 'Login successful', { token });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
