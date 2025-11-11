// routes/apply-coupon.js
const express = require('express');
const router = express.Router();
const sql = require('../db'); // Pool جاهز للاتصال
const { requireRole, requireSession } = require('../middleware/auth'); // ميدلوير الحماية

// =====================
// Helper للـ DB Query
// =====================
const dbQuery = async (...args) => {
  if (!sql || typeof sql.query !== 'function') throw new Error('DB query function not found');
  const r = await sql.query(...args);
  return (r && r.rows) ? r.rows : r;
};

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
// POST لتطبيق كوبون على طلب مع Realtime
// محمي: يحتاج توكن صالح + العميل فقط يقدر يطبق كوبون على طلبه
// =====================
router.post('/', requireSession, requireRole(['customer']), async (req, res) => {
  try {
    const { OrderID, CouponCode } = req.body;
    const userID = req.user.userid; // ⚡ تعديل هنا

    if (!OrderID || !CouponCode) {
      return sendResponse(res, false, 'OrderID and CouponCode are required', null, 400);
    }

    // جلب الطلب والتأكد أن الطلب تابع للمستخدم
    const orderRes = await dbQuery(
      `SELECT * FROM orders WHERE orderid = $1 AND userid = $2`,
      [OrderID, userID]
    );
    if (!orderRes.length) return sendResponse(res, false, `Order ${OrderID} not found for this user`, null, 404);

    const order = orderRes[0];

    // جلب الكوبون
    const couponRes = await dbQuery(
      `SELECT * FROM coupon 
       WHERE code = $1 AND isactive = true AND expirydate >= NOW()`,
      [CouponCode]
    );
    if (!couponRes.length) return sendResponse(res, false, 'Coupon is invalid or expired', null, 400);

    const coupon = couponRes[0];

    // حساب الخصم
    const discountAmount = parseFloat(order.totalprice) * parseFloat(coupon.discountpercent) / 100;
    const newTotal = parseFloat(order.totalprice) - discountAmount;

    // تحديث الطلب
    await dbQuery(
      `UPDATE orders 
       SET totalprice = $1, couponcode = $2, discountamount = $3, updatedat = NOW() 
       WHERE orderid = $4`,
      [newTotal, CouponCode, discountAmount, OrderID]
    );

    const responseData = {
      orderID: OrderID,
      originalTotal: order.totalprice,
      discountPercent: coupon.discountpercent,
      discountAmount,
      newTotal,
      couponCode: CouponCode
    };

    // 🔥 إرسال التحديث لكل العملاء عبر Socket.io
    if (req.app.locals.io) {
      req.app.locals.io.emit('coupon-applied', responseData);
    }

    sendResponse(res, true, 'Coupon applied successfully', responseData);

  } catch (err) {
    console.error('Error POST /apply-coupon', err);
    sendResponse(res, false, 'Failed to apply coupon', null, 500);
  }
});

module.exports = router;
