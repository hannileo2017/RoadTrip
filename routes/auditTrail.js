// routes/auditTrail.js
const express = require('express');
const router = express.Router();
const { dbQuery, requireSession, requireRole } = require('../middleware/auth');

// =====================
// Helper للردود
// =====================
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// =====================
// GET جميع سجلات الـ AuditTrail مع فلترة وباجينيشن
// =====================
router.get('/', requireSession, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const userId = req.query.userid ? parseInt(req.query.userid) : null;
    const table = req.query.table ? String(req.query.table).trim() : '';
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;

    const whereClauses = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`(a.action ILIKE $${params.length} OR a.tableaffected ILIKE $${params.length})`);
    }
    if (userId) {
      params.push(userId);
      whereClauses.push(`a.userid = $${params.length}`);
    }
    if (table) {
      params.push(table);
      whereClauses.push(`a.tableaffected = $${params.length}`);
    }
    if (from && to) {
      params.push(from, to);
      whereClauses.push(`a.timestamp BETWEEN $${params.length - 1} AND $${params.length}`);
    }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    params.push(limit, offset);

    const query = `
      SELECT 
        a.logid,
        a.userid,
        u.username,
        u.fullname,
        a.action,
        a.tableaffected,
        a.recordid,
        a.timestamp
      FROM audittrail a
      LEFT JOIN users u ON a.userid = u.userid
      ${whereSQL}
      ORDER BY a.timestamp DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await dbQuery(query, params);

    sendResponse(res, true, 'Audit logs retrieved successfully', {
      page,
      limit,
      count: result.length,
      logs: result
    });
  } catch (err) {
    console.error('Error GET /audittrail:', err);
    sendResponse(res, false, 'Failed to retrieve audit logs', null, 500);
  }
});

// =====================
// GET سجل واحد حسب logid
// =====================
router.get('/:id', requireSession, async (req, res) => {
  try {
    const logId = parseInt(req.params.id);
    if (isNaN(logId)) return sendResponse(res, false, 'Invalid logid', null, 400);

    const result = await dbQuery(`
      SELECT 
        a.logid,
        a.userid,
        u.username,
        u.fullname,
        a.action,
        a.tableaffected,
        a.recordid,
        a.timestamp
      FROM audittrail a
      LEFT JOIN users u ON a.userid = u.userid
      WHERE a.logid = $1
      LIMIT 1
    `, [logId]);

    if (!result.length)
      return sendResponse(res, false, `Audit log with ID ${logId} not found`, null, 404);

    sendResponse(res, true, 'Audit log retrieved successfully', result[0]);
  } catch (err) {
    console.error('Error GET /audittrail/:id', err);
    sendResponse(res, false, 'Failed to retrieve audit log', null, 500);
  }
});

// =====================
// POST إنشاء سجل جديد (Admin فقط)
// =====================
router.post('/', requireSession, requireRole(['Admin']), async (req, res) => {
  try {
    const userid = parseInt(req.body.userid);
    const action = req.body.action;
    const tableaffected = req.body.tableaffected;
    const recordid = req.body.recordid !== undefined ? req.body.recordid : null;

    if (!userid || !action || !tableaffected)
      return sendResponse(res, false, 'Missing required fields (userid, action, tableaffected)', null, 400);

    const result = await dbQuery(`
      WITH inserted AS (
        INSERT INTO audittrail (userid, action, tableaffected, recordid, timestamp)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      )
      SELECT i.logid, i.userid, u.username, u.fullname, i.action, i.tableaffected, i.recordid, i.timestamp
      FROM inserted i
      LEFT JOIN users u ON i.userid = u.userid
      LIMIT 1
    `, [userid, action, tableaffected, recordid]);

    sendResponse(res, true, 'Audit log created successfully', result[0], 201);
  } catch (err) {
    console.error('Error POST /audittrail:', err);
    sendResponse(res, false, 'Failed to create audit log', null, 500);
  }
});

// =====================
// PATCH تحديث سجل جزئي (Admin فقط)
// =====================
router.patch('/:id', requireSession, requireRole(['Admin']), async (req, res) => {
  try {
    const logid = parseInt(req.params.id);
    if (isNaN(logid)) return sendResponse(res, false, 'Invalid logid', null, 400);

    const { userid, action, tableaffected, recordid } = req.body;

    const exists = await dbQuery('SELECT 1 FROM audittrail WHERE logid = $1 LIMIT 1', [logid]);
    if (!exists.length) return sendResponse(res, false, `Audit log with ID ${logid} not found`, null, 404);

    const updates = [];
    const params = [];
    let idx = 1;

    if (userid !== undefined) { updates.push(`userid=$${idx++}`); params.push(userid); }
    if (action !== undefined) { updates.push(`action=$${idx++}`); params.push(action); }
    if (tableaffected !== undefined) { updates.push(`tableaffected=$${idx++}`); params.push(tableaffected); }
    if (recordid !== undefined) { updates.push(`recordid=$${idx++}`); params.push(recordid); }

    if (!updates.length) return sendResponse(res, false, 'Nothing to update', null, 400);

    params.push(logid);

    const result = await dbQuery(`
      WITH updated AS (
        UPDATE audittrail
        SET ${updates.join(', ')}
        WHERE logid = $${idx}
        RETURNING *
      )
      SELECT u.logid, u.userid, usr.username, usr.fullname, u.action, u.tableaffected, u.recordid, u.timestamp
      FROM updated u
      LEFT JOIN users usr ON u.userid = usr.userid
      LIMIT 1
    `, params);

    sendResponse(res, true, 'Audit log updated successfully', result[0]);
  } catch (err) {
    console.error('Error PATCH /audittrail/:id', err);
    sendResponse(res, false, 'Failed to update audit log', null, 500);
  }
});

// =====================
// DELETE حذف سجل (Admin فقط)
// =====================
router.delete('/:id', requireSession, requireRole(['Admin']), async (req, res) => {
  try {
    const logid = parseInt(req.params.id);
    if (isNaN(logid)) return sendResponse(res, false, 'Invalid logid', null, 400);

    const exists = await dbQuery('SELECT 1 FROM audittrail WHERE logid = $1 LIMIT 1', [logid]);
    if (!exists.length) return sendResponse(res, false, `Audit log with ID ${logid} not found`, null, 404);

    await dbQuery('DELETE FROM audittrail WHERE logid = $1', [logid]);
    sendResponse(res, true, 'Audit log deleted successfully');
  } catch (err) {
    console.error('Error DELETE /audittrail/:id', err);
    sendResponse(res, false, 'Failed to delete audit log', null, 500);
  }
});

module.exports = router;
