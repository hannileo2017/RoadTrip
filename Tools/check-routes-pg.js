const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

// إعداد الاتصال بـ PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  try {
    await client.connect();

    // جلب جميع الجداول في public schema
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const tablesInDb = res.rows.map(r => r.table_name.toLowerCase());
    console.log('✅ Tables in DB:', tablesInDb);

    // مسار ملفات الروتس
    const routesDir = path.join(__dirname, '../routes');
    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

    console.log('\n📝 تقرير الفحص للروتس:');
    console.log('---------------------------------------');

    for (const file of routeFiles) {
      const filePath = path.join(routesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // البحث عن جداول مستخدمة (crud عبر supabase.createClient().from('TABLE'))
      const regex = /\.from\(['"`]([\w_]+)['"`]\)/g;
      let match;
      const tablesUsed = [];
      while ((match = regex.exec(content)) !== null) {
        tablesUsed.push(match[1].toLowerCase());
      }

      // جداول مفقودة في DB
      const missingTables = tablesUsed.filter(t => !tablesInDb.includes(t));

      console.log(`📄 Route: ${filePath}`);
      console.log(`- Tables used: ${tablesUsed.join(', ') || 'none'}`);
      if (missingTables.length > 0) {
        console.log(`⚠️ Missing tables in DB schema: ${missingTables.join(', ')}`);
      } else {
        console.log('✅ All tables exist in DB');
      }
      console.log('---------------------------------------');
    }

    await client.end();
  } catch (err) {
    console.error('❌ Error:', err);
    await client.end();
  }
})();
