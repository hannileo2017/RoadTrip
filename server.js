// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ✅ لاحظ أن هنا نستورد db.js بشكل صحيح
const sql = require('./db');
const app = express();
app.use(express.json());

// إعدادات CORS
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// اختبار الاتصال بالـ DB عند بدء السيرفر
(async () => {
  try {
    const result = await sql`SELECT NOW() AS currenttime`;
    console.log('✅ Connected to Supabase PostgreSQL');
    console.log('🕒 Server current date/time:', result[0]?.currenttime);
  } catch (err) {
    console.error('❌ DB Connection Error at server start:', err.stack || err);
    process.exit(1);
  }
})();

// نقطة النهاية الرئيسية
app.get('/', (req, res) => {
  res.send('🚀 RoadTrip API connected to Supabase and running successfully!');
});

// --- routes auto-load ---
const routesPath = path.join(__dirname, 'routes');
if (fs.existsSync(routesPath)) {
  fs.readdirSync(routesPath).forEach(file => {
    if (file.endsWith('.js')) {
      try {
        const routerModule = require(path.join(routesPath, file));
        // تحقق إذا كان Router من Express
        if (routerModule && routerModule.stack && Array.isArray(routerModule.stack)) {
          app.use('/' + file.replace('.js',''), routerModule);
          console.log(`📡 Route loaded: /${file.replace('.js','')}`);
        } else {
          console.log(`⚠️ Skipped route file (not a router): ${file}`);
        }
      } catch (err) {
        console.error(`❌ Error loading route ${file}:`, err.message);
      }
    }
  });
}

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n⚠️ Received ${signal} — shutting down gracefully...`);
  try {
    if (sql && typeof sql.end === 'function') {
      await sql.end({ timeout: 5000 });
      console.log('✅ DB connections closed');
    }
  } catch (err) {
    console.warn('⚠️ Error closing DB:', err);
  }
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => { console.error('Uncaught Exception:', err); process.exit(1); });
