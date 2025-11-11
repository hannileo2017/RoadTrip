const express = require('express');
const router = express.Router();
const sql = require('../db');
const crypto = require('crypto');

// =====================
// Helpers كلمة مرور
// =====================
function hashPasswordWithSalt(password, salt) {
  const h = crypto.createHash('sha256');
  h.update(salt + password, 'utf8');
  return h.digest('hex');
}

function verifyStoredPassword(stored, password) {
  const parts = (stored || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  return hashPasswordWithSalt(password, salt) === hash;
}

// =====================
// Helper للردود
// =====================
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// =====================
// تسجيل محاولة دخول فاشلة
// =====================
async function logFailedLogin(username, ip) {
  try {
    await sql.query(
      `INSERT INTO failed_logins (username, ipaddress, attempttime)
       VALUES ($1, $2, NOW())`,
      [username, ip]
    );
  } catch (err) {
    console.error('Error logging failed login:', err);
  }
}

// =====================
// POST /api/auth/login
// =====================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!username || !password) return sendResponse(res, false, 'username & password required', null, 400);

    const result = await sql.query('SELECT * FROM users WHERE username=$1 LIMIT 1', [username]);
    if (!result.rows.length) {
      await logFailedLogin(username, ip);
      return sendResponse(res, false, 'Invalid username or password', null, 401);
    }

    const user = result.rows[0];
    if (!verifyStoredPassword(user.password, password)) {
      await logFailedLogin(username, ip);
      return sendResponse(res, false, 'Invalid username or password', null, 401);
    }

    // توليد session token عشوائي
    const token = `sess-${Date.now()}-${crypto.randomUUID()}`;
    await sql.query('INSERT INTO sessions (userid, sessiontoken, logintime) VALUES ($1,$2,NOW())', [user.userid, token]);

    sendResponse(res, true, 'Login successful', {
      userid: user.userid,
      username: user.username,
      fullname: user.fullname,
      role: user.role,
      token
    });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    sendResponse(res, false, 'Login failed', null, 500);
  }
});

module.exports = router;
