// ملف: tools/test-pg-connection.js
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.kyrxzxkokirculjltoja',
  password: process.env.DB_PASSWORD, // ضع كلمة المرور في .env
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await client.connect();
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Tables in DB:', res.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Error connecting to DB:', err);
  } finally {
    await client.end();
  }
})();
