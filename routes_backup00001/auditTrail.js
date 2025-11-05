
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // PostgreSQL client

// 🔧 دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({
    success,
    message,
    timestamp: new Date(),
    data
  });
}

// 📜 جلب جميع السجلات مع خيارات التصفية والبحث
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const userId = req.query.userId ? parseInt(req.query.userId) : null;
    const table = req.query.table || '';
    const from = req.query.from || null;
    const to = req.query.to || null;

    let whereClauses = ['TRUE'];
    let params = [];

    if (search) {
      whereClauses.push(`(A."Action" ILIKE $${params.length + 1} OR A."TableAffected" ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (userId) {
      whereClauses.push(`A."UserID" = $${params.length + 1}`);
      params.push(userId);
    }
    if (table) {
      whereClauses.push(`A."TableAffected" = $${params.length + 1}`);
      params.push(table);
    }
    if (from && to) {
      whereClauses.push(`A."Timestamp" BETWEEN $${params.length + 1} AND $${params.length + 2}`);
      params.push(from, to);
    }

    const query = `
      SELECT a.*, u."FullName" AS "UserName"
      FROM "audittrail" A
      LEFT JOIN "users" U ON a."UserID" = U."ID"
      WHERE ${whereclauses.join(' AND ')}
      ORDER BY A."Timestamp" DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query, params);

    sendResponse(res, true, 'Audit logs retrieved successfully', {
      page,
      limit,
      count: result.length,
      logs: result
    });
  } catch (err) {
    console.error('Error GET /auditTrail:', err);
    sendResponse(res, false, 'Failed to retrieve audit logs', null, 500);
  }
});

// 📜 جلب سجل محدد حسب ID
router.get('/:id', async (req, res) => {
  try {
    const LogID = parseInt(req.params.id);
    if (isNaN(LogID)) return sendResponse(res, false, 'Invalid LogID', null, 400);

    const result = await sql.query(`
      SELECT a.*, u."FullName" AS "UserName"
      FROM "audittrail" A
      LEFT JOIN "users" U ON a."UserID" = U."ID"
      WHERE a."LogID" = $1
    `, [/* add params here */]);

    if (!result.length)
      return sendResponse(res, false, `Audit log with ID ${LogID} not found`, null, 404);

    sendResponse(res, true, 'Audit log retrieved successfully', result[0]);
  } catch (err) {
    console.error('Error GET /auditTrail/:id', err);
    sendResponse(res, false, 'Failed to retrieve audit log', null, 500);
  }
});

// 🧩 إنشاء سجل جديد
router.post('/', async (req, res) => {
  try {
    const UserID = parseInt(req.body.UserID);
    const { Action, TableAffected, RecordID } = req.body;

    if (!UserID || !Action || !TableAffected)
      return sendResponse(res, false, 'Missing required fields', null, 400);

    await sql.query(`
      INSERT INTO "AuditTrail" ("UserID","Action","TableAffected","RecordID","Timestamp")
      VALUES ($1, $2, $3, $4, NOW())
    `, [/* add params here */]);

    sendResponse(res, true, 'Audit log created successfully');
  } catch (err) {
    console.error('Error POST /auditTrail:', err);
    sendResponse(res, false, 'Failed to create audit log', null, 500);
  }
});

// ✏️ تعديل سجل موجود
router.put('/:id', async (req, res) => {
  try {
    const LogID = parseInt(req.params.id);
    if (isNaN(LogID)) return sendResponse(res, false, 'Invalid LogID', null, 400);

    const UserID = parseInt(req.body.UserID);
    const { Action, TableAffected, RecordID, Timestamp } = req.body;

    if (!UserID || !Action || !TableAffected)
      return sendResponse(res, false, 'Missing required fields', null, 400);

    const exists = await sql.query(`
      SELECT * FROM "audittrail" WHERE "LogID" = $1
    `, [/* add params here */]);

    if (!exists.length)
      return sendResponse(res, false, `Audit log with ID ${LogID} not found`, null, 404);

    await sql.query(`
      UPDATE "AuditTrail"
      SET "UserID"=$1, "Action"=$2, "TableAffected"=$3,
          "RecordID"=$4, "Timestamp"=$5
      WHERE "LogID"=$6
    `, [/* add params here */]);

    sendResponse(res, true, 'Audit log updated successfully');
  } catch (err) {
    console.error('Error PUT /auditTrail/:id:', err);
    sendResponse(res, false, 'Failed to update audit log', null, 500);
  }
});

// 🗑️ حذف سجل
router.delete('/:id', async (req, res) => {
  try {
    const LogID = parseInt(req.params.id);
    if (isNaN(LogID)) return sendResponse(res, false, 'Invalid LogID', null, 400);

    const exists = await sql.query(`
      SELECT * FROM "audittrail" WHERE "LogID"=$1
    `, [/* add params here */]);

    if (!exists.length)
      return sendResponse(res, false, `Audit log with ID ${LogID} not found`, null, 404);

    await sql.query(`
      DELETE FROM "audittrail" WHERE "LogID"=$1
    `, [/* add params here */]);

    sendResponse(res, true, 'Audit log deleted successfully');
  } catch (err) {
    console.error('Error DELETE /auditTrail/:id:', err);
    sendResponse(res, false, 'Failed to delete audit log', null, 500);
  }
});

module.exports = router;

// --- auto-added init shim (safe) ---
try {
  if (!module.exports) module.exports = router;
} catch(e) {}

if (!module.exports.init) {
  module.exports.init = function initRoute(opts = {}) {
    try {
      if (opts.supabaseKey && !supabase && SUPABASE_URL) {
        try {
          
          supabase = createClient(SUPABASE_URL, opts.supabaseKey);
        } catch(err) { /* ignore */ }
      }
    } catch(err) { /* ignore */ }
    return module.exports;
  };
}
