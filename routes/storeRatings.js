const express = require('express');
const router = express.Router();
const sql = require('../db'); // الاتصال بقاعدة بيانات PostgreSQL

// ==========================
// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// 📍 عرض كل تقييمات المتاجر
router.get('/', async (req, res) => {
  try {
    const result = await sql.query(`
      SELECT * FROM "store_rating"
      ORDER BY "createdat" DESC;
    `);

    sendResponse(res, true, 'Store ratings fetched successfully', { count: result.rows.length, ratings: result.rows });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 عرض تقييم محدد
router.get('/:ratingid', async (req, res) => {
  const { ratingid } = req.params;
  try {
    const result = await sql.query(`SELECT * FROM "store_rating" WHERE "ratingid" = $1;`, [ratingid]);
    if (!result.rows.length) return sendResponse(res, false, 'Rating not found', null, 404);
    sendResponse(res, true, 'Rating fetched successfully', result.rows[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 إضافة تقييم جديد
router.post('/', async (req, res) => {
  const { storeid, customerid, rating, comment } = req.body;
  if (!storeid || !customerid || rating === undefined) {
    return sendResponse(res, false, 'storeid, customerid, and rating are required', null, 400);
  }

  try {
    const result = await sql.query(`
      INSERT INTO "store_rating" ("storeid", "customerid", "rating", "comment", "createdat")
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *;
    `, [storeid, customerid, rating, comment || null]);

    sendResponse(res, true, 'Store rating created successfully', result.rows[0], 201);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 تحديث تقييم
router.put('/:ratingid', async (req, res) => {
  const { ratingid } = req.params;
  const updateData = req.body;
  const keys = Object.keys(updateData);
  if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

  try {
    const setClauses = keys.map((k, idx) => `"${k}"=$${idx + 1}`).join(', ');
    const values = keys.map(k => updateData[k]);
    values.push(ratingid);

    const result = await sql.query(`
      UPDATE "store_rating"
      SET ${setClauses}
      WHERE "ratingid"=$${values.length}
      RETURNING *;
    `, values);

    if (!result.rows.length) return sendResponse(res, false, 'Rating not found', null, 404);
    sendResponse(res, true, 'Store rating updated successfully', result.rows[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 حذف تقييم
router.delete('/:ratingid', async (req, res) => {
  const { ratingid } = req.params;
  try {
    const result = await sql.query(`
      DELETE FROM "store_rating"
      WHERE "ratingid"=$1
      RETURNING *;
    `, [ratingid]);

    if (!result.rows.length) return sendResponse(res, false, 'Rating not found', null, 404);
    sendResponse(res, true, 'Store rating deleted successfully', result.rows[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
