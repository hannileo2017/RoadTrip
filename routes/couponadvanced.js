// routes/couponadvanced.js
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
// Validation helpers
// =====================
function isValidNumber(v) { return v !== undefined && v !== null && !Number.isNaN(Number(v)); }
function isNonNegativeNumber(v) { return isValidNumber(v) && Number(v) >= 0; }
function isIntegerValue(v) { return v !== undefined && v !== null && Number.isInteger(Number(v)); }

// =====================
// GET جميع couponadvanced
// =====================
router.get('/', requireSession, async (req, res) => {
  try {
    let { page = 1, limit = 20, couponid, appliestoreid } = req.query;
    page = parseInt(page) || 1;
    limit = Math.min(parseInt(limit) || 20, 100);
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    let idx = 1;

    if (couponid !== undefined) { where.push(`couponid = $${idx++}`); params.push(couponid); }
    if (appliestoreid !== undefined) { where.push(`appliestoreid = $${idx++}`); params.push(appliestoreid); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const query = `SELECT * FROM couponadvanced ${whereSql} ORDER BY createdat DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const rows = await dbQuery(query, params);

    const totalParams = params.slice(0, params.length - 2);
    const countQuery = `SELECT COUNT(*)::int AS total FROM couponadvanced ${whereSql}`;
    const totalResult = await dbQuery(countQuery, totalParams);

    sendResponse(res, true, 'CouponAdvanced list retrieved', {
      page,
      limit,
      total: totalResult[0] ? totalResult[0].total : 0,
      items: rows
    });
  } catch (err) {
    console.error('Error GET /couponadvanced:', err);
    sendResponse(res, false, 'Failed to retrieve couponadvanced records', null, 500);
  }
});

// =====================
// GET سجل واحد حسب advancedid
// =====================
router.get('/:id', requireSession, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbQuery(`SELECT * FROM couponadvanced WHERE advancedid = $1`, [id]);
    if (!result.length) {
      console.warn(`Unauthorized access attempt to couponadvanced ID ${id} by user ${req.user?.username || 'unknown'}`);
      return sendResponse(res, false, `couponadvanced ${id} not found`, null, 404);
    }
    sendResponse(res, true, 'CouponAdvanced retrieved', result[0]);
  } catch (err) {
    console.error('Error GET /couponadvanced/:id', err);
    sendResponse(res, false, 'Failed to retrieve couponadvanced', null, 500);
  }
});

// =====================
// POST إنشاء couponadvanced جديد (Admin/Manager)
// =====================
router.post('/', requireSession, requireRole(['Admin','Manager']), async (req, res) => {
  try {
    const { couponid, minimumAmount, maxDiscount, appliestoreid } = req.body;

    if (couponid === undefined || minimumAmount === undefined || maxDiscount === undefined) {
      return sendResponse(res, false, 'couponid, minimumAmount and maxDiscount are required', null, 400);
    }
    if (!isIntegerValue(couponid)) return sendResponse(res, false, 'couponid must be integer', null, 400);
    if (!isNonNegativeNumber(minimumAmount)) return sendResponse(res, false, 'minimumAmount must be non-negative', null, 400);
    if (!isNonNegativeNumber(maxDiscount)) return sendResponse(res, false, 'maxDiscount must be non-negative', null, 400);
    if (appliestoreid !== undefined && !isIntegerValue(appliestoreid))
      return sendResponse(res, false, 'appliestoreid must be integer if provided', null, 400);

    const couponExists = await dbQuery(`SELECT 1 FROM coupon WHERE couponid = $1 LIMIT 1`, [couponid]);
    if (!couponExists.length) return sendResponse(res, false, `Referenced coupon ${couponid} does not exist`, null, 400);

    if (appliestoreid !== undefined) {
      const storeExists = await dbQuery(`SELECT 1 FROM stores WHERE storeid = $1 LIMIT 1`, [appliestoreid]);
      if (!storeExists.length) return sendResponse(res, false, `Store ${appliestoreid} does not exist`, null, 400);
    }

    const insertResult = await dbQuery(
      `INSERT INTO couponadvanced (couponid, minimumamount, maxdiscount, appliestoreid, createdat, updatedat)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
      [couponid, minimumAmount, maxDiscount, appliestoreid || null]
    );

    sendResponse(res, true, 'CouponAdvanced created successfully', insertResult[0], 201);
  } catch (err) {
    console.error('Error POST /couponadvanced:', err);
    sendResponse(res, false, 'Failed to create couponadvanced', null, 500);
  }
});

