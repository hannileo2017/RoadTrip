// server.js (modified)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ✅ نستورد db.js (يجب أن يكون ملف db.js مُعد للاتصال بـ Supabase/Postgres)
const sql = require('./db');
const app = express();
app.use(express.json());

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
    // لا نختم عملية التشغيل إذا أردت محاولة التشغيل بدون DB، لكن حالياً نخرج
    process.exit(1);
  }
})();

// Root
app.get('/', (req, res) => {
  res.send('🚀 RoadTrip API connected to Supabase and running successfully!');
});

/**
 * Helper: attempt to select rows from a table name (assumes lowercase table names).
 * Returns { error, data }.
 */
async function fetchTableRows(tableName, limit = 200) {
  try {
    // الافتراض: أسماء الجداول كلها بأحرف صغيرة (default in Postgres/Supabase).
    const query = `SELECT * FROM ${tableName} LIMIT ${limit}`;
    // نستخدم sql tagged template مع الاستعلام النصي:
    const data = await sql.unsafe ? await sql.unsafe(query) : await sql.query(query);
    // بعض مكتبات DB ترجع النتائج مباشرة، وبعضها داخل صفيف / كائن؛ سنحاول التعامل مع النتائج الشائعة
    if (Array.isArray(data)) return { data };
    if (data && data.rows) return { data: data.rows };
    return { data };
  } catch (err) {
    // أرسِل الخطأ للخادم لكي يظهر في اللوجز
    console.warn(`⚠️ fetchTableRows failed for "${tableName}":`, err?.message || err);
    return { error: err };
  }
}

// --------------------
// Explicit endpoints
// --------------------

// GET /api/drivers
app.get('/api/drivers', async (req, res) => {
  const { data, error } = await fetchTableRows('drivers', 500);
  if (error) {
    return res.status(500).json({
      error: 'Failed to read table "drivers". Check that the table exists and name is lowercase (drivers).',
      detail: error?.message || String(error)
    });
  }
  res.json({ table: 'drivers', count: data.length, data });
});

// GET /api/stores
app.get('/api/stores', async (req, res) => {
  const { data, error } = await fetchTableRows('stores', 500);
  if (error) {
    return res.status(500).json({
      error: 'Failed to read table "stores". Check that the table exists and name is lowercase (stores).',
      detail: error?.message || String(error)
    });
  }
  res.json({ table: 'stores', count: data.length, data });
});

// GET /api/orders
app.get('/api/orders', async (req, res) => {
  const { data, error } = await fetchTableRows('orders', 500);
  if (error) {
    return res.status(500).json({
      error: 'Failed to read table "orders". Check that the table exists and name is lowercase (orders).',
      detail: error?.message || String(error)
    });
  }
  res.json({ table: 'orders', count: data.length, data });
});

// GET /api/test  -> صحة عامة: يعطي عدد الصفوف في الجداول الأساسية إن أمكن
app.get('/api/test', async (req, res) => {
  try {
    const driversCountResp = await sql`SELECT COUNT(*)::int AS cnt FROM drivers`;
    const storesCountResp  = await sql`SELECT COUNT(*)::int AS cnt FROM stores`;
    const ordersCountResp  = await sql`SELECT COUNT(*)::int AS cnt FROM orders`;

    const driversCount = driversCountResp?.[0]?.cnt ?? null;
    const storesCount  = storesCountResp?.[0]?.cnt ?? null;
    const ordersCount  = ordersCountResp?.[0]?.cnt ?? null;

    return res.json({
      status: 'ok',
      connectedTo: 'Supabase/Postgres',
      time: new Date().toISOString(),
      counts: {
        drivers: driversCount,
        stores: storesCount,
        orders: ordersCount
      }
    });
  } catch (err) {
    // لو فشل، نعيد رسالة قابلة للقراءة في اللوجز
    console.warn('⚠️ /api/test error:', err?.message || err);
    return res.status(200).json({
      status: 'ok',
      note: 'Connected but could not read one or more tables. Check table names or permissions.',
      error: err?.message || String(err)
    });
  }
});

// --- routes auto-load (احتفظت بالآلية الأصلية لديك) ---
const routesPath = path.join(__dirname, 'routes');
if (fs.existsSync(routesPath)) {
  fs.readdirSync(routesPath).forEach(file => {
    if (file.endsWith('.js')) {
      try {
        const routerModule = require(path.join(routesPath, file));
        // إذا كان Router من Express (تقنية بسيطة للتأكد)
        if (routerModule && routerModule.stack && Array.isArray(routerModule.stack)) {
          app.use('/api/' + file.replace('.js',''), routerModule);
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
