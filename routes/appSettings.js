const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // هنا db.js تستخدم postgres

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
        const result = await sql`
            SELECT * FROM appsettings
            WHERE SettingName ILIKE ${`%${search}%`} 
               OR SettingValue ILIKE ${`%${search}%`}
            ORDER BY "UpdatedAt" DESC
        `;
        sendResponse(res, true, 'Settings retrieved successfully', result);
    } catch (err) {
        console.error('Error GET /appSettings:', err);
        sendResponse(res, false, 'Failed to retrieve settings', null, 500);
    }
});

// 📍 جلب إعداد واحد حسب الاسم
router.get('/:name', async (req, res) => {
    try {
        const result = await sql`
            SELECT * FROM appsettings
            WHERE "SettingName" = ${req.params.name}
        `;
        if (!result.length)
            return sendResponse(res, false, `Setting "${req.params.name}" not found`, null, 404);

        sendResponse(res, true, 'Setting retrieved successfully', result[0]);
    } catch (err) {
        console.error('Error GET /appSettings/:name', err);
        sendResponse(res, false, 'Failed to retrieve setting', null, 500);
    }
});

// 📍 إضافة أو تحديث إعداد
router.post('/', async (req, res) => {
    try {
        const { SettingName, SettingValue } = req.body;
        if (!SettingName)
            return sendResponse(res, false, 'SettingName is required', null, 400);

        // تحقق إذا الإعداد موجود
        const exists = await sql`
            SELECT * FROM appsettings WHERE "SettingName" = ${SettingName}
        `;

        if (exists.length) {
            await sql`
                UPDATE AppSettings
                SET "SettingValue" = ${SettingValue || ''}, "UpdatedAt" = NOW()
                WHERE "SettingName" = ${SettingName}
            `;
        } else {
            await sql`
                INSERT INTO AppSettings("SettingName","SettingValue","UpdatedAt")
                VALUES(${SettingName}, ${SettingValue || ''}, NOW())
            `;
        }

        sendResponse(res, true, 'Setting added or updated successfully');
    } catch (err) {
        console.error('Error POST /appSettings', err);
        sendResponse(res, false, 'Failed to add/update setting', null, 500);
    }
});

// 📍 تحديث قيمة إعداد محدد فقط
router.patch('/:name', async (req, res) => {
    try {
        const { SettingValue } = req.body;
        if (SettingValue === undefined)
            return sendResponse(res, false, 'SettingValue is required', null, 400);

        const exists = await sql`
            SELECT * FROM appsettings WHERE "SettingName" = ${req.params.name}
        `;

        if (!exists.length)
            return sendResponse(res, false, `Setting "${req.params.name}" not found`, null, 404);

        await sql`
            UPDATE AppSettings
            SET "SettingValue" = ${SettingValue}, "UpdatedAt" = NOW()
            WHERE "SettingName" = ${req.params.name}
        `;

        sendResponse(res, true, 'Setting value updated successfully');
    } catch (err) {
        console.error('Error PATCH /appSettings/:name', err);
        sendResponse(res, false, 'Failed to update setting', null, 500);
    }
});

// 📍 حذف إعداد حسب الاسم أو ID
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;

        const exists = await sql`
            SELECT * FROM appsettings 
            WHERE "SettingID"::text = ${id} OR "SettingName" = ${id}
        `;

        if (!exists.length)
            return sendResponse(res, false, `Setting "${id}" not found`, null, 404);

        await sql`
            DELETE FROM appsettings 
            WHERE "SettingID"::text = ${id} OR "SettingName" = ${id}
        `;

        sendResponse(res, true, 'Setting deleted successfully');
    } catch (err) {
        console.error('Error DELETE /appSettings/:id', err);
        sendResponse(res, false, 'Failed to delete setting', null, 500);
    }
});

module.exports = router;
