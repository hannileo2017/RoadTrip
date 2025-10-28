// db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,           // e.g. db.abcdefghijk.supabase.co
  port: process.env.DB_PORT || 5432,   // المنفذ الافتراضي لـ PostgreSQL
  database: process.env.DB_NAME,       // اسم قاعدة البيانات
  user: process.env.DB_USER,           // اسم المستخدم من Supabase
  password: process.env.DB_PASSWORD,   // كلمة المرور من Supabase
  ssl: {
    rejectUnauthorized: false          // ضروري لـ Render و Supabase
  },
  max: 10,
  idleTimeoutMillis: 30000
});

// اختبار الاتصال عند تشغيل السيرفر
pool.connect()
  .then(client => {
    console.log('✅ Connected to Supabase PostgreSQL');
    client.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });

module.exports = { pool };
