// db.js
require('dotenv').config();
const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL or SUPABASE_DB_URL not defined in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false } // For Supabase
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
