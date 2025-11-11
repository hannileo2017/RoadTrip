const express = require('express');
const router = express.Router();
const sql = require('../db'); // الاتصال بقاعدة بيانات PostgreSQL

// ==========================
// دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
  res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// 📍 جلب كل العناصر مع Pagination + فلترة
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 50, orderId = '', productId = '' } = req.query;
    page = parseInt(page); 
    limit = parseInt(limit);
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];

    if (orderId) {
      params.push(`%${orderId}%`);
      where.push(`"orderid" ILIKE $${params.length}`);
    }
    if (productId) {
      params.push(parseInt(productId));
      where.push(`"productid" = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await sql.query(`
      SELECT "orderitemid", "orderid", "productid", "quantity", "price"
      FROM "order_items"
      ${whereClause}
      ORDER BY "orderitemid" ASC
      OFFSET $${params.length + 1} LIMIT $${params.length + 2};
    `, [...params, offset, limit]);

    sendResponse(res, true, 'Order items fetched successfully', {
      page,
      limit,
      count: result.rows.length,
      items: result.rows
    });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 إضافة عنصر جديد
router.post('/', async (req, res) => {
  try {
    const { orderid, productid, quantity, price } = req.body;
    if (!orderid || !productid || quantity === undefined || price === undefined) 
      return sendResponse(res, false, 'All fields are required', null, 400);

    const result = await sql.query(`
      INSERT INTO "order_items" ("orderid","productid","quantity","price")
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `, [orderid, productid, quantity, price]);

    sendResponse(res, true, 'Order item created successfully', result.rows[0], 201);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 تحديث عنصر
router.put('/:orderitemid', async (req, res) => {
  try {
    const { orderitemid } = req.params;
    const updates = req.body;
    const keys = Object.keys(updates);
    if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

    // بناء SET dynamically
    const setClauses = keys.map((k, idx) => `"${k}"=$${idx + 1}`).join(', ');
    const values = keys.map(k => updates[k]);
    values.push(orderitemid);

    const result = await sql.query(`
      UPDATE "order_items"
      SET ${setClauses}
      WHERE "orderitemid" = $${values.length}
      RETURNING *;
    `, values);

    if (!result.rows.length) return sendResponse(res, false, 'Order item not found', null, 404);
    sendResponse(res, true, 'Order item updated successfully', result.rows[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 حذف عنصر
router.delete('/:orderitemid', async (req, res) => {
  try {
    const { orderitemid } = req.params;
    const result = await sql.query(`
      DELETE FROM "order_items"
      WHERE "orderitemid"=$1
      RETURNING *;
    `, [orderitemid]);

    if (!result.rows.length) return sendResponse(res, false, 'Order item not found', null, 404);
    sendResponse(res, true, 'Order item deleted successfully', result.rows[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
