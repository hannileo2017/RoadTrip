// routes/driver_rating.js
const express = require('express');
const sql = require('../db');
const router = express.Router();

// ==========================
// ✅ دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// ==========================
// ✅ تحديث متوسط تقييم السائق
async function updateDriverAverageRating(driverId) {
  try {
    const avgResult = await sql.query(
      `SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating 
       FROM driver_rating 
       WHERE driverid = $1;`,
      [driverId]
    );

    const avg = avgResult.rows[0]?.avg_rating || 0;
    await sql.query(`UPDATE drivers SET rating = $1 WHERE driverid = $2;`, [avg, driverId]);
    return avg;
  } catch (err) {
    console.error('⚠️ Error updating driver average rating:', err.message);
    return null;
  }
}

// ==========================
// GET: كل التقييمات مع Pagination + فلترة
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 50, driverId = '' } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const offset = (page - 1) * limit;

    let query = `SELECT * FROM driver_rating`;
    const params = [];

    if (driverId) {
      params.push(`%${driverId}%`);
      query += ` WHERE driverid ILIKE $${params.length}`;
    }

    query += ` ORDER BY createdat DESC LIMIT ${limit} OFFSET ${offset};`;
    const result = await sql.query(query, params);

    let avgRating = null;
    if (driverId) {
      const avgResult = await sql.query(
        `SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating 
         FROM driver_rating WHERE driverid ILIKE $1;`,
        [`%${driverId}%`]
      );
      avgRating = avgResult.rows[0]?.avg_rating || 0;
    }

    sendResponse(res, true, 'Driver ratings fetched successfully', {
      page,
      limit,
      count: result.rows.length,
      avgRating,
      ratings: result.rows
    });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// GET: تقييم واحد حسب ratingid
router.get('/:id', async (req, res) => {
  try {
    const result = await sql.query(`SELECT * FROM driver_rating WHERE ratingid = $1;`, [req.params.id]);
    if (!result.rows.length) return sendResponse(res, false, 'Rating not found', null, 404);
    sendResponse(res, true, 'Rating fetched successfully', result.rows[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// POST: إضافة تقييم جديد مع سجل المحاولات المرفوضة
router.post('/', async (req, res) => {
  const { driverid, customerid, orderid, rating, comment } = req.body;
  if (!driverid || !customerid || !orderid || rating === undefined)
    return sendResponse(res, false, 'DriverID, CustomerID, OrderID and Rating are required', null, 400);

  try {
    // تحقق من التقييم المكرر
    const existing = await sql.query(
      `SELECT 1 FROM driver_rating WHERE driverid=$1 AND customerid=$2 AND orderid=$3;`,
      [driverid, customerid, orderid]
    );

    if (existing.rows.length > 0) {
      await sql.query(
        `INSERT INTO driver_rating_attempts (driverid, customerid, orderid, rating, comment, reason)
         VALUES ($1,$2,$3,$4,$5,$6);`,
        [driverid, customerid, orderid, rating, comment || null, 'Duplicate rating']
      );
      return sendResponse(res, false, 'You have already rated this driver for this order', null, 400);
    }

    // تحقق من صحة التقييم (0-5)
    if (rating < 0 || rating > 5) {
      await sql.query(
        `INSERT INTO driver_rating_attempts (driverid, customerid, orderid, rating, comment, reason)
         VALUES ($1,$2,$3,$4,$5,$6);`,
        [driverid, customerid, orderid, rating, comment || null, 'Invalid rating value']
      );
      return sendResponse(res, false, 'Rating must be between 0 and 5', null, 400);
    }

    // إضافة التقييم الصحيح
    const result = await sql.query(
      `INSERT INTO driver_rating (driverid, customerid, orderid, rating, comment, createdat)
       VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *;`,
      [driverid, customerid, orderid, rating, comment || null]
    );

    const avg = await updateDriverAverageRating(driverid);
    sendResponse(res, true, 'Rating added successfully', { ...result.rows[0], avgRating: avg }, 201);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// PUT: تحديث تقييم
router.put('/:id', async (req, res) => {
  const updates = req.body;
  if (!Object.keys(updates).length) return sendResponse(res, false, 'Nothing to update', null, 400);

  try {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((k, i) => `${k.toLowerCase()} = $${i + 1}`).join(', ');

    const query = `UPDATE driver_rating SET ${setClause} WHERE ratingid = $${keys.length + 1} RETURNING *;`;
    const result = await sql.query(query, [...values, req.params.id]);

    if (!result.rows.length) return sendResponse(res, false, 'Rating not found', null, 404);

    const avg = await updateDriverAverageRating(result.rows[0].driverid);
    sendResponse(res, true, 'Rating updated successfully', { ...result.rows[0], avgRating: avg });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// DELETE: حذف تقييم
router.delete('/:id', async (req, res) => {
  try {
    const result = await sql.query(
      `DELETE FROM driver_rating WHERE ratingid = $1 RETURNING *;`,
      [req.params.id]
    );

    if (!result.rows.length) return sendResponse(res, false, 'Rating not found', null, 404);

    const avg = await updateDriverAverageRating(result.rows[0].driverid);
    sendResponse(res, true, 'Rating deleted successfully', { ...result.rows[0], avgRating: avg });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// GET: سجل المحاولات المرفوضة
router.get('/attempts/list', async (req, res) => {
  try {
    let { page = 1, limit = 50 } = req.query;
    page = parseInt(page);
    limit = Math.min(parseInt(limit), 100);
    const offset = (page - 1) * limit;

    const result = await sql.query(
      `SELECT * FROM driver_rating_attempts
       ORDER BY createdat DESC
       LIMIT $1 OFFSET $2;`,
      [limit, offset]
    );

    const totalResult = await sql.query('SELECT COUNT(*)::int AS total FROM driver_rating_attempts;');
    sendResponse(res, true, 'Driver rating attempts fetched', {
      page,
      limit,
      total: totalResult.rows[0].total,
      attempts: result.rows
    });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
