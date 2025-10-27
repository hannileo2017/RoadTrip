const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة موحدة للردود
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({
    success,
    message,
    timestamp: new Date(),
    data
  });
}

// ---------------------------
// GET / - قائمة الكوبونات مع بحث/فلترة/pagination
// ---------------------------
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 20, search = '', discountType, validOnly } = req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 20;
    const offset = (page - 1) * limit;

    const pool = await poolPromise;
    const request = pool.request();

    // بنية WHERE ديناميكية وآمنة
    let where = 'WHERE 1=1';
    if (search) {
      request.input('Search', `%${search}%`);
      where += ' AND (Code LIKE @Search OR Description LIKE @Search)';
    }
    if (discountType) {
      request.input('DiscountType', discountType);
      where += ' AND DiscountType = @DiscountType';
    }
    if (validOnly === 'true') {
      // كوبونات صالحة الآن: تاريخ البداية <= الآن <= تاريخ الانتهاء و (MaxUsage = 0 OR UsageCount < MaxUsage)
      where += ' AND StartDate <= GETDATE() AND EndDate >= GETDATE() AND (MaxUsage = 0 OR UsageCount < MaxUsage)';
    }

    const query = `
      SELECT CouponID, Code, DiscountType, DiscountValue, StartDate, EndDate, MinOrderAmount, MaxUsage, UsageCount, CreatedAt, UpdatedAt
      FROM CouponsAdvanced
      ${where}
      ORDER BY StartDate DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
    `;

    const result = await request.query(query);

    sendResponse(res, true, 'CouponsAdvanced retrieved successfully', {
      page,
      limit,
      count: result.recordset.length,
      coupons: result.recordset
    });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ---------------------------
