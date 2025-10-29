require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false } // ضروري للاتصال بـ Supabase Pooler
});

module.exports = sql;
