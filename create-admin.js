// create-admin.js
require('dotenv').config();
const sql = require('./db');
const crypto = require('crypto');

function generateSalt(size = 16) {
  return crypto.randomBytes(size).toString('base64');
}
function hashPasswordWithSalt(password, salt) {
  const h = crypto.createHash('sha256');
  h.update(salt + password, 'utf8');
  return h.digest('hex');
}
function makeStoredPassword(password) {
  const salt = generateSalt();
  const hash = hashPasswordWithSalt(password, salt);
  return `${salt}:${hash}`;
}

// Usage: node create-admin.js <username> <password> "<Full Name>" <role>
(async () => {
  try {
    const [,, username, password, fullname = 'Administrator', role = 'admin'] = process.argv;
    if (!username || !password) {
      console.log('Usage: node create-admin.js <username> <password> "<Full Name>" <role>');
      process.exit(1);
    }

    const storedPwd = makeStoredPassword(password);

    // تحقق من وجود المستخدم
    const dup = await sql.query('SELECT userid FROM users WHERE username = $1 LIMIT 1', [username]);
    if (dup.rows.length) {
      console.log('User already exists:', username);
      process.exit(0);
    }

    const q = `
      INSERT INTO users (username, password, fullname, role, createdat)
      VALUES ($1,$2,$3,$4,NOW())
      RETURNING userid, username, fullname, role, createdat
    `;
    const r = await sql.query(q, [username, storedPwd, fullname, role]);
    console.log('User created:', r.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Error creating user:', err);
    process.exit(1);
  }
})();
