// server.js


console.log('Server time is:', new Date().toISOString());

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { poolPromise } = require('./db');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// =========================
// 🔹 اختبار الاتصال بالقاعدة عند بدء السيرفر
// =========================
(async () => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT GETDATE() AS currentTime');
        console.log('✅ Connected to SQL Server');
        console.log('🕒 Server current date/time:', result.recordset[0].currentTime);
    } catch (err) {
        console.error('❌ DB Connection Error at server start:', err);
        process.exit(1); // إيقاف السيرفر إذا فشل الاتصال
    }
})();

// =========================
// 🔹 تحميل الروتس أوتوماتيكياً من مجلد routes
// =========================
const routesPath = path.join(__dirname, 'routes');

fs.readdirSync(routesPath).forEach(file => {
    if (file.endsWith('.js')) {
        const routeModule = require(path.join(routesPath, file));
        const routeName = '/' + file.replace('.js', '');

        // تحقق إذا كان الملف Router
        if (routeModule && typeof routeModule === 'function' && routeModule.stack) {
            app.use(routeName, routeModule);
            console.log(`📡 Route loaded: ${routeName}`);
        } else {
            console.log(`⚠️ Skipping ${file} (likely middleware, not a router)`);
        }
    }
});

// =========================
// 🔹 نقطة اختبار رئيسية
// =========================
app.get('/', (req, res) => {
    res.send('🚀 RoadTrip API is running successfully!');
});

// =========================
// 🔹 تشغيل السيرفر
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));
