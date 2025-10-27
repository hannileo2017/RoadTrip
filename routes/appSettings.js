const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');

// 🧩 دالة مساعدة لتوحيد الردود
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({
        success,
        message,
        timestamp: new Date(),
        data
    });
}

// 📍 جلب جميع الإعدادات مع إمكانية البحث
router.get('/', async (req, res) => {
    try {
        const { search = '' } = req.query;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Search', `%${search}%`)
            .query(`
                SELECT * FROM AppSettings
                WHERE SettingName LIKE @Search OR SettingValue LIKE @Search
                ORDER BY UpdatedAt DESC;
            `);
        sendResponse(res, true, 'Settings retrieved successfully', result.recordset);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// 📍 جلب إعداد واحد حسب الاسم
router.get('/:name', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('SettingName', req.params.name)
            .query('SELECT * FROM AppSettings WHERE SettingName=@SettingName');

        if (result.recordset.length === 0)
            return sendResponse(res, false, 'Setting not found', null, 404);

        sendResponse(res, true, 'Setting retrieved successfully', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// 📍 إضافة أو تحديث إعداد (باستخدام MERGE)
router.post('/', async (req, res) => {
    try {
        const { SettingName, SettingValue } = req.body;
        if (!SettingName)
            return sendResponse(res, false, 'SettingName is required', null, 400);

        const pool = await poolPromise;
        await pool.request()
            .input('SettingName', SettingName)
            .input('SettingValue', SettingValue || '')
            .query(`
                MERGE AppSettings AS target
                USING (SELECT @SettingName AS SettingName) AS source
                ON target.SettingName = source.SettingName
                WHEN MATCHED THEN 
                    UPDATE SET SettingValue = @SettingValue, UpdatedAt = GETDATE()
                WHEN NOT MATCHED THEN 
                    INSERT (SettingName, SettingValue, UpdatedAt) 
                    VALUES (@SettingName, @SettingValue, GETDATE());
            `);

        sendResponse(res, true, 'Setting added or updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// 📍 تحديث قيمة إعداد محدد فقط
router.patch('/:name', async (req, res) => {
    try {
        const { SettingValue } = req.body;
        const pool = await poolPromise;

        const check = await pool.request()
            .input('SettingName', req.params.name)
            .query('SELECT SettingName FROM AppSettings WHERE SettingName=@SettingName');
        if (check.recordset.length === 0)
            return sendResponse(res, false, 'Setting not found', null, 404);

        await pool.request()
            .input('SettingName', req.params.name)
            .input('SettingValue', SettingValue)
            .query('UPDATE AppSettings SET SettingValue=@SettingValue, UpdatedAt=GETDATE() WHERE SettingName=@SettingName');

        sendResponse(res, true, 'Setting value updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// 📍 حذف إعداد حسب الاسم أو ID
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;

        // تحقق من وجود الإعداد
        const check = await pool.request()
            .input('id', req.params.id)
            .query(`
                SELECT * FROM AppSettings 
                WHERE SettingID = @id OR SettingName = @id
            `);
        if (check.recordset.length === 0)
            return sendResponse(res, false, 'Setting not found', null, 404);

        await pool.request()
            .input('id', req.params.id)
            .query(`
                DELETE FROM AppSettings 
                WHERE SettingID = @id OR SettingName = @id
            `);

        sendResponse(res, true, 'Setting deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
