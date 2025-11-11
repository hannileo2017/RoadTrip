require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js متصل بـ PostgreSQL

// ==========================
// دالة مساعدة للرد
const sendResponse = (res, success, message, data = null, status = 200) => {
    res.status(status).json({ success, message, data, timestamp: new Date() });
};

// ==========================
// 📍 GET: جميع إعدادات النظام
router.get('/', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM "systemsetting" ORDER BY "settingkey" ASC`);
        sendResponse(res, true, 'System settings fetched successfully', { count: result.rows.length, settings: result.rows });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 GET: إعداد محدد
router.get('/:SettingID', async (req, res) => {
    try {
        const { SettingID } = req.params;
        const result = await sql.query(`SELECT * FROM "systemsetting" WHERE "settingid"=$1`, [SettingID]);
        if (!result.rows.length) return sendResponse(res, false, 'Setting not found', null, 404);

        sendResponse(res, true, 'System setting fetched successfully', result.rows[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 PUT: تحديث إعداد
router.put('/:SettingID', async (req, res) => {
    try {
        const { SettingID } = req.params;
        const { SettingValue } = req.body;
        if (SettingValue === undefined) return sendResponse(res, false, 'SettingValue is required', null, 400);

        const result = await sql.query(`
            UPDATE "systemsetting"
            SET "settingvalue" = $1
            WHERE "settingid" = $2
            RETURNING *
        `, [SettingValue, SettingID]);

        if (!result.rows.length) return sendResponse(res, false, 'Setting not found', null, 404);

        sendResponse(res, true, 'System setting updated successfully', result.rows[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 POST: إضافة إعداد جديد (اختياري)
router.post('/', async (req, res) => {
    try {
        const { SettingKey, SettingValue } = req.body;
        if (!SettingKey || SettingValue === undefined) return sendResponse(res, false, 'SettingKey and SettingValue are required', null, 400);

        const result = await sql.query(`
            INSERT INTO "systemsetting" ("settingkey", "settingvalue")
            VALUES ($1, $2)
            RETURNING *
        `, [SettingKey, SettingValue]);

        sendResponse(res, true, 'System setting created successfully', result.rows[0], 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 DELETE: حذف إعداد (اختياري)
router.delete('/:SettingID', async (req, res) => {
    try {
        const { SettingID } = req.params;
        const result = await sql.query(`DELETE FROM "systemsetting" WHERE "settingid"=$1 RETURNING *`, [SettingID]);
        if (!result.rows.length) return sendResponse(res, false, 'Setting not found', null, 404);

        sendResponse(res, true, 'System setting deleted successfully', result.rows[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
