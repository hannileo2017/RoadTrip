const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');

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
    const { page = 1, limit = 20, search = '', userId, table, from, to } = req.query;
    const offset = (page - 1) * limit;

    const pool = await poolPromise;
    const request = pool.request();

    // المعايير الديناميكية
    let whereClause = 'WHERE 1=1';
    if (search) {
      request.input('Search', `%${search}%`);
      whereClause += ' AND (A.Action LIKE @Search OR A.TableAffected LIKE @Search)';
    }
    if (userId) {
      request.input('UserID', userId);
      whereClause += ' AND A.UserID = @UserID';
    }
    if (table) {
      request.input('TableAffected', table);
      whereClause += ' AND A.TableAffected = @TableAffected';
    }
    if (from && to) {
      request.input('FromDate', from);
      request.input('ToDate', to);
      whereClause += ' AND A.Timestamp BETWEEN @FromDate AND @ToDate';
    }

    const query = `
      SELECT A.*, U.FullName AS UserName
      FROM AuditTrail A
      LEFT JOIN Users U ON A.UserID = U.ID
      ${whereClause}
      ORDER BY A.Timestamp DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
    `;

    const result = await request.query(query);

    sendResponse(res, true, 'Audit logs retrieved successfully', {
      count: result.recordset.length,
      logs: result.recordset
    });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// 📜 جلب سجل محدد حسب ID
router.get('/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('LogID', req.params.id)
      .query(`
        SELECT A.*, U.FullName AS UserName
        FROM AuditTrail A
        LEFT JOIN Users U ON A.UserID = U.ID
        WHERE A.LogID = @LogID
      `);

    if (result.recordset.length === 0)
      return sendResponse(res, false, 'Audit log not found', null, 404);

    sendResponse(res, true, 'Audit log retrieved successfully', result.recordset[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// 🧩 إنشاء سجل جديد
router.post('/', async (req, res) => {
  try {
    const { UserID, Action, TableAffected, RecordID } = req.body;

    if (!UserID || !Action || !TableAffected)
      return sendResponse(res, false, 'Missing required fields', null, 400);

    const pool = await poolPromise;
    await pool.request()
      .input('UserID', UserID)
      .input('Action', Action)
      .input('TableAffected', TableAffected)
      .input('RecordID', RecordID || null)
      .query(`
        INSERT INTO AuditTrail (UserID, Action, TableAffected, RecordID, Timestamp)
        VALUES (@UserID, @Action, @TableAffected, @RecordID, GETDATE());
      `);

    sendResponse(res, true, 'Audit log created successfully');
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ✏️ تعديل سجل موجود
router.put('/:id', async (req, res) => {
  try {
    const { UserID, Action, TableAffected, RecordID, Timestamp } = req.body;
    const pool = await poolPromise;

    // تحقق من وجود السجل
    const check = await pool.request()
      .input('LogID', req.params.id)
      .query('SELECT LogID FROM AuditTrail WHERE LogID=@LogID');
    if (check.recordset.length === 0)
      return sendResponse(res, false, 'Audit log not found', null, 404);

    await pool.request()
      .input('LogID', req.params.id)
      .input('UserID', UserID)
      .input('Action', Action)
      .input('TableAffected', TableAffected)
      .input('RecordID', RecordID || null)
      .input('Timestamp', Timestamp || new Date())
      .query(`
        UPDATE AuditTrail
        SET UserID=@UserID, Action=@Action, TableAffected=@TableAffected,
            RecordID=@RecordID, Timestamp=@Timestamp
        WHERE LogID=@LogID;
      `);

    sendResponse(res, true, 'Audit log updated successfully');
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// 🗑️ حذف سجل
router.delete('/:id', async (req, res) => {
  try {
    const pool = await poolPromise;

    // تحقق من وجود السجل
    const check = await pool.request()
      .input('LogID', req.params.id)
      .query('SELECT LogID FROM AuditTrail WHERE LogID=@LogID');
    if (check.recordset.length === 0)
      return sendResponse(res, false, 'Audit log not found', null, 404);

    await pool.request()
      .input('LogID', req.params.id)
      .query('DELETE FROM AuditTrail WHERE LogID=@LogID');

    sendResponse(res, true, 'Audit log deleted successfully');
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
