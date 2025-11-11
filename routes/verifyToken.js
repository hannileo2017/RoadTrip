require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || null;
const SUPABASE_URL = process.env.SUPABASE_URL || null;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// GET جميع الطلبات مع التحقق
router.get('/', verifyToken, async (req, res) => {
    try {
        const { rows } = await sql.query(`SELECT * FROM "orders" ORDER BY "CreatedAt" DESC`);
        sendResponse(res, true, 'Orders fetched successfully', { count: rows.length, orders: rows });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
