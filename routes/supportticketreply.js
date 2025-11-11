const express = require('express');
const router = express.Router();
const sql = require('../db');

// 🧩 دالة رد موحدة
function sendResponse(res, success, message, data = null, status = 200) {
  res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// 📍 1. جلب جميع الردود لتذكرة محددة
router.get('/ticket/:ticketid', async (req, res) => {
  const { ticketid } = req.params;
  try {
    const result = await sql.query(
      `SELECT * FROM "supportticketreply" WHERE "ticketid" = $1 ORDER BY "createdat" ASC`,
      [ticketid]
    );

    if (result.rows.length === 0)
      return sendResponse(res, false, 'No replies found for this ticket', [], 404);

    sendResponse(res, true, 'Replies fetched successfully', {
      count: result.rows.length,
      replies: result.rows
    });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 2. إضافة رد جديد على تذكرة
router.post('/', async (req, res) => {
  const { ticketid, userid, usertype, message } = req.body;

  if (!ticketid || !message)
    return sendResponse(res, false, 'ticketid and message are required', null, 400);

  try {
    const result = await sql.query(
      `INSERT INTO "supportticketreply" ("ticketid", "userid", "usertype", "message", "createdat")
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [ticketid, userid || null, usertype || null, message]
    );

    sendResponse(res, true, 'Reply added successfully', result.rows[0], 201);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 3. حذف رد معين
router.delete('/:replyid', async (req, res) => {
  const { replyid } = req.params;
  try {
    const result = await sql.query(
      `DELETE FROM "supportticketreply" WHERE "replyid" = $1 RETURNING *`,
      [replyid]
    );

    if (result.rows.length === 0)
      return sendResponse(res, false, 'Reply not found', null, 404);

    sendResponse(res, true, 'Reply deleted successfully', result.rows[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
