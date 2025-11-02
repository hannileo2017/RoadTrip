// test-db.js
require('dotenv').config();
const sql = require('./db');

sql`SELECT 1`
  .then(() => console.log('✅ DB connected successfully'))
  .catch(err => console.error('❌ DB connection failed', err));
