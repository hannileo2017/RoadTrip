
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

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
    await sql.query(`SELECT now()`, [/* add params here */]);
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
    const users = await sql.query(`SELECT * FROM users ORDER BY "createdAt" DESC`, [/* add params here */]);
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
    const user = await sql.query(`SELECT * FROM users WHERE "userID" = $1`, [/* add params here */]);
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

    await sql.query(`
      INSERT INTO users
        ("userID", "fullName", "userName", "email", "phone", "password",
         "roleID", "cityID", "areaID", "address", "status", "photoURL",
         "isActive", "fcmToken", "createdAt")
      VALUES
        ($1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12,
         $13, $14, NOW())
    `, [/* add params here */]);

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
      SET ${setquery}, "lastUpdated" = NOW()
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
    await sql.query(`DELETE FROM users WHERE "userID" = $1`, [/* add params here */]);
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
    await sql.query(`
      UPDATE users
      SET "fcmToken" = $1, "lastUpdated" = NOW()
      WHERE "userID" = $1
    `, [/* add params here */]);
    sendResponse(res, true, 'FCMToken updated successfully');
  } catch (err) {
    console.error('❌ Error updating FCMToken:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;

// --- auto-added init shim (safe) ---
try {
  if (!module.exports) module.exports = router;
} catch(e) {}

if (!module.exports.init) {
  module.exports.init = function initRoute(opts = {}) {
    try {
      if (opts.supabaseKey && !supabase && SUPABASE_URL) {
        try {
          
          supabase = createClient(SUPABASE_URL, opts.supabaseKey);
        } catch(err) { /* ignore */ }
      }
    } catch(err) { /* ignore */ }
    return module.exports;
  };
}
