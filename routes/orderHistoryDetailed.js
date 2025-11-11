const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// دالة موحدة للرد مع طابع زمني
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// ==========================
// 📍 جلب كل سجلات التاريخ المفصل مع Pagination + فلترة
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 50, orderId = '', status = '' } = req.query;
        page = parseInt(page); limit = parseInt(limit);
        const offset = (page - 1) * limit;

        let where = [];
        let params = [];

        if (orderId) {
            params.push(`%${orderId}%`);
            where.push(`"OrderID" ILIKE $${params.length}`);
        }
        if (status) {
            params.push(`%${status}%`);
            where.push(`"NewStatus" ILIKE $${params.length}`);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        // الآن نُنشئ نص الاستعلام مع باراميترات OFFSET و LIMIT بوضع أرقام صحيحة
        const offsetParamIndex = params.length + 1;
        const limitParamIndex = params.length + 2;

        const queryText = `
            SELECT "HistoryID", "OrderID", "PreviousStatus", "NewStatus", "ChangedBy", "ChangeTime", "CreatedAt", "UpdatedAt"
            FROM "orderhistorydetailed"
            ${whereClause}
            ORDER BY "ChangeTime" DESC
            OFFSET $${offsetParamIndex} LIMIT $${limitParamIndex}
        `;
        const queryParams = params.concat([offset, limit]);

        const result = await sql.query(queryText, queryParams);

        sendResponse(res, true, 'Order history detailed fetched successfully', {
            page,
            limit,
            count: Array.isArray(result) ? result.length : (result.rows ? result.rows.length : 0),
            history: Array.isArray(result) ? result : (result.rows ? result.rows : [])
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب سجل حسب HistoryID
router.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await sql.query(`
            SELECT * FROM "orderhistorydetailed" WHERE "HistoryID" = $1
        `, [id]);

        const rows = Array.isArray(result) ? result : (result.rows ? result.rows : []);
        if (!rows.length) return sendResponse(res, false, 'History record not found', null, 404);
        sendResponse(res, true, 'History record fetched successfully', rows[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إنشاء سجل تاريخ مفصل جديد
router.post('/', async (req, res) => {
    try {
        const { OrderID, PreviousStatus = null, NewStatus, ChangedBy = null, ChangeTime } = req.body;
        if (!OrderID || !NewStatus || !ChangeTime) 
            return sendResponse(res, false, 'OrderID, NewStatus, and ChangeTime are required', null, 400);

        const result = await sql.query(`
            INSERT INTO "orderhistorydetailed"
            ("OrderID", "PreviousStatus", "NewStatus", "ChangedBy", "ChangeTime")
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [OrderID, PreviousStatus, NewStatus, ChangedBy, ChangeTime]);

        const row = Array.isArray(result) ? result[0] : (result.rows ? result.rows[0] : null);
        sendResponse(res, true, 'History detailed record created successfully', row, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث سجل تاريخ مفصل
router.put('/:id', async (req, res) => {
    try {
        const updates = req.body;
        const keys = Object.keys(updates);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        // بناء SET dynamically مع باراميترات $1..$n
        const setClauses = keys.map((k, idx) => `"${k}" = $${idx + 1}`).join(', ');
        const values = keys.map(k => updates[k]);

        // نضيف UpdatedAt و HistoryID في النهاية
        values.push(req.params.id); // هذا سيكون الباراميتر الأخير
        const historyIdParamIndex = values.length;

        const queryText = `
            UPDATE "orderhistorydetailed"
            SET ${setClauses}, "UpdatedAt" = NOW()
            WHERE "HistoryID" = $${historyIdParamIndex}
            RETURNING *
        `;
        const result = await sql.query(queryText, values);

        const rows = Array.isArray(result) ? result : (result.rows ? result.rows : []);
        if (!rows.length) return sendResponse(res, false, 'History record not found', null, 404);
        sendResponse(res, true, 'History detailed record updated successfully', rows[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف سجل تاريخ مفصل
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await sql.query(`
            DELETE FROM "orderhistorydetailed"
            WHERE "HistoryID" = $1
            RETURNING *
        `, [id]);

        const rows = Array.isArray(result) ? result : (result.rows ? result.rows : []);
        if (!rows.length) return sendResponse(res, false, 'History record not found', null, 404);
        sendResponse(res, true, 'History detailed record deleted successfully', rows[0]);
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
