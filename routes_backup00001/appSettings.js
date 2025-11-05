require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // PostgreSQL client
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

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
    const result = await sql.query(
      `SELECT * FROM appsettings
       WHERE "SettingName" ILIKE $1 OR "SettingValue" ILIKE $1
       ORDER BY "UpdatedAt" DESC`,
      [`%${search}%`]
    );
    sendResponse(res, true, 'Settings retrieved successfully', result.rows);
  } catch (err) {
    console.error('Error GET /appSettings:', err);
    sendResponse(res, false, 'Failed to retrieve settings', null, 500);
  }
});

// 📍 جلب إعداد واحد حسب الاسم
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query(
      `SELECT * FROM appsettings WHERE "SettingName" = $1`,
      [name]
    );
    if (!result.rows.length)
      return sendResponse(res, false, `Setting "${name}" not found`, null, 404);

    sendResponse(res, true, 'Setting retrieved successfully', result.rows[0]);
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

    const exists = await sql.query(
      `SELECT * FROM appsettings WHERE "SettingName" = $1`,
      [SettingName]
    );

    if (exists.rows.length) {
      await sql.query(
        `UPDATE appsettings
         SET "SettingValue" = $1, "UpdatedAt" = NOW()
         WHERE "SettingName" = $2`,
        [SettingValue || '', SettingName]
      );
    } else {
      await sql.query(
        `INSERT INTO appsettings("SettingName","SettingValue","UpdatedAt")
         VALUES($1, $2, NOW())`,
        [SettingName, SettingValue || '']
      );
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

    const { name } = req.params;
    const exists = await sql.query(
      `SELECT * FROM appsettings WHERE "SettingName" = $1`,
      [name]
    );

    if (!exists.rows.length)
      return sendResponse(res, false, `Setting "${name}" not found`, null, 404);

    await sql.query(
      `UPDATE appsettings
       SET "SettingValue" = $1, "UpdatedAt" = NOW()
       WHERE "SettingName" = $2`,
      [SettingValue, name]
    );

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

    const exists = await sql.query(
      `SELECT * FROM appsettings 
       WHERE "SettingID"::text = $1 OR "SettingName" = $1`,
      [id]
    );

    if (!exists.rows.length)
      return sendResponse(res, false, `Setting "${id}" not found`, null, 404);

    await sql.query(
      `DELETE FROM appsettings 
       WHERE "SettingID"::text = $1 OR "SettingName" = $1`,
      [id]
    );

    sendResponse(res, true, 'Setting deleted successfully');
  } catch (err) {
    console.error('Error DELETE /appSettings/:id', err);
    sendResponse(res, false, 'Failed to delete setting', null, 500);
  }
});

module.exports = router;
