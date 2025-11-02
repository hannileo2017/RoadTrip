// db.js
const postgres = require('postgres');
require('dotenv').config(); // تحميل متغيرات البيئة

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  throw new Error('⚠️ Missing DATABASE_URL in .env');
}

// الاتصال بقاعدة البيانات باستخدام DATABASE_URL
const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false }, // ضروري لـ Supabase على Render أو محلي
  max: 10,
  idle_timeout: 60000
});

module.exports = sql;
