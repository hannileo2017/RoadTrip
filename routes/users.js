const express = require('express');
const router = express.Router();
const sql = require('../db');
const crypto = require('crypto');

// دالة موحدة للردود
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// توليد كلمة مرور مخزنة
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

function verifyStoredPassword(stored, password) {
  const parts = (stored || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  return hashPasswordWithSalt(password, salt) === hash;
}

// GET جميع المستخدمين مع pagination + search + filter
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const search = req.query.search || '';
    const usernameFilter = req.query.username || '';
    const roleFilter = req.query.role || '';

    const whereClauses = [];
    const params = [];

    if (search) { params.push(`%${search}%`); whereClauses.push(`(username ILIKE $${params.length} OR fullname ILIKE $${params.length})`); }
    if (usernameFilter) { params.push(`%${usernameFilter}%`); whereClauses.push(`username ILIKE $${params.length}`); }
    if (roleFilter) { params.push(roleFilter); whereClauses.push(`role=$${params.length}`); }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    params.push(limit, offset);

    const result = await sql.query(
      `SELECT userid, username, fullname, role, roleid, createdat, lastlogin
       FROM users
       ${whereSQL}
       ORDER BY createdat DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    sendResponse(res, true, 'Users retrieved successfully', {
      page,
      limit,
      count: result.rows.length,
      users: result.rows
    });
  } catch (err) {
    console.error('GET /users error:', err);
    sendResponse(res, false, 'Failed to fetch users', null, 500);
  }
});

// GET مستخدم واحد حسب userid
router.get('/:id', async (req, res) => {
  try {
    const userid = parseInt(req.params.id);
    if (isNaN(userid)) return sendResponse(res, false, 'Invalid userid', null, 400);

    const result = await sql.query(
      'SELECT userid, username, fullname, role, roleid, createdat, lastlogin FROM users WHERE userid=$1',
      [userid]
    );

    if (!result.rows.length) return sendResponse(res, false, `User with ID ${userid} not found`, null, 404);

    sendResponse(res, true, 'User retrieved successfully', result.rows[0]);
  } catch (err) {
    console.error('GET /users/:id error:', err);
    sendResponse(res, false, 'Failed to fetch user', null, 500);
  }
});

// POST إضافة مستخدم جديد
router.post('/', async (req, res) => {
  try {
    const { username, fullname, password, role, roleid } = req.body;
    if (!username || !fullname || !password) return sendResponse(res, false, 'username, fullname, and password required', null, 400);

    const dup = await sql.query('SELECT userid FROM users WHERE username=$1 LIMIT 1', [username]);
    if (dup.rows.length) return sendResponse(res, false, 'Username already exists', null, 409);

    const storedPwd = makeStoredPassword(password);
    const result = await sql.query(
      `INSERT INTO users (username, fullname, password, role, roleid, createdat)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING userid, username, fullname, role, roleid, createdat`,
      [username, fullname, storedPwd, role || 'user', roleid || null]
    );

    sendResponse(res, true, 'User created successfully', result.rows[0], 201);
  } catch (err) {
    console.error('POST /users error:', err);
    sendResponse(res, false, 'Failed to create user', null, 500);
  }
});

// PATCH تحديث مستخدم جزئي
router.patch('/:id', async (req, res) => {
  try {
    const userid = parseInt(req.params.id);
    if (isNaN(userid)) return sendResponse(res, false, 'Invalid userid', null, 400);

    const exists = await sql.query('SELECT * FROM users WHERE userid=$1', [userid]);
    if (!exists.rows.length) return sendResponse(res, false, `User with ID ${userid} not found`, null, 404);

    const { username, fullname, password, role, roleid, lastlogin } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (username !== undefined) { updates.push(`username=$${idx++}`); params.push(username); }
    if (fullname !== undefined) { updates.push(`fullname=$${idx++}`); params.push(fullname); }
    if (password !== undefined) { updates.push(`password=$${idx++}`); params.push(makeStoredPassword(password)); }
    if (role !== undefined) { updates.push(`role=$${idx++}`); params.push(role); }
    if (roleid !== undefined) { updates.push(`roleid=$${idx++}`); params.push(roleid); }
    if (lastlogin !== undefined) { updates.push(`lastlogin=$${idx++}`); params.push(lastlogin); }

    if (!updates.length) return sendResponse(res, false, 'Nothing to update', null, 400);

    params.push(userid);

    const result = await sql.query(
      `UPDATE users SET ${updates.join(', ')} WHERE userid=$${idx} RETURNING userid, username, fullname, role, roleid, createdat, lastlogin`,
      params
    );

    sendResponse(res, true, 'User updated successfully', result.rows[0]);
  } catch (err) {
    console.error('PATCH /users/:id error:', err);
    sendResponse(res, false, 'Failed to update user', null, 500);
  }
});

// DELETE حذف مستخدم
router.delete('/:id', async (req, res) => {
  try {
    const userid = parseInt(req.params.id);
    if (isNaN(userid)) return sendResponse(res, false, 'Invalid userid', null, 400);

    const exists = await sql.query('SELECT 1 FROM users WHERE userid=$1', [userid]);
    if (!exists.rows.length) return sendResponse(res, false, `User with ID ${userid} not found`, null, 404);

    await sql.query('DELETE FROM users WHERE userid=$1', [userid]);
    sendResponse(res, true, 'User deleted successfully');
  } catch (err) {
    console.error('DELETE /users/:id error:', err);
    sendResponse(res, false, 'Failed to delete user', null, 500);
  }
});

module.exports = router;
