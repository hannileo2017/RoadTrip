
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
            where.push(`"OrderID" ILIKE $${params.length + 1}`);
            params.push(`%${orderId}%`);
        }
        if (status) {
            where.push(`"NewStatus" ILIKE $${params.length + 1}`);
            params.push(`%${status}%`);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const result = await sql.query(`
            SELECT "HistoryID", "OrderID", "PreviousStatus", "NewStatus", "ChangedBy", "ChangeTime", "CreatedAt", "UpdatedAt"
            FROM "orderhistorydetailed"
            $1
            ORDER BY "ChangeTime" DESC
            OFFSET $2 LIMIT $3
        `, [/* add params here */]);

        sendResponse(res, true, 'Order history detailed fetched successfully', {
            page,
            limit,
            count: result.length,
            history: result
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب سجل حسب HistoryID
router.get('/:id', async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT * FROM "orderhistorydetailed" WHERE "HistoryID" = $1
        `, [/* add params here */]);
        if (!result.length) return sendResponse(res, false, 'History record not found', null, 404);
        sendResponse(res, true, 'History record fetched successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إنشاء سجل تاريخ مفصل جديد
router.post('/', async (req, res) => {
    try {
        const { OrderID, PreviousStatus, NewStatus, ChangedBy, ChangeTime } = req.body;
        if (!OrderID || !NewStatus || !ChangeTime) 
            return sendResponse(res, false, 'OrderID, NewStatus, and ChangeTime are required', null, 400);

        const result = await sql.query(`
            INSERT INTO "OrderHistoryDetailed"
            ("OrderID", "PreviousStatus", "NewStatus", "ChangedBy", "ChangeTime")
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [/* add params here */]);
        sendResponse(res, true, 'History detailed record created successfully', result[0], 201);
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

        // بناء SET dynamically
        const setClauses = keys.map((k, idx) => `"${k}"=$${idx + 1}`).join(', ');
        const values = keys.map(k => updates[k]);

        const result = await sql.query(`
            UPDATE "OrderHistoryDetailed"
            SET $1, "UpdatedAt"=NOW()
            WHERE "HistoryID"= $1
            RETURNING *
        `, [/* add params here */]);

        if (!result.length) return sendResponse(res, false, 'History record not found', null, 404);
        sendResponse(res, true, 'History detailed record updated successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف سجل تاريخ مفصل
router.delete('/:id', async (req, res) => {
    try {
        const result = await sql.query(`
            DELETE FROM "orderhistorydetailed"
            WHERE "HistoryID"= $1
            RETURNING *
        `, [/* add params here */]);
        if (!result.length) return sendResponse(res, false, 'History record not found', null, 404);
        sendResponse(res, true, 'History detailed record deleted successfully', result[0]);
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
