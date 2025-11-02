// db.js (recommended for `postgres` library)
const postgres = require('postgres');

const {
  DB_HOST,
  DB_PORT = 5432,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
} = process.env;

if (!DB_HOST || !DB_NAME || !DB_USER || !DB_PASSWORD) {
  throw new Error('⚠️ Missing DB env vars. Make sure DB_HOST, DB_NAME, DB_USER, DB_PASSWORD are set.');
}

const sql = postgres({
  host: DB_HOST,
  port: Number(DB_PORT),
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, // ضروري لـ Supabase على Render
  max: 10, // pool size
  idle_timeout: 60000
});

module.exports = sql;
