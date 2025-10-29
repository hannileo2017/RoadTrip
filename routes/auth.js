const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const express = require('express');
const router = express.Router();
const sql = require('../db'); // PostgreSQL client
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
    try {
        const { FullName, UserName, Email, Phone, Password, UserType } = req.body;
        if (!FullName || !UserName || !Email || !Phone || !Password || !UserType)
            return sendResponse(res, false, 'All fields are required', null, 400);

        const hashedPassword = await bcrypt.hash(Password, 10);

        await sql`
            INSERT INTO "Users" ("FullName","UserName","Email","Phone","Password","UserType")
            VALUES (${FullName}, ${UserName}, ${Email}, ${Phone}, ${hashedPassword}, ${UserType})
        `;

        sendResponse(res, true, 'User registered successfully');
    } catch (err) {
        console.error('Error POST /auth/register:', err);
        sendResponse(res, false, 'Failed to register user', null, 500);
    }
});

// ==========================
// تسجيل دخول
router.post('/login', async (req, res) => {
    try {
        const { UserName, Password } = req.body;
        if (!UserName || !Password)
            return sendResponse(res, false, 'UserName and Password are required', null, 400);

        const users = await sql`
            SELECT * FROM "users" WHERE "UserName" = ${UserName}
        `;

        const user = users[0];
        if (!user) return sendResponse(res, false, 'User not found', null, 404);

        const validPass = await bcrypt.compare(Password, user.Password);
        if (!validPass) return sendResponse(res, false, 'Invalid password', null, 401);

        const token = jwt.sign(
            { id: user.UserID, type: user.UserType },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // لا ترسل كلمة المرور مع البيانات
        const { Password: _, ...userWithoutPassword } = user;

        sendResponse(res, true, 'Login successful', { token, user: userWithoutPassword });
    } catch (err) {
        console.error('Error POST /auth/login:', err);
        sendResponse(res, false, 'Failed to login', null, 500);
    }
});

module.exports = router;