// GET /:id - جلب كوبون حسب ID
// ---------------------------
router.get('/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('CouponID', sql.Int, req.params.id)
      .query('SELECT * FROM CouponsAdvanced WHERE CouponID = @CouponID');

    if (!result.recordset.length) return sendResponse(res, false, 'Coupon not found', null, 404);
    sendResponse(res, true, 'Coupon retrieved successfully', result.recordset[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ---------------------------
// GET /validate/:code?orderAmount=xx
// تحقق سريع بصلاحية الكوبون (تاريخ، استخدامات، مبلغ الطلب الأدنى)
// ---------------------------
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const orderAmount = parseFloat(req.query.orderAmount || 0);

    const pool = await poolPromise;
    const result = await pool.request()
      .input('Code', code)
      .query(`SELECT * FROM CouponsAdvanced WHERE Code = @Code`);

    if (!result.recordset.length) return sendResponse(res, false, 'Coupon not found', null, 404);

    const coupon = result.recordset[0];
    const now = new Date();

    if (coupon.StartDate && new Date(coupon.StartDate) > now)
      return sendResponse(res, false, 'Coupon not active yet', null, 400);

    if (coupon.EndDate && new Date(coupon.EndDate) < now)
      return sendResponse(res, false, 'Coupon expired', null, 400);

    if (coupon.MaxUsage && coupon.MaxUsage > 0 && coupon.UsageCount >= coupon.MaxUsage)
      return sendResponse(res, false, 'Coupon usage limit reached', null, 400);

    if (coupon.MinOrderAmount && parseFloat(coupon.MinOrderAmount) > orderAmount)
      return sendResponse(res, false, `Minimum order amount not met. Minimum: ${coupon.MinOrderAmount}`, null, 400);

    // إذا وصل هنا، الصلاحية جيدة
    sendResponse(res, true, 'Coupon is valid', { coupon });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ---------------------------
// POST / - إنشاء كوبون جديد (يتحقق من التكرار)
// ---------------------------
router.post('/', async (req, res) => {
  try {
    const { Code, DiscountType, DiscountValue, StartDate, EndDate, MinOrderAmount = 0, MaxUsage = 0 } = req.body;

    if (!Code || !DiscountType || (DiscountValue === undefined || DiscountValue === null) || !StartDate || !EndDate) {
      return sendResponse(res, false, 'Missing required fields: Code, DiscountType, DiscountValue, StartDate, EndDate', null, 400);
    }

    const pool = await poolPromise;

    // تحقق من وجود كود مطابق
    const exists = await pool.request()
      .input('Code', Code.trim())
      .query('SELECT CouponID FROM CouponsAdvanced WHERE Code = @Code');

    if (exists.recordset.length) return sendResponse(res, false, 'Coupon code already exists', null, 409);

    await pool.request()
      .input('Code', sql.NVarChar(100), Code.trim())
      .input('DiscountType', sql.NVarChar(40), DiscountType)
      .input('DiscountValue', sql.Decimal(18, 4), DiscountValue)
      .input('StartDate', sql.DateTime, StartDate)
      .input('EndDate', sql.DateTime, EndDate)
      .input('MinOrderAmount', sql.Decimal(18, 4), MinOrderAmount)
      .input('MaxUsage', sql.Int, MaxUsage)
      .query(`
        INSERT INTO CouponsAdvanced
          (Code, DiscountType, DiscountValue, StartDate, EndDate, MinOrderAmount, MaxUsage, UsageCount, CreatedAt)
        VALUES
          (@Code, @DiscountType, @DiscountValue, @StartDate, @EndDate, @MinOrderAmount, @MaxUsage, 0, GETDATE())
      `);

    sendResponse(res, true, 'CouponAdvanced created successfully');
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ---------------------------
// PUT /:id - تحديث كوبون (مسموح الحقول المحددة فقط)
// ---------------------------
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const allowed = {
      Code: sql.NVarChar(100),
      DiscountType: sql.NVarChar(40),
      DiscountValue: sql.Decimal(18, 4),
      StartDate: sql.DateTime,
      EndDate: sql.DateTime,
      MinOrderAmount: sql.Decimal(18, 4),
      MaxUsage: sql.Int,
      UsageCount: sql.Int,
      Description: sql.NVarChar(400)
    };

    const keys = Object.keys(updates).filter(k => Object.keys(allowed).includes(k));
    if (!keys.length) return sendResponse(res, false, 'No updatable fields provided', null, 400);

    const pool = await poolPromise;

    // تحقق من وجود السجل
    const check = await pool.request().input('CouponID', sql.Int, id).query('SELECT * FROM CouponsAdvanced WHERE CouponID = @CouponID');
    if (!check.recordset.length) return sendResponse(res, false, 'Coupon not found', null, 404);

    // تحقق إن كان يتم تغيير الكود ويصطدم بكود آخر
    if (keys.includes('Code')) {
      const dup = await pool.request()
        .input('Code', sql.NVarChar(100), updates.Code)
        .input('CouponID', sql.Int, id)
        .query('SELECT CouponID FROM CouponsAdvanced WHERE Code = @Code AND CouponID <> @CouponID');
      if (dup.recordset.length) return sendResponse(res, false, 'Another coupon with this code exists', null, 409);
    }

    // تجهيز الطلب
    const request = pool.request().input('CouponID', sql.Int, id);
    const setClauses = [];
    keys.forEach(k => {
      request.input(k, allowed[k], updates[k]);
      setClauses.push(`${k} = @${k}`);
    });

    const updateQuery = `
      UPDATE CouponsAdvanced
      SET ${setClauses.join(', ')}, UpdatedAt = GETDATE()
      WHERE CouponID = @CouponID
    `;
    await request.query(updateQuery);

    sendResponse(res, true, 'CouponAdvanced updated successfully');
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ---------------------------
// PATCH /:id/increment - زيادة UsageCount بشكل آمن (transactional)
// يستخدم هذا المسار لاحتساب استهلاك الكوبون عند تطبيقه فعليًا
// ---------------------------
router.patch('/:id/increment', async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    const couponId = parseInt(req.params.id);
    if (!couponId) return sendResponse(res, false, 'Invalid coupon id', null, 400);

    await transaction.begin();
    const trRequest = new sql.Request(transaction);

    // جلب السجل لقفل الصفّ (باستخدام UPDLOCK إذا لزم)
    const selectQ = `SELECT * FROM CouponsAdvanced WITH (UPDLOCK, HOLDLOCK) WHERE CouponID = @CouponID`;
    const selectRes = await trRequest.input('CouponID', sql.Int, couponId).query(selectQ);
    if (!selectRes.recordset.length) {
      await transaction.rollback();
      return sendResponse(res, false, 'Coupon not found', null, 404);
    }

    const coupon = selectRes.recordset[0];
    const now = new Date();

    if (coupon.StartDate && new Date(coupon.StartDate) > now) {
      await transaction.rollback();
      return sendResponse(res, false, 'Coupon not active yet', null, 400);
    }
    if (coupon.EndDate && new Date(coupon.EndDate) < now) {
      await transaction.rollback();
      return sendResponse(res, false, 'Coupon expired', null, 400);
    }
    if (coupon.MaxUsage && coupon.MaxUsage > 0 && coupon.UsageCount >= coupon.MaxUsage) {
      await transaction.rollback();
      return sendResponse(res, false, 'Coupon usage limit reached', null, 400);
    }

    // زيادة العداد
    const newUsage = (coupon.UsageCount || 0) + 1;
    await trRequest.input('NewUsage', sql.Int, newUsage)
      .input('CouponID', sql.Int, couponId)
      .query('UPDATE CouponsAdvanced SET UsageCount = @NewUsage, UpdatedAt = GETDATE() WHERE CouponID = @CouponID');

    await transaction.commit();
    sendResponse(res, true, 'Coupon usage incremented successfully', { CouponID: couponId, UsageCount: newUsage });
  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    sendResponse(res, false, err.message, null, 500);
  }
});

// ---------------------------
// DELETE /:id - حذف كوبون بعد التحقق
// ---------------------------
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const check = await pool.request().input('CouponID', sql.Int, id).query('SELECT CouponID FROM CouponsAdvanced WHERE CouponID = @CouponID');
    if (!check.recordset.length) return sendResponse(res, false, 'Coupon not found', null, 404);

    await pool.request().input('CouponID', sql.Int, id).query('DELETE FROM CouponsAdvanced WHERE CouponID = @CouponID');
    sendResponse(res, true, 'CouponAdvanced deleted successfully');
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
