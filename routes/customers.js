const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { poolPromise, sql } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendOTP } = require('../smsSender');
const sendResponse = require('../helpers/response');
const { generateRandomPassword, generateOTP } = require('../helpers/generate');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// ==========================
// 📍 جلب كل العملاء (Public)
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`SELECT CustomerID, FullName, Phone, Email, Address, CityID, AreaID, CreatedAt 
                    FROM Customers ORDER BY CreatedAt DESC`);
        sendResponse(res, true, 'Customers fetched successfully', result.recordset);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تسجيل عميل جديد
router.post('/', async (req, res) => {
    try {
        const { FullName, Phone, Email, Address, CityID, AreaID, Password } = req.body;
        if (!FullName || !Phone) return sendResponse(res, false, 'FullName and Phone are required', null, 400);

        const pool = await poolPromise;
        const dupReq = pool.request().input('Phone', sql.NVarChar(40), Phone);
        if (Email) dupReq.input('Email', sql.NVarChar(200), Email);
        const dupQuery = Email
            ? 'SELECT CustomerID FROM Customers WHERE Phone=@Phone OR Email=@Email'
            : 'SELECT CustomerID FROM Customers WHERE Phone=@Phone';
        const dup = await dupReq.query(dupQuery);
        if (dup.recordset.length) return sendResponse(res, false, 'Phone or Email already registered', null, 409);

        const finalPassword = Password || generateRandomPassword(8);
        const hashedPassword = await bcrypt.hash(finalPassword, SALT_ROUNDS);

        const OTP = generateOTP();
        const OTPExpires = new Date(Date.now() + 5 * 60 * 1000);

        await pool.request()
            .input('FullName', sql.NVarChar(200), FullName)
            .input('Phone', sql.NVarChar(40), Phone)
            .input('Email', sql.NVarChar(200), Email || null)
            .input('Address', sql.NVarChar(400), Address || null)
            .input('CityID', sql.Int, CityID || null)
            .input('AreaID', sql.Int, AreaID || null)
            .input('Password', sql.NVarChar(400), hashedPassword)
            .input('OTP', sql.NVarChar(40), OTP)
            .input('OTPExpires', sql.DateTime, OTPExpires)
            .query(`INSERT INTO Customers
                (FullName, Phone, Email, Address, CityID, AreaID, Password, OTP, OTPExpires, CreatedAt)
                VALUES (@FullName,@Phone,@Email,@Address,@CityID,@AreaID,@Password,@OTP,@OTPExpires,GETDATE())`);

        // إرسال OTP
        if (process.env.NODE_ENV !== 'production') {
            return sendResponse(res, true, 'Customer created successfully. OTP sent.', { otp: OTP, password: finalPassword }, 201);
        }

        await sendOTP(Phone, OTP);
        sendResponse(res, true, 'Customer created successfully. OTP sent via SMS.', null, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تسجيل الدخول عبر OTP
router.post('/login-otp', async (req, res) => {
    try {
        const { Phone } = req.body;
        if (!Phone) return sendResponse(res, false, 'Phone is required', null, 400);

        const pool = await poolPromise;
        const result = await pool.request()
            .input('Phone', sql.NVarChar(40), Phone)
            .query('SELECT CustomerID FROM Customers WHERE Phone=@Phone');

        if (!result.recordset.length) return sendResponse(res, false, 'Phone not registered', null, 404);

        const OTP = generateOTP();
        const OTPExpires = new Date(Date.now() + 5 * 60 * 1000);

        await pool.request()
            .input('Phone', sql.NVarChar(40), Phone)
            .input('OTP', sql.NVarChar(40), OTP)
            .input('OTPExpires', sql.DateTime, OTPExpires)
            .query('UPDATE Customers SET OTP=@OTP, OTPExpires=@OTPExpires WHERE Phone=@Phone');

        if (process.env.NODE_ENV !== 'production') {
            return sendResponse(res, true, 'OTP generated successfully', { otp: OTP }, 200);
        }

        await sendOTP(Phone, OTP);
        sendResponse(res, true, 'OTP sent via SMS', null, 200);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحقق من OTP وتسجيل الدخول
router.post('/verify-otp', async (req, res) => {
    try {
        const { Phone, OTP } = req.body;
        if (!Phone || !OTP) return sendResponse(res, false, 'Phone and OTP required', null, 400);

        const pool = await poolPromise;
        const result = await pool.request()
            .input('Phone', sql.NVarChar(40), Phone)
            .input('OTP', sql.NVarChar(40), OTP)
            .query('SELECT CustomerID, FullName FROM Customers WHERE Phone=@Phone AND OTP=@OTP AND OTPExpires > GETDATE()');

        if (!result.recordset.length) return sendResponse(res, false, 'Invalid or expired OTP', null, 401);

        const user = result.recordset[0];
        const token = jwt.sign({ customerId: user.CustomerID }, JWT_SECRET, { expiresIn: '7d' });

        await pool.request()
            .input('Phone', sql.NVarChar(40), Phone)
            .query('UPDATE Customers SET OTP=NULL, OTPExpires=NULL WHERE Phone=@Phone');

        sendResponse(res, true, 'Login successful', { token, customer: user }, 200);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 Route محمي: الملف الشخصي
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('CustomerID', sql.Int, req.customerId)
            .query('SELECT CustomerID, FullName, Phone, Email, Address, CityID, AreaID FROM Customers WHERE CustomerID=@CustomerID');
        if (!result.recordset.length) return sendResponse(res, false, 'Customer not found', null, 404);
        sendResponse(res, true, 'Profile fetched successfully', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
