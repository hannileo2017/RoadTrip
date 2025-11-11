const express = require('express');
const router = express.Router();
const sql = require('../db'); // الاتصال بـ PostgreSQL

// دالة موحدة للردود
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// 📍 عرض كل المدفوعات
router.get('/', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM "payment" ORDER BY "createdat" DESC`);
        sendResponse(res, true, 'Payments fetched successfully', { count: result.length, payments: result });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 عرض دفعة محددة
router.get('/:paymentid', async (req, res) => {
    const { paymentid } = req.params;
    try {
        const result = await sql.query(`SELECT * FROM "payment" WHERE "paymentid" = $1`, [paymentid]);
        if (!result.length) return sendResponse(res, false, 'Payment not found', null, 404);
        sendResponse(res, true, 'Payment fetched successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة دفعة جديدة
router.post('/', async (req, res) => {
    const { orderid, paymenttype, amount, paymentstatus, transactionid } = req.body;
    try {
        if (!orderid || !paymenttype || !amount)
            return sendResponse(res, false, 'OrderID, PaymentType, and Amount are required', null, 400);

        const result = await sql.query(`
            INSERT INTO "payment"
            ("orderid", "paymenttype", "amount", "paymentstatus", "transactionid", "createdat")
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
        `, [orderid, paymenttype, amount, paymentstatus || 'pending', transactionid || null]);

        sendResponse(res, true, 'Payment created successfully', result[0], 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث دفعة
router.put('/:paymentid', async (req, res) => {
    const { paymentid } = req.params;
    const updates = req.body;

    try {
        const keys = Object.keys(updates);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const setClauses = keys.map((k, idx) => `"${k}" = $${idx + 1}`).join(', ');
        const values = keys.map(k => updates[k]);
        values.push(paymentid); // آخر قيمة للشرط WHERE

        const result = await sql.query(`
            UPDATE "payment"
            SET ${setClauses}, "updatedat" = NOW()
            WHERE "paymentid" = $${values.length}
            RETURNING *
        `, values);

        if (!result.length) return sendResponse(res, false, 'Payment not found', null, 404);
        sendResponse(res, true, 'Payment updated successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف دفعة
router.delete('/:paymentid', async (req, res) => {
    const { paymentid } = req.params;
    try {
        const result = await sql.query(`
            DELETE FROM "payment"
            WHERE "paymentid" = $1
            RETURNING *
        `, [paymentid]);

        if (!result.length) return sendResponse(res, false, 'Payment not found', null, 404);
        sendResponse(res, true, 'Payment deleted successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
