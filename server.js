// server.js

console.log('Server time is:', new Date().toISOString());

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('./db'); // استدعاء الـ pool الجديد من PostgreSQL
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// =========================
// 🔹 اختبار الاتصال بقاعدة Supabase عند بدء السيرفر
// =========================
(async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() AS currentTime');
    console.log('✅ Connected to Supabase PostgreSQL');
    console.log('🕒 Server current date/time:', result.rows[0].currenttime);
    client.release();
  } catch (err) {
    console.error('❌ DB Connection Error at server start:', err);
    process.exit(1); // إيقاف السيرفر إذا فشل الاتصال
  }
})();

// =========================
// 🔹 تحميل الروتات أوتوماتيكياً من مجلد routes
// =========================
const routesPath = path.join(__dirname, 'routes');

fs.readdirSync(routesPath).forEach(file => {
  if (file.endsWith('.js')) {
    const routeModule = require(path.join(routesPath, file));
    const routeName = '/' + file.replace('.js', '');

    // تأكد أن الملف Router فعلاً
    if (routeModule && typeof routeModule === 'function' && routeModule.stack) {
      app.use(routeName, routeModule);
      console.log(`📡 Route loaded: ${routeName}`);
    } else {
      console.log(`⚠️ Skipping ${file} (not a valid Express router)`);
    }
  }
});

// =========================
// 🔹 نقطة اختبار رئيسية
// =========================
app.get('/', (req, res) => {
  res.send('🚀 RoadTrip API connected to Supabase and running successfully!');
});

// =========================
// 🔹 تشغيل السيرفر
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));
