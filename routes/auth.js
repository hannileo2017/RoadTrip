const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({
        success,
        message,
        timestamp: new Date(),
        data
    });
}

// ==========================
// تسجيل مستخدم جديد
router.post('/register', async (req, res) => {
    const { FullName, UserName, Email, Phone, Password, UserType } = req.body;
    try {
        const pool = await poolPromise;
        const hashedPassword = await bcrypt.hash(Password, 10);
        await pool.request()
            .input('FullName', sql.NVarChar(100), FullName)
            .input('UserName', sql.NVarChar(50), UserName)
            .input('Email', sql.NVarChar(100), Email)
            .input('Phone', sql.NVarChar(20), Phone)
            .input('Password', sql.NVarChar(100), hashedPassword)
            .input('UserType', sql.NVarChar(50), UserType)
            .query(`INSERT INTO Users (FullName, UserName, Email, Phone, Password, UserType) 
                    VALUES (@FullName, @UserName, @Email, @Phone, @Password, @UserType)`);

        sendResponse(res, true, 'User registered successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// تسجيل دخول
router.post('/login', async (req, res) => {
    const { UserName, Password } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserName', sql.NVarChar(50), UserName)
            .query('SELECT * FROM Users WHERE UserName=@UserName');
        
        const user = result.recordset[0];
        if (!user) return sendResponse(res, false, 'User not found', null, 400);

        const validPass = await bcrypt.compare(Password, user.Password);
        if (!validPass) return sendResponse(res, false, 'Invalid password', null, 400);

        const token = jwt.sign({ id: user.UserID, type: user.UserType }, JWT_SECRET, { expiresIn: '7d' });
        sendResponse(res, true, 'Login successful', { token, user });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
