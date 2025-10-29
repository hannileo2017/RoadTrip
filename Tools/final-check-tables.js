const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const routesDir = path.join(__dirname, '../routes');

// إعداد الاتصال بقاعدة البيانات PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  try {
    await client.connect();

    // جلب كل أسماء الجداول في قاعدة البيانات
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public'
    `);
    const dbTables = res.rows.map(r => r.table_name.toLowerCase());

    console.log('✅ Tables in DB:', dbTables);

    // فحص كل ملف روت
    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

    console.log('\n📝 Route tables check:\n---------------------------------------');

    for (const file of routeFiles) {
      const filePath = path.join(routesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();

      // استخراج أسماء الجداول (بسيط جداً: يبحث عن كلمات بعد supabase.from أو from)
      const tableMatches = [...content.matchAll(/(?:\.from|from)\s*\(?['"`](\w+)['"`]\)?/g)];
      const usedTables = [...new Set(tableMatches.map(m => m[1]))];

      if (usedTables.length === 0) {
        console.log(`📄 ${file} - Tables used: none ✅`);
      } else {
        const missing = usedTables.filter(t => !dbTables.includes(t));
        if (missing.length === 0) {
          console.log(`📄 ${file} - Tables used: ${usedTables.join(', ')} ✅`);
        } else {
          console.log(`📄 ${file} - Tables used: ${usedTables.join(', ')} ⚠️ Missing: ${missing.join(', ')}`);
        }
      }
      console.log('---------------------------------------');
    }

    await client.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await client.end();
  }
})();
