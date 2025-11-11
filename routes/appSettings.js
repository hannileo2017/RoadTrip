// routes/appSettings.js
const express = require('express');
const router = express.Router();
const { dbQuery, requireSession, requireRole } = require('../middleware/auth');

// =====================
// Helper للردود
// =====================
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({
    success,
    message,
    timestamp: new Date(),
    data
  });
}

// =====================
// GET جميع الإعدادات مع Pagination + Search
// =====================
router.get('/', requireSession, async (req, res) => {
  try {
    let { page = 1, limit = 20, search = '' } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const offset = (page - 1) * limit;

    const result = await dbQuery(
      `SELECT * FROM appsettings
       WHERE settingname ILIKE $1 OR settingvalue ILIKE $1
       ORDER BY updatedat DESC
       LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset]
    );

    const totalCountResult = await dbQuery(
      `SELECT COUNT(*)::int AS total FROM appsettings
       WHERE settingname ILIKE $1 OR settingvalue ILIKE $1`,
      [`%${search}%`]
    );

    sendResponse(res, true, 'Settings retrieved successfully', {
      page,
      limit,
      total: totalCountResult[0].total,
      settings: result
    });
  } catch (err) {
    console.error('Error GET /appSettings:', err);
    sendResponse(res, false, 'Failed to retrieve settings', null, 500);
  }
});

// =====================
// GET إعداد واحد حسب الاسم
// =====================
router.get('/:name', requireSession, async (req, res) => {
  try {
    const { name } = req.params;
    const result = await dbQuery(
      `SELECT * FROM appsettings WHERE settingname = $1`,
      [name]
    );

    if (!result.length) return sendResponse(res, false, `Setting "${name}" not found`, null, 404);

    sendResponse(res, true, 'Setting retrieved successfully', result[0]);
  } catch (err) {
    console.error('Error GET /appSettings/:name', err);
    sendResponse(res, false, 'Failed to retrieve setting', null, 500);
  }
});

// =====================
// POST لإضافة أو تحديث إعداد (Admin/Manager فقط)
// =====================
router.post('/', requireSession, requireRole(['Admin', 'Manager']), async (req, res) => {
  try {
    const { settingName, settingValue } = req.body;
    if (!settingName) return sendResponse(res, false, 'settingName is required', null, 400);

    const exists = await dbQuery(
      `SELECT * FROM appsettings WHERE settingname = $1`,
      [settingName]
    );

    if (exists.length) {
      await dbQuery(
        `UPDATE appsettings
         SET settingvalue = $1, updatedat = NOW()
         WHERE settingname = $2`,
        [settingValue || '', settingName]
      );
      sendResponse(res, true, `Setting "${settingName}" updated successfully`);
    } else {
      await dbQuery(
        `INSERT INTO appsettings(settingname, settingvalue, updatedat)
         VALUES($1, $2, NOW())`,
        [settingName, settingValue || '']
      );
      sendResponse(res, true, `Setting "${settingName}" added successfully`);
    }
  } catch (err) {
    console.error('Error POST /appSettings', err);
    sendResponse(res, false, 'Failed to add/update setting', null, 500);
  }
});

// =====================
// PATCH لتحديث قيمة إعداد فقط (Admin/Manager فقط)
// =====================
router.patch('/:name', requireSession, requireRole(['Admin', 'Manager']), async (req, res) => {
  try {
    const { settingValue } = req.body;
    if (settingValue === undefined) return sendResponse(res, false, 'settingValue is required', null, 400);

    const { name } = req.params;
    const exists = await dbQuery(
      `SELECT * FROM appsettings WHERE settingname = $1`,
      [name]
    );

    if (!exists.length) return sendResponse(res, false, `Setting "${name}" not found`, null, 404);

    await dbQuery(
      `UPDATE appsettings
       SET settingvalue = $1, updatedat = NOW()
       WHERE settingname = $2`,
      [settingValue, name]
    );

    sendResponse(res, true, `Setting "${name}" value updated successfully`);
  } catch (err) {
    console.error('Error PATCH /appSettings/:name', err);
    sendResponse(res, false, 'Failed to update setting', null, 500);
  }
});

// =====================
// DELETE إعداد حسب ID أو الاسم (Admin/Manager فقط)
// =====================
router.delete('/:id', requireSession, requireRole(['Admin', 'Manager']), async (req, res) => {
  try {
    const id = req.params.id;

    const exists = await dbQuery(
      `SELECT * FROM appsettings 
       WHERE settingid::text = $1 OR settingname = $1`,
      [id]
    );

    if (!exists.length) return sendResponse(res, false, `Setting "${id}" not found`, null, 404);

    await dbQuery(
      `DELETE FROM appsettings 
       WHERE settingid::text = $1 OR settingname = $1`,
      [id]
    );

    sendResponse(res, true, `Setting "${id}" deleted successfully`);
  } catch (err) {
    console.error('Error DELETE /appSettings/:id', err);
    sendResponse(res, false, 'Failed to delete setting', null, 500);
  }
});

module.exports = router;
