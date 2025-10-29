const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // PostgreSQL client

// دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({
    success,
    message,
    timestamp: new Date(),
    data
  });
}

// 🧾 جلب الكوبونات مع Pagination + بحث + فلترة
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';
    const active = req.query.active;

    let query = `SELECT "CouponID", "CouponCode", "Discount", "Description", "StartDate", "EndDate", "IsActive", "CreatedAt", "UpdatedAt" FROM "coupons" WHERE 1=1`;
    if (search) query += ` AND ("CouponCode" ILIKE ${'%' + search + '%'} OR "Description" ILIKE ${'%' + search + '%'})`;
    if (active !== undefined) query += ` AND "IsActive" = ${active === 'true' ? 'true' : 'false'}`;
    query += ` ORDER BY "CreatedAt" DESC LIMIT ${limit} OFFSET ${offset}`;

    const coupons = await sql(query);

    sendResponse(res, true, 'Coupons retrieved successfully', {
      page,
      limit,
      count: coupons.length,
      coupons
    });
  } catch (err) {
    console.error('Error GET /coupons:', err);
    sendResponse(res, false, 'Failed to retrieve coupons', null, 500);
  }
});

// 🎫 إضافة كوبون جديد
router.post('/', async (req, res) => {
  try {
    let { CouponCode, Discount, Description, StartDate, EndDate, IsActive = true } = req.body;
    if (!CouponCode || !Discount || !StartDate || !EndDate)
      return sendResponse(res, false, 'Missing required fields', null, 400);

    CouponCode = CouponCode.trim();
    Discount = parseFloat(Discount);
    if (isNaN(Discount)) return sendResponse(res, false, 'Discount must be a number', null, 400);
    Description = Description?.trim() || null;

    const exists = await sql`SELECT "CouponID" FROM "coupons" WHERE "CouponCode" = ${CouponCode}`;
    if (exists.length > 0) return sendResponse(res, false, 'Coupon code already exists', null, 409);

    await sql`
      INSERT INTO "Coupons" ("CouponCode", "Discount", "Description", "StartDate", "EndDate", "IsActive", "CreatedAt")
      VALUES (${CouponCode}, ${Discount}, ${Description}, ${StartDate}, ${EndDate}, ${IsActive}, NOW())
    `;

    sendResponse(res, true, 'Coupon added successfully');
  } catch (err) {
    console.error('Error POST /coupons:', err);
    sendResponse(res, false, 'Failed to add coupon', null, 500);
  }
});

// ✏️ تحديث كوبون
router.put('/:CouponID', async (req, res) => {
  try {
    const CouponID = parseInt(req.params.CouponID);
    if (isNaN(CouponID)) return sendResponse(res, false, 'Invalid CouponID', null, 400);

    const updates = req.body;
    if (Object.keys(updates).length === 0) return sendResponse(res, false, 'No fields to update', null, 400);

    const check = await sql`SELECT * FROM "coupons" WHERE "CouponID" = ${CouponID}`;
    if (check.length === 0) return sendResponse(res, false, 'Coupon not found', null, 404);

    const setClauses = [];
    const values = [];
    for (const key of Object.keys(updates)) {
      let val = updates[key];
      switch (key) {
        case 'CouponCode': val = val?.trim(); break;
        case 'Discount': val = parseFloat(val); if (isNaN(val)) continue; break;
        case 'Description': val = val?.trim() || null; break;
        case 'StartDate':
        case 'EndDate':
        case 'IsActive': break;
        default: continue;
      }
      setClauses.push(`"${key}" = ?`);
      values.push(val);
    }

    if (setClauses.length === 0) return sendResponse(res, false, 'No valid fields to update', null, 400);

    values.push(CouponID);
    await sql`
      UPDATE "Coupons"
      SET ${sql(setClauses.join(', '))}, "UpdatedAt" = NOW()
      WHERE "CouponID" = ${CouponID}
    `;

    sendResponse(res, true, 'Coupon updated successfully');
  } catch (err) {
    console.error('Error PUT /coupons/:CouponID:', err);
    sendResponse(res, false, 'Failed to update coupon', null, 500);
  }
});

// 🗑️ حذف كوبون
router.delete('/:CouponID', async (req, res) => {
  try {
    const CouponID = parseInt(req.params.CouponID);
    if (isNaN(CouponID)) return sendResponse(res, false, 'Invalid CouponID', null, 400);

    const check = await sql`SELECT * FROM "coupons" WHERE "CouponID" = ${CouponID}`;
    if (check.length === 0) return sendResponse(res, false, 'Coupon not found', null, 404);

    await sql`DELETE FROM "coupons" WHERE "CouponID" = ${CouponID}`;

    sendResponse(res, true, 'Coupon deleted successfully');
  } catch (err) {
    console.error('Error DELETE /coupons/:CouponID:', err);
    sendResponse(res, false, 'Failed to delete coupon', null, 500);
  }
});

module.exports = router;
