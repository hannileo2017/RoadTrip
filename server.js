require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// =========================
// DB Connection (Supabase/Postgres)
// =========================
let sql;
try {
  sql = require('./db'); // تأكد من أن db.js موجود ومهيأ
  (async () => {
    try {
      const result = await sql.query('SELECT NOW() AS currenttime');
      console.log('✅ Connected to Supabase/Postgres');
      console.log('🕒 Server current date/time:', result.rows[0]?.currenttime);
    } catch (err) {
      console.warn('❌ DB Connection failed at startup:', err.message || err);
    }
  })();
} catch(err) {
  console.warn('❌ Could not load db.js:', err.message || err);
}

// =========================
// Test route
// =========================
app.get('/api/test', async (req, res) => {
  try {
    const driversCountResp = sql ? await sql.query('SELECT COUNT(*)::int AS cnt FROM drivers') : { rows: [{cnt:0}] };
    const storesCountResp  = sql ? await sql.query('SELECT COUNT(*)::int AS cnt FROM stores')  : { rows: [{cnt:0}] };
    const ordersCountResp  = sql ? await sql.query('SELECT COUNT(*)::int AS cnt FROM orders')  : { rows: [{cnt:0}] };

    res.json({
      status: 'ok',
      connectedTo: sql ? 'Supabase/Postgres' : 'DB not connected',
      time: new Date().toISOString(),
      counts: {
        drivers: driversCountResp.rows[0].cnt,
        stores: storesCountResp.rows[0].cnt,
        orders: ordersCountResp.rows[0].cnt
      }
    });
  } catch (err) {
    res.json({ status: 'error', error: err.message || String(err) });
  }
});

// =========================
// Auto-load all routes safely
// =========================
const routesPath = path.join(__dirname, 'routes');
if (fs.existsSync(routesPath)) {
  fs.readdirSync(routesPath).forEach(file => {
    if (file.endsWith('.js')) {
      try {
        const routerModule = require(path.join(routesPath, file));
        // اعطِ مفتاح Supabase إذا كان موجود
        if (routerModule.init && process.env.SUPABASE_SERVICE_KEY) {
          routerModule.init({ supabaseKey: process.env.SUPABASE_SERVICE_KEY });
        }
        // ثبت المسار على السيرفر بدون حذف أي عنصر
        app.use('/api/' + file.replace('.js',''), routerModule);
        console.log(`📡 Route loaded: /${file.replace('.js','')}`);
      } catch (err) {
        console.warn(`❌ Skipped route ${file} due to error: ${err.message || err}`);
      }
    }
  });
}

// =========================
// Start server
// =========================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));

// =========================
// Graceful shutdown
// =========================
async function shutdown(signal) {
  console.log(`\n⚠️ Received ${signal}, shutting down gracefully...`);
  try {
    if (sql && typeof sql.end === 'function') await sql.end({ timeout: 5000 });
    console.log('✅ DB connections closed');
  } catch(err) {
    console.warn('⚠️ Error closing DB:', err.message || err);
  }
server.close(() => {
  console.log('✅ HTTP server closed');
  setTimeout(() => process.exit(0), 100); // فرض الخروج بعد 100ms
});

}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => { console.error('Uncaught Exception:', err); process.exit(1); });
