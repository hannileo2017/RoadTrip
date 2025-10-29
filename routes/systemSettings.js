const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
// routes/systemSettings.js
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js متصل بـ PostgreSQL

// دالة مساعدة للرد
const sendResponse = (res, success, message, data = null, status = 200) => {
    res.status(status).json({ success, message, data, timestamp: new Date() });
};

// ==========================
// GET جميع الإعدادات
router.get('/', async (req, res) => {
    try {
        const result = await sql`SELECT * FROM "systemsettings" ORDER BY "SettingKey" ASC`;
        sendResponse(res, true, 'System settings fetched successfully', { count: result.length, settings: result });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// PUT تحديث إعداد
router.put('/:SettingID', async (req, res) => {
    try {
        const { SettingID } = req.params;
        const { SettingValue } = req.body;
        if (SettingValue === undefined) return sendResponse(res, false, 'SettingValue is required', null, 400);

        const result = await sql`
            UPDATE "SystemSettings"
            SET "SettingValue" = ${SettingValue}
            WHERE "SettingID" = ${SettingID}
            RETURNING *
        `;
        if (!result.length) return sendResponse(res, false, 'Setting not found', null, 404);

        sendResponse(res, true, 'System setting updated successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
