// routes/drivers.js

const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { sendOTP: sendSMSOTP } = require('../smsSender');
// 🔹 استدعاء Helpers
const sendResponse = require('../helpers/response');
const { generateRandomPassword, generateOTP, generateUUID } = require('../helpers/generate');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';


// ==========================
// 🔹 Helper: تحديد نوع SQL للحقل
function sqlTypeForField(field, val) {
    switch (field) {
        case 'DriverID': return sql.NVarChar(50);
        case 'FullName':
        case 'UserName':
        case 'Phone':
        case 'Email':
        case 'VehicleType':
        case 'VehicleNumber':
        case 'LicenseNumber':
        case 'NationalID':
        case 'Address':
        case 'Status':
        case 'MaxLoad':
        case 'Model':
        case 'PhotoURL':
        case 'FCMToken':
        case 'NationalCardURL':
        case 'LicenseURL':
        case 'Notes':
            return sql.NVarChar(sql.MAX);
        case 'CityID':
        case 'AreaID':
            return sql.Int;
        case 'IsActive':
        case 'Available':
        case 'PhoneConfirmed':
            return sql.Bit;
        case 'Rating':
            return sql.Float;
        case 'CreatedAt':
        case 'LastUpdated':
        case 'LastLogin':
        case 'OTPExpires':
            return sql.DateTime;
        case 'Password':
            return sql.NVarChar(400);
        default:
            if (typeof val === 'number') return sql.Float;
            if (typeof val === 'boolean') return sql.Bit;
            return sql.NVarChar(sql.MAX);
    }
}

