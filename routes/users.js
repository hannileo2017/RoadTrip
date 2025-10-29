const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // الاتصال بملف db.js

// ✅ دالة موحدة لإرسال الرد
function sendResponse(res, success, message, data = null, status = 200) {
  res.status(status).json({ success, message, data });
}

// ✅ اختبار الاتصال عند تحميل الراوت
(async () => {
  try {
    await sql`SELECT NOW()`;
    console.log('📡 Users route connected to Supabase DB successfully');
  } catch (err) {
    console.error('❌ Users route DB connection error:', err.message);
  }
})();

// ==========================
// 📍 جلب جميع المستخدمين
// ==========================
router.get('/', async (req, res) => {
  try {
    const users = await sql`SELECT * FROM users ORDER BY "createdAt" DESC`;
    sendResponse(res, true, 'Users fetched successfully', users);
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 جلب مستخدم محدد
// ==========================
router.get('/:id', async (req, res) => {
  try {
    const user = await sql`SELECT * FROM users WHERE "userID" = ${req.params.id}`;
    if (user.length === 0)
      return sendResponse(res, false, 'User not found', null, 404);

    sendResponse(res, true, 'User fetched successfully', user[0]);
  } catch (err) {
    console.error('❌ Error fetching user by ID:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 إضافة مستخدم جديد
// ==========================
router.post('/', async (req, res) => {
  try {
    const {
      userID, fullName, userName, email, phone, password,
      roleID, cityID, areaID, address, status, photoURL,
      isActive, fcmToken
    } = req.body;

    if (!userID || !fullName || !phone)
      return sendResponse(res, false, 'userID, fullName and phone are required', null, 400);

    await sql`
      INSERT INTO users
        ("userID", "fullName", "userName", "email", "phone", "password",
         "roleID", "cityID", "areaID", "address", "status", "photoURL",
         "isActive", "fcmToken", "createdAt")
      VALUES
        (${userID}, ${fullName}, ${userName}, ${email}, ${phone}, ${password},
         ${roleID}, ${cityID}, ${areaID}, ${address}, ${status}, ${photoURL},
         ${isActive || false}, ${fcmToken}, NOW())
    `;

    sendResponse(res, true, 'User added successfully');
  } catch (err) {
    console.error('❌ Error adding user:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 تحديث بيانات مستخدم
// ==========================
router.put('/:id', async (req, res) => {
  try {
    const updates = req.body;
    const keys = Object.keys(updates);
    if (keys.length === 0)
      return sendResponse(res, false, 'No fields to update', null, 400);

    const setQuery = keys.map(k => `"${k}" = ${updates[k]}`).join(', ');
    await sql.unsafe(`
      UPDATE users
      SET ${setQuery}, "lastUpdated" = NOW()
      WHERE "userID" = '${req.params.id}'
    `);

    sendResponse(res, true, 'User updated successfully');
  } catch (err) {
    console.error('❌ Error updating user:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 حذف مستخدم
// ==========================
router.delete('/:id', async (req, res) => {
  try {
    await sql`DELETE FROM users WHERE "userID" = ${req.params.id}`;
    sendResponse(res, true, 'User deleted successfully');
  } catch (err) {
    console.error('❌ Error deleting user:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 تحديث FCMToken فقط
// ==========================
router.patch('/:id/fcmtoken', async (req, res) => {
  try {
    const { fcmToken } = req.body;
    await sql`
      UPDATE users
      SET "fcmToken" = ${fcmToken}, "lastUpdated" = NOW()
      WHERE "userID" = ${req.params.id}
    `;
    sendResponse(res, true, 'FCMToken updated successfully');
  } catch (err) {
    console.error('❌ Error updating FCMToken:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
