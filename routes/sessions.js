const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// 📍 عرض كل الجلسات
router.get('/', async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT *
            FROM sessions
            ORDER BY logintime DESC
        `);
        sendResponse(res, true, 'Sessions fetched successfully', { count: result.rows.length, sessions: result.rows });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة جلسة جديدة
router.post('/', async (req, res) => {
    try {
        const { userid, logintime, logouttime = null, deviceinfo = null, sessiontoken } = req.body;
        if (!userid || !logintime || !sessiontoken) {
            return sendResponse(res, false, 'userid, logintime, and sessiontoken are required', null, 400);
        }

        const result = await sql.query(`
            INSERT INTO sessions (userid, logintime, logouttime, deviceinfo, sessiontoken)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [userid, logintime, logouttime, deviceinfo, sessiontoken]);

        sendResponse(res, true, 'Session created successfully', result.rows[0], 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث جلسة
router.put('/:sessionid', async (req, res) => {
    try {
        const { sessionid } = req.params;
        const updateData = req.body;
        const keys = Object.keys(updateData);
        if (!keys.length) return sendResponse(res, false, 'No fields to update', null, 400);

        const setClauses = keys.map((k, idx) => `${k}=$${idx+1}`).join(', ');
        const values = keys.map(k => updateData[k]);

        const result = await sql.query(`
            UPDATE sessions
            SET ${setClauses}
            WHERE sessionid=$${keys.length + 1}
            RETURNING *
        `, [...values, sessionid]);

        if (!result.rows.length) return sendResponse(res, false, 'Session not found', null, 404);
        sendResponse(res, true, 'Session updated successfully', result.rows[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف جلسة
router.delete('/:sessionid', async (req, res) => {
    try {
        const { sessionid } = req.params;
        const result = await sql.query(`
            DELETE FROM sessions
            WHERE sessionid = $1
            RETURNING *
        `, [sessionid]);

        if (!result.rows.length) return sendResponse(res, false, 'Session not found', null, 404);
        sendResponse(res, true, 'Session deleted successfully', result.rows[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