// ==========================
// 📍 جلب جميع السائقين مع البحث + Pagination
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
                SELECT DriverID, FullName, Phone, Email, VehicleType, Status, Available, CreatedAt, Rating, CityID, AreaID, PhoneConfirmed
                FROM Driver
                WHERE FullName LIKE @Search OR Phone LIKE @Search
                ORDER BY CreatedAt DESC
                OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
            `);

        sendResponse(res, true, 'Drivers retrieved successfully', {
            count: result.recordset.length,
            drivers: result.recordset
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب سائق حسب DriverID
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('DriverID', sql.NVarChar(50), req.params.id)
            .query(`
                SELECT DriverID, FullName, Phone, Email, VehicleType, VehicleNumber, LicenseNumber,
                       NationalID, Address, Status, Available, Rating, PhotoURL, CityID, AreaID,
                       NationalCardURL, LicenseURL, CreatedAt, LastUpdated, PhoneConfirmed
                FROM Driver WHERE DriverID=@DriverID
            `);

        if (!result.recordset.length) return sendResponse(res, false, 'Driver not found', null, 404);
        sendResponse(res, true, 'Driver retrieved successfully', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة سائق جديد
router.post('/', async (req, res) => {
    try {
        const {
            FullName, Phone, Email,
            VehicleType, VehicleNumber, LicenseNumber, NationalID,
            Address, IsActive, CityID, AreaID, Status, MaxLoad, Model,
            Notes, PhotoURL, Available, Rating, FCMToken,
            NationalCardURL, LicenseURL
        } = req.body;

        if (!FullName || !Phone) return sendResponse(res, false, 'FullName and Phone are required', null, 400);

        const pool = await poolPromise;

        // تحقق من التكرار
        const dupReq = pool.request().input('Phone', sql.NVarChar(50), Phone);
        if (Email) dupReq.input('Email', sql.NVarChar(sql.MAX), Email);
        const dupQuery = Email
            ? 'SELECT DriverID FROM Driver WHERE Phone=@Phone OR Email=@Email'
            : 'SELECT DriverID FROM Driver WHERE Phone=@Phone';
        const dup = await dupReq.query(dupQuery);
        if (dup.recordset.length) return sendResponse(res, false, 'Phone or Email already registered', null, 409);

        // توليد DriverID، Password و OTP
        const driverId = 'RTD-' + Date.now();
        const passwordPlain = generateRandomPassword(8);
        const hashedPassword = await bcrypt.hash(passwordPlain, SALT_ROUNDS);
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

        await pool.request()
            .input('DriverID', sql.NVarChar(50), driverId)
            .input('FullName', sql.NVarChar(sql.MAX), FullName)
            .input('Phone', sql.NVarChar(50), Phone)
            .input('Email', sql.NVarChar(sql.MAX), Email || null)
            .input('Password', sql.NVarChar(400), hashedPassword)
            .input('VehicleType', sql.NVarChar(sql.MAX), VehicleType || null)
            .input('VehicleNumber', sql.NVarChar(sql.MAX), VehicleNumber || null)
            .input('LicenseNumber', sql.NVarChar(sql.MAX), LicenseNumber || null)
            .input('NationalID', sql.NVarChar(sql.MAX), NationalID || null)
            .input('Address', sql.NVarChar(sql.MAX), Address || null)
            .input('IsActive', sql.Bit, IsActive ?? 1)
            .input('CityID', sql.Int, CityID || null)
            .input('AreaID', sql.Int, AreaID || null)
            .input('Status', sql.NVarChar(sql.MAX), Status || 'Offline')
            .input('MaxLoad', sql.NVarChar(sql.MAX), MaxLoad || null)
            .input('Model', sql.NVarChar(sql.MAX), Model || null)
            .input('Notes', sql.NVarChar(sql.MAX), Notes || null)
            .input('PhotoURL', sql.NVarChar(sql.MAX), PhotoURL || null)
            .input('Available', sql.Bit, Available ?? 1)
            .input('Rating', sql.Float, Rating || 0)
            .input('FCMToken', sql.NVarChar(sql.MAX), FCMToken || null)
            .input('NationalCardURL', sql.NVarChar(sql.MAX), NationalCardURL || null)
            .input('LicenseURL', sql.NVarChar(sql.MAX), LicenseURL || null)
            .input('OTP', sql.NVarChar(10), otp)
            .input('OTPExpires', sql.DateTime, otpExpires)
            .input('PhoneConfirmed', sql.Bit, 0)
            .query(`
                INSERT INTO Driver
                (DriverID, FullName, Phone, Email, Password, VehicleType, VehicleNumber, LicenseNumber, NationalID,
                 Address, IsActive, CreatedAt, CityID, AreaID, Status, MaxLoad, Model, Notes, PhotoURL, Available,
                 Rating, FCMToken, NationalCardURL, LicenseURL, OTP, OTPExpires, PhoneConfirmed)
                VALUES
                (@DriverID, @FullName, @Phone, @Email, @Password, @VehicleType, @VehicleNumber, @LicenseNumber, @NationalID,
                 @Address, @IsActive, GETDATE(), @CityID, @AreaID, @Status, @MaxLoad, @Model, @Notes, @PhotoURL, @Available,
                 @Rating, @FCMToken, @NationalCardURL, @LicenseURL, @OTP, @OTPExpires, @PhoneConfirmed)
            `);

        // إرسال OTP عبر SMS
        // await sendOTP(Phone, otp);

        sendResponse(res, true, 'Driver added successfully', { DriverID: driverId, password: passwordPlain });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث بيانات السائق
router.put('/:id', async (req, res) => {
    try {
        const updates = req.body;
        const keys = Object.keys(updates);
        if (!keys.length) return sendResponse(res, false, 'No fields to update', null, 400);

        const pool = await poolPromise;
        const check = await pool.request()
            .input('DriverID', sql.NVarChar(50), req.params.id)
            .query('SELECT DriverID FROM Driver WHERE DriverID=@DriverID');
        if (!check.recordset.length) return sendResponse(res, false, 'Driver not found', null, 404);

        if (updates.Password) {
            updates.Password = await bcrypt.hash(updates.Password, SALT_ROUNDS);
        }

        const request = pool.request().input('DriverID', sql.NVarChar(50), req.params.id);
        keys.forEach(k => {
            const t = sqlTypeForField(k, updates[k]);
            request.input(k, t, updates[k]);
        });

        const setQuery = keys.map(k => `${k}=@${k}`).join(', ');
        await request.query(`UPDATE Driver SET ${setQuery}, LastUpdated=GETDATE() WHERE DriverID=@DriverID`);

        sendResponse(res, true, 'Driver updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف سائق
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const check = await pool.request()
            .input('DriverID', sql.NVarChar(50), req.params.id)
            .query('SELECT DriverID FROM Driver WHERE DriverID=@DriverID');
        if (!check.recordset.length) return sendResponse(res, false, 'Driver not found', null, 404);

        await pool.request()
            .input('DriverID', sql.NVarChar(50), req.params.id)
            .query('DELETE FROM Driver WHERE DriverID=@DriverID');

        sendResponse(res, true, 'Driver deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث FCMToken
router.patch('/:id/fcmtoken', async (req, res) => {
    try {
        const { FCMToken } = req.body;
        const pool = await poolPromise;
        await pool.request()
            .input('DriverID', sql.NVarChar(50), req.params.id)
            .input('FCMToken', sql.NVarChar(sql.MAX), FCMToken)
            .query('UPDATE Driver SET FCMToken=@FCMToken, LastUpdated=GETDATE() WHERE DriverID=@DriverID');
        sendResponse(res, true, 'FCMToken updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث حالة السائق
router.patch('/:id/status', async (req, res) => {
    try {
        const { Status, Available } = req.body;
        const pool = await poolPromise;
        await pool.request()
            .input('DriverID', sql.NVarChar(50), req.params.id)
            .input('Status', sql.NVarChar(sql.MAX), Status)
            .input('Available', sql.Bit, Available)
            .query('UPDATE Driver SET Status=@Status, Available=@Available, LastUpdated=GETDATE() WHERE DriverID=@DriverID');
        sendResponse(res, true, 'Driver status updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تأكيد رقم الهاتف باستخدام OTP
router.post('/:id/confirm-phone', async (req, res) => {
    try {
        const { OTP } = req.body;
        if (!OTP) return sendResponse(res, false, 'OTP is required', null, 400);

        const pool = await poolPromise;
        const result = await pool.request()
            .input('DriverID', sql.NVarChar(50), req.params.id)
            .query('SELECT OTP, OTPExpires, PhoneConfirmed FROM Driver WHERE DriverID=@DriverID');

        if (!result.recordset.length) return sendResponse(res, false, 'Driver not found', null, 404);

        const driver = result.recordset[0];
        if (driver.PhoneConfirmed) return sendResponse(res, true, 'Phone already confirmed');
        if (driver.OTP !== OTP) return sendResponse(res, false, 'Invalid OTP', null, 401);
        if (new Date() > driver.OTPExpires) return sendResponse(res, false, 'OTP expired', null, 401);

        await pool.request()
            .input('DriverID', sql.NVarChar(50), req.params.id)
            .query('UPDATE Driver SET PhoneConfirmed=1, OTP=NULL, OTPExpires=NULL, LastUpdated=GETDATE() WHERE DriverID=@DriverID');

        sendResponse(res, true, 'Phone confirmed successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
