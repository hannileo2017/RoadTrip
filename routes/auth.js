
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

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

        await sql.query(`
            INSERT INTO "Users" ("FullName","UserName","Email","Phone","Password","UserType")
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [/* add params here */]);

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

        const users = await sql.query(`
            SELECT * FROM "users" WHERE "UserName" = $1
        `, [/* add params here */]);

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

// --- auto-added init shim (safe) ---
try {
  if (!module.exports) module.exports = router;
} catch(e) {}

if (!module.exports.init) {
  module.exports.init = function initRoute(opts = {}) {
    try {
      if (opts.supabaseKey && !supabase && SUPABASE_URL) {
        try {
          
          supabase = createClient(SUPABASE_URL, opts.supabaseKey);
        } catch(err) { /* ignore */ }
      }
    } catch(err) { /* ignore */ }
    return module.exports;
  };
}
