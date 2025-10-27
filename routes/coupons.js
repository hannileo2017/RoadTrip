const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// 📦 دالة مساعدة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({
    success,
    message,
    timestamp: new Date(),
    data
  });
}

// 🧾 جلب كل الكوبونات (مع بحث + Pagination + فلترة)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', active } = req.query;
    const offset = (page - 1) * limit;

    const pool = await poolPromise;
    const request = pool.request();

    let where = 'WHERE 1=1';
    if (search) {
      request.input('Search', `%${search}%`);
      where += ' AND (CouponCode LIKE @Search OR Description LIKE @Search)';
    }
    if (active !== undefined) {
      request.input('IsActive', active === 'true' ? 1 : 0);
      where += ' AND IsActive = @IsActive';
    }

    const query = `
      SELECT CouponID, CouponCode, Discount, Description, StartDate, EndDate, IsActive, CreatedAt, UpdatedAt
      FROM Coupons
      ${where}
      ORDER BY CreatedAt DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
    `;

    const result = await request.query(query);
    sendResponse(res, true, 'Coupons retrieved successfully', {
      count: result.recordset.length,
      coupons: result.recordset
    });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// 🎫 إضافة كوبون جديد
router.post('/', async (req, res) => {
  try {
    const { CouponCode, Discount, Description, StartDate, EndDate, IsActive = true } = req.body;

    if (!CouponCode || !Discount || !StartDate || !EndDate) {
      return sendResponse(res, false, 'Missing required fields', null, 400);
    }

    const pool = await poolPromise;
    const request = pool.request().input('CouponCode', CouponCode.trim());

    // 🔍 تحقق من التكرار
    const exists = await request.query('SELECT CouponID FROM Coupons WHERE CouponCode=@CouponCode');
    if (exists.recordset.length > 0) {
      return sendResponse(res, false, 'Coupon code already exists', null, 409);
    }

    await pool.request()
      .input('CouponCode', sql.NVarChar(100), CouponCode.trim())
      .input('Discount', sql.Decimal(5, 2), Discount)
      .input('Description', sql.NVarChar(400), Description || null)
      .input('StartDate', sql.DateTime, StartDate)
      .input('EndDate', sql.DateTime, EndDate)
      .input('IsActive', sql.Bit, IsActive)
      .query(`
        INSERT INTO Coupons (CouponCode, Discount, Description, StartDate, EndDate, IsActive, CreatedAt)
        VALUES (@CouponCode, @Discount, @Description, @StartDate, @EndDate, @IsActive, GETDATE())
      `);

    sendResponse(res, true, 'Coupon added successfully');
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ✏️ تحديث كوبون موجود
router.put('/:CouponID', async (req, res) => {
  try {
    const { CouponID } = req.params;
    const updates = req.body;
    const keys = Object.keys(updates);

    if (keys.length === 0)
      return sendResponse(res, false, 'No fields to update', null, 400);

    const pool = await poolPromise;
    const check = await pool.request().input('CouponID', sql.Int, CouponID)
      .query('SELECT * FROM Coupons WHERE CouponID=@CouponID');

    if (check.recordset.length === 0)
      return sendResponse(res, false, 'Coupon not found', null, 404);

    const request = pool.request().input('CouponID', sql.Int, CouponID);
    const setClauses = [];

    keys.forEach(key => {
      const val = updates[key];
      switch (key) {
        case 'CouponCode': request.input(key, sql.NVarChar(100), val); break;
        case 'Discount': request.input(key, sql.Decimal(5, 2), val); break;
        case 'Description': request.input(key, sql.NVarChar(400), val); break;
        case 'StartDate': request.input(key, sql.DateTime, val); break;
        case 'EndDate': request.input(key, sql.DateTime, val); break;
        case 'IsActive': request.input(key, sql.Bit, val); break;
        default: return;
      }
      setClauses.push(`${key}=@${key}`);
    });

    const updateQuery = `
      UPDATE Coupons
      SET ${setClauses.join(', ')}, UpdatedAt=GETDATE()
      WHERE CouponID=@CouponID;
    `;

    await request.query(updateQuery);
    sendResponse(res, true, 'Coupon updated successfully');
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// 🗑️ حذف كوبون
router.delete('/:CouponID', async (req, res) => {
  try {
    const { CouponID } = req.params;
    const pool = await poolPromise;

    const check = await pool.request().input('CouponID', sql.Int, CouponID)
      .query('SELECT * FROM Coupons WHERE CouponID=@CouponID');
    if (check.recordset.length === 0)
      return sendResponse(res, false, 'Coupon not found', null, 404);

    await pool.request().input('CouponID', sql.Int, CouponID)
      .query('DELETE FROM Coupons WHERE CouponID=@CouponID');

    sendResponse(res, true, 'Coupon deleted successfully');
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
