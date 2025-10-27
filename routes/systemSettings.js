const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// 📍 عرض جميع الإعدادات
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM SystemSettings ORDER BY SettingKey ASC');
        sendResponse(res, true, 'System settings fetched successfully', { count: result.recordset.length, settings: result.recordset });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث إعداد
router.put('/:SettingID', async (req, res) => {
    try {
        const { SettingID } = req.params;
        const { SettingValue } = req.body;
        if (SettingValue === undefined) return sendResponse(res, false, 'SettingValue is required', null, 400);

        const pool = await poolPromise;
        await pool.request()
            .input('SettingID', sql.Int, SettingID)
            .input('SettingValue', sql.NVarChar(1000), SettingValue)
            .query('UPDATE SystemSettings SET SettingValue=@SettingValue WHERE SettingID=@SettingID');

        sendResponse(res, true, 'System setting updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