// =====================
// PATCH لتحديث couponadvanced (Admin/Manager)
// =====================
router.patch('/:id', requireSession, requireRole(['Admin','Manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { couponid, minimumAmount, maxDiscount, appliestoreid } = req.body;

    const exists = await dbQuery(`SELECT * FROM couponadvanced WHERE advancedid = $1`, [id]);
    if (!exists.length) return sendResponse(res, false, `couponadvanced ${id} not found`, null, 404);

    const updates = [];
    const params = [];
    let idx = 1;

    if (couponid !== undefined) {
      if (!isIntegerValue(couponid)) return sendResponse(res, false, 'couponid must be integer', null, 400);
      const couponExists = await dbQuery(`SELECT 1 FROM coupon WHERE couponid = $1 LIMIT 1`, [couponid]);
      if (!couponExists.length) return sendResponse(res, false, `Referenced coupon ${couponid} does not exist`, null, 400);
      updates.push(`couponid = $${idx++}`);
      params.push(couponid);
    }

    if (minimumAmount !== undefined) {
      if (!isNonNegativeNumber(minimumAmount)) return sendResponse(res, false, 'minimumAmount must be non-negative', null, 400);
      updates.push(`minimumamount = $${idx++}`);
      params.push(minimumAmount);
    }

    if (maxDiscount !== undefined) {
      if (!isNonNegativeNumber(maxDiscount)) return sendResponse(res, false, 'maxDiscount must be non-negative', null, 400);
      updates.push(`maxdiscount = $${idx++}`);
      params.push(maxDiscount);
    }

    if (appliestoreid !== undefined) {
      if (!isIntegerValue(appliestoreid)) return sendResponse(res, false, 'appliestoreid must be integer', null, 400);
      const storeExists = await dbQuery(`SELECT 1 FROM stores WHERE storeid = $1 LIMIT 1`, [appliestoreid]);
      if (!storeExists.length) return sendResponse(res, false, `Store ${appliestoreid} does not exist`, null, 400);
      updates.push(`appliestoreid = $${idx++}`);
      params.push(appliestoreid);
    }

    if (!updates.length) return sendResponse(res, false, 'Nothing to update', null, 400);

    updates.push(`updatedat = NOW()`);
    params.push(id);

    const result = await dbQuery(
      `UPDATE couponadvanced SET ${updates.join(', ')} WHERE advancedid = $${idx} RETURNING *`,
      params
    );

    sendResponse(res, true, 'CouponAdvanced updated successfully', result[0]);
  } catch (err) {
    console.error('Error PATCH /couponadvanced/:id', err);
    sendResponse(res, false, 'Failed to update couponadvanced', null, 500);
  }
});

// =====================
// DELETE حذف couponadvanced (Admin/Manager)
// =====================
router.delete('/:id', requireSession, requireRole(['Admin','Manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await dbQuery(`SELECT 1 FROM couponadvanced WHERE advancedid = $1 LIMIT 1`, [id]);
    if (!exists.length) return sendResponse(res, false, `couponadvanced ${id} not found`, null, 404);

    await dbQuery(`DELETE FROM couponadvanced WHERE advancedid = $1`, [id]);
    sendResponse(res, true, 'CouponAdvanced deleted successfully');
  } catch (err) {
    console.error('Error DELETE /couponadvanced/:id', err);
    sendResponse(res, false, 'Failed to delete couponadvanced', null, 500);
  }
});

module.exports = router;
