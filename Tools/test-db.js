require('dotenv').config();
const sql = require('../db'); // مسار db.js صحيح

(async () => {
  try {
    const result = await sql`SELECT NOW() AS currenttime`;
    console.log('✅ Connected to Supabase PostgreSQL (Pooler)');
    console.log('🕒 Server current date/time:', result[0]?.currenttime);
  } catch (err) {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', err);
  } finally {
    if (sql && typeof sql.end === 'function') await sql.end({ timeout: 5000 });
  }
})();
