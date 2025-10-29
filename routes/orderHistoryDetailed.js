const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
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

        const result = await sql`
            SELECT "HistoryID", "OrderID", "PreviousStatus", "NewStatus", "ChangedBy", "ChangeTime", "CreatedAt", "UpdatedAt"
            FROM "orderhistorydetailed"
            ${sql.raw(whereClause)}
            ORDER BY "ChangeTime" DESC
            OFFSET ${offset} LIMIT ${limit}
        `;

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
        const result = await sql`
            SELECT * FROM "orderhistorydetailed" WHERE "HistoryID" = ${req.params.id}
        `;
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

        const result = await sql`
            INSERT INTO "OrderHistoryDetailed"
            ("OrderID", "PreviousStatus", "NewStatus", "ChangedBy", "ChangeTime")
            VALUES (${OrderID}, ${PreviousStatus || null}, ${NewStatus}, ${ChangedBy || null}, ${ChangeTime})
            RETURNING *
        `;
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

        const result = await sql`
            UPDATE "OrderHistoryDetailed"
            SET ${sql.raw(setClauses)}, "UpdatedAt"=NOW()
            WHERE "HistoryID"=${req.params.id}
            RETURNING *
        `;

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
        const result = await sql`
            DELETE FROM "orderhistorydetailed"
            WHERE "HistoryID"=${req.params.id}
            RETURNING *
        `;
        if (!result.length) return sendResponse(res, false, 'History record not found', null, 404);
        sendResponse(res, true, 'History detailed record deleted successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
