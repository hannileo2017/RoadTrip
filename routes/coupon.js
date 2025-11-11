// routes/coupon.js
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
// GET جميع الكوبونات مع Pagination + Search
// =====================
router.get('/', requireSession, async (req, res) => {
  try {
    let { page = 1, limit = 20, search = '', activeOnly = false } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const offset = (page - 1) * limit;

    let query = `SELECT * FROM coupon WHERE (code ILIKE $1)`;
    const params = [`%${search}%`];

    if (activeOnly === 'true') query += ` AND isactive = true AND expirydate >= NOW()`;

    query += ` ORDER BY expirydate DESC LIMIT $2 OFFSET $3`;
    params.push(limit, offset);

    const result = await dbQuery(query, params);

    // إجمالي العناصر
    let totalQuery = `SELECT COUNT(*)::int AS total FROM coupon WHERE (code ILIKE $1)`;
    const totalParams = [`%${search}%`];
    if (activeOnly === 'true') totalQuery += ` AND isactive = true AND expirydate >= NOW()`;
    const totalCountResult = await dbQuery(totalQuery, totalParams);

    sendResponse(res, true, 'Coupons retrieved successfully', {
      page,
      limit,
      total: totalCountResult[0].total,
      coupons: result
    });
  } catch (err) {
    console.error('Error GET /coupon:', err);
    sendResponse(res, false, 'Failed to retrieve coupons', null, 500);
  }
});

// =====================
// GET كوبون واحد حسب ID
// =====================
router.get('/:id', requireSession, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbQuery(`SELECT * FROM coupon WHERE couponid = $1`, [id]);
    if (!result.length) {
      console.warn(`Unauthorized access attempt to coupon ID ${id} by user ${req.user?.username || 'unknown'}`);
      return sendResponse(res, false, `Coupon ${id} not found`, null, 404);
    }
    sendResponse(res, true, 'Coupon retrieved successfully', result[0]);
  } catch (err) {
    console.error('Error GET /coupon/:id', err);
    sendResponse(res, false, 'Failed to retrieve coupon', null, 500);
  }
});

// =====================
// POST لإنشاء كوبون جديد (Admin/Manager فقط)
// =====================
router.post('/', requireSession, requireRole(['Admin','Manager']), async (req, res) => {
  try {
    const { code, discountPercent, expiryDate, isActive = true } = req.body;

    if (!code || discountPercent === undefined || !expiryDate) {
      return sendResponse(res, false, 'code, discountPercent and expiryDate are required', null, 400);
    }

    if (discountPercent < 0 || discountPercent > 100) {
      return sendResponse(res, false, 'discountPercent must be between 0 and 100', null, 400);
    }

    if (new Date(expiryDate) <= new Date()) {
      return sendResponse(res, false, 'expiryDate must be in the future', null, 400);
    }

    const exists = await dbQuery(`SELECT * FROM coupon WHERE code = $1`, [code]);
    if (exists.length) return sendResponse(res, false, 'Coupon code already exists', null, 400);

    const result = await dbQuery(
      `INSERT INTO coupon(code, discountpercent, expirydate, isactive, updatedat)
       VALUES($1, $2, $3, $4, NOW()) RETURNING *`,
      [code, discountPercent, expiryDate, isActive]
    );

    sendResponse(res, true, 'Coupon created successfully', result[0]);
  } catch (err) {
    console.error('Error POST /coupon', err);
    sendResponse(res, false, 'Failed to create coupon', null, 500);
  }
});

// =====================
// PATCH لتحديث كوبون (Admin/Manager فقط)
// =====================
router.patch('/:id', requireSession, requireRole(['Admin','Manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discountPercent, expiryDate, isActive } = req.body;

    const exists = await dbQuery(`SELECT * FROM coupon WHERE couponid = $1`, [id]);
    if (!exists.length) return sendResponse(res, false, `Coupon ${id} not found`, null, 404);

    const updates = [];
    const params = [];
    let idx = 1;

    if (code) { updates.push(`code = $${idx++}`); params.push(code); }

    if (discountPercent !== undefined) {
      if (discountPercent < 0 || discountPercent > 100) {
        return sendResponse(res, false, 'discountPercent must be between 0 and 100', null, 400);
      }
      updates.push(`discountpercent = $${idx++}`);
      params.push(discountPercent);
    }

    if (expiryDate) {
      if (new Date(expiryDate) <= new Date()) {
        return sendResponse(res, false, 'expiryDate must be in the future', null, 400);
      }
      updates.push(`expirydate = $${idx++}`);
      params.push(expiryDate);
    }

    if (isActive !== undefined) { updates.push(`isactive = $${idx++}`); params.push(isActive); }

    if (!updates.length) return sendResponse(res, false, 'Nothing to update', null, 400);

    updates.push(`updatedat = NOW()`);
    params.push(id);

    const result = await dbQuery(
      `UPDATE coupon SET ${updates.join(', ')} WHERE couponid = $${idx} RETURNING *`,
      params
    );

    sendResponse(res, true, 'Coupon updated successfully', result[0]);
  } catch (err) {
    console.error('Error PATCH /coupon/:id', err);
    sendResponse(res, false, 'Failed to update coupon', null, 500);
  }
});

// =====================
// DELETE كوبون (Admin/Manager فقط)
// =====================
router.delete('/:id', requireSession, requireRole(['Admin','Manager']), async (req, res) => {
  try {
    const { id } = req.params;

    const exists = await dbQuery(`SELECT * FROM coupon WHERE couponid = $1`, [id]);
    if (!exists.length) return sendResponse(res, false, `Coupon ${id} not found`, null, 404);

    await dbQuery(`DELETE FROM coupon WHERE couponid = $1`, [id]);
    sendResponse(res, true, 'Coupon deleted successfully');
  } catch (err) {
    console.error('Error DELETE /coupon/:id', err);
    sendResponse(res, false, 'Failed to delete coupon', null, 500);
  }
});

module.exports = router;
