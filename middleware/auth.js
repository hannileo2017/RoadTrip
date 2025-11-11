// middleware/auth.js
const db = require('../db'); // قد يحتوي على pool أو metodo query

// =====================
// Helper للـ DB Query
// =====================
async function dbQuery(text, params = []) {
  if (!db) throw new Error('DB module not found');
  if (typeof db.query === 'function') {
    const result = await db.query(text, params);
    return result.rows || result;
  }
  if (db.pool && typeof db.pool.query === 'function') {
    const result = await db.pool.query(text, params);
    return result.rows || result;
  }
  throw new Error('No usable DB client (expected db.query or db.pool.query)');
}

// =====================
// Middleware: تحقق وجود session صالح
// =====================
async function requireSession(req, res, next) {
  try {
    const auth = req.headers['authorization'] || req.headers['Authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      console.warn(`❌ Unauthorized request from IP ${req.ip}: Missing token`);
      return res.status(401).json({ success: false, message: 'Authorization header missing' });
    }
    const token = auth.slice(7);

    const q = `
      SELECT s.sessionid, s.userid, s.logintime, s.logouttime, u.username, u.fullname, u.role
      FROM sessions s
      JOIN users u ON s.userid = u.userid
      WHERE s.sessiontoken = $1 AND s.logouttime IS NULL
      LIMIT 1
    `;
    const rows = await dbQuery(q, [token]);

    if (!rows || !rows.length) {
      console.warn(`❌ Unauthorized request from IP ${req.ip}: Invalid/expired token`);
      return res.status(401).json({ success: false, message: 'Invalid or expired session' });
    }

    // ⚡ يمكن إضافة مدة صلاحية للجلسة
    const MAX_SESSION_DURATION = 1000 * 60 * 60 * 24; // 24 ساعة كمثال
    if (new Date(rows[0].logintime).getTime() + MAX_SESSION_DURATION < Date.now()) {
      console.warn(`❌ Session expired for user ${rows[0].username} from IP ${req.ip}`);
      return res.status(401).json({ success: false, message: 'Session expired' });
    }

    req.user = rows[0]; // { sessionid, userid, username, fullname, role, ... }
    return next();

  } catch (err) {
    console.error('❌ Session verification error:', err);
    return res.status(500).json({ success: false, message: 'Session verification failed', error: err.message });
  }
}

// =====================
// Middleware: تحقق الدور
// =====================
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        console.warn(`❌ Forbidden request: user not authenticated, IP ${req.ip}`);
        return res.status(401).json({ success: false, message: 'Not authenticated' });
      }

      if (!allowedRoles.length) return next(); // لا يوجد قيود

      const role = (req.user.role || '').toString();
      if (!allowedRoles.includes(role)) {
        console.warn(`🚫 User ${req.user.username} with role ${role} tried to access restricted route from IP ${req.ip}`);
        return res.status(403).json({ success: false, message: 'Forbidden: insufficient role' });
      }

      return next();
    } catch (err) {
      console.error('❌ Role verification error:', err);
      return res.status(500).json({ success: false, message: 'Role verification error' });
    }
  };
}

module.exports = { requireSession, requireRole, dbQuery };
