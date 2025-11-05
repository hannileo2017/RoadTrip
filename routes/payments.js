
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// دالة موحدة للردود
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// 📍 عرض كل المدفوعات
router.get('/', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM "payment" ORDER BY "PaymentDate" DESC`, [/* add params here */]);
        sendResponse(res, true, 'Payments fetched successfully', { count: result.length, payment: result });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 عرض دفعة محددة
router.get('/:PaymentID', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM "payment" WHERE "PaymentID"= $1`, [/* add params here */]);
        if (!result.length) return sendResponse(res, false, 'Payment not found', null, 404);
        sendResponse(res, true, 'Payment fetched successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة دفعة جديدة
router.post('/', async (req, res) => {
    try {
        const { OrderID, PaymentMethod, Amount, PaymentStatus, PaymentDate } = req.body;
        if (!OrderID || !PaymentMethod || !Amount || !PaymentStatus || !PaymentDate)
            return sendResponse(res, false, 'OrderID, PaymentMethod, Amount, PaymentStatus, and PaymentDate are required', null, 400);

        const result = await sql.query(`
            INSERT INTO "Payments" 
            ("OrderID", "PaymentMethod", "Amount", "PaymentStatus", "PaymentDate")
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [/* add params here */]);
        sendResponse(res, true, 'Payment created successfully', result[0], 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث دفعة
router.put('/:PaymentID', async (req, res) => {
    try {
        const updates = req.body;
        const keys = Object.keys(updates);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const setClauses = keys.map((k, idx) => `"${k}"=$${idx + 1}`).join(', ');
        const values = keys.map(k => updates[k]);

        const result = await sql.query(`
            UPDATE "Payments"
            SET $1
            WHERE "PaymentID"= $1
            RETURNING *
        `, [/* add params here */])(...values);

        if (!result.length) return sendResponse(res, false, 'Payment not found', null, 404);
        sendResponse(res, true, 'Payment updated successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف دفعة
router.delete('/:PaymentID', async (req, res) => {
    try {
        const result = await sql.query(`DELETE FROM "payment" WHERE "PaymentID"= $1 RETURNING *`, [/* add params here */]);
        if (!result.length) return sendResponse(res, false, 'Payment not found', null, 404);
        sendResponse(res, true, 'Payment deleted successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;

// --- auto-added init shim (safe) ---
try {
  if (!module.exports) module.exports = router;
} catch(e) {}

if (!module.exports.init) {
  module.exports.init = function initRoute(opts = {}) {
    try {
      if (opts.supabaseKey && !supabase && SUPABASE_URL) {
        try {
          
          supabase = createClient(SUPABASE_URL, opts.supabaseKey);
        } catch(err) { /* ignore */ }
      }
    } catch(err) { /* ignore */ }
    return module.exports;
  };
}
