const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const routesDir = path.join(__dirname, '../routes');

// إعداد اتصال PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  await client.connect();

  // جلب أسماء الجداول من schema public
  const res = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname='public';
  `);

  const dbTables = res.rows.map(r => r.tablename.toLowerCase());

  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

  for (const file of routeFiles) {
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    dbTables.forEach(dbTable => {
      const regex = new RegExp(dbTable.replace(/_/g, ''), 'gi');
      if (regex.test(content) && !content.includes(dbTable)) {
        content = content.replace(regex, dbTable);
        modified = true;
      }
    });

    if (modified) {
      fs.copyFileSync(filePath, filePath + '.bak');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Modified: ${file} (backup: ${file}.bak)`);
    } else {
      console.log(`⚪ No changes needed: ${file}`);
    }
  }

  await client.end();
  console.log('---- Done ----');
})();
