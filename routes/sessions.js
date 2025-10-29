const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
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
        const result = await sql`
            SELECT *
            FROM "sessions"
            ORDER BY "LoginTime" DESC
        `;
        sendResponse(res, true, 'Sessions fetched successfully', { count: result.length, sessions: result });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة جلسة جديدة
router.post('/', async (req, res) => {
    try {
        const { UserID, LoginTime, LogoutTime, DeviceInfo, SessionToken } = req.body;
        if (!UserID || !LoginTime || !SessionToken) {
            return sendResponse(res, false, 'UserID, LoginTime, and SessionToken are required', null, 400);
        }

        const result = await sql`
            INSERT INTO "Sessions" ("UserID", "LoginTime", "LogoutTime", "DeviceInfo", "SessionToken")
            VALUES (${UserID}, ${LoginTime}, ${LogoutTime || null}, ${DeviceInfo || null}, ${SessionToken})
            RETURNING *
        `;
        sendResponse(res, true, 'Session created successfully', result[0], 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث جلسة
router.put('/:SessionID', async (req, res) => {
    try {
        const { SessionID } = req.params;
        const updateData = req.body;
        const keys = Object.keys(updateData);
        if (!keys.length) return sendResponse(res, false, 'No fields to update', null, 400);

        const setClauses = keys.map((k, idx) => `"${k}"=$${idx + 1}`).join(', ');
        const values = keys.map(k => updateData[k]);

        const result = await sql`
            UPDATE "Sessions"
            SET ${sql.raw(setClauses)}
            WHERE "SessionID" = ${SessionID}
            RETURNING *
        `(...values);

        if (!result.length) return sendResponse(res, false, 'Session not found', null, 404);
        sendResponse(res, true, 'Session updated successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف جلسة
router.delete('/:SessionID', async (req, res) => {
    try {
        const { SessionID } = req.params;
        const result = await sql`
            DELETE FROM "sessions"
            WHERE "SessionID" = ${SessionID}
            RETURNING *
        `;
        if (!result.length) return sendResponse(res, false, 'Session not found', null, 404);
        sendResponse(res, true, 'Session deleted successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
