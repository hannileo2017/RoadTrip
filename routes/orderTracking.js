const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// دالة موحدة للردود
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// 📍 جلب كل تتبع الطلبات مع Pagination + فلترة
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 50, orderId = '', driverId = '' } = req.query;
        page = parseInt(page); limit = parseInt(limit);
        const offset = (page - 1) * limit;

        let where = [];
        let params = [];

        if (orderId) {
            where.push(`"OrderID" ILIKE $${params.length + 1}`);
            params.push(`%${orderId}%`);
        }
        if (driverId) {
            where.push(`"DriverID" ILIKE $${params.length + 1}`);
            params.push(`%${driverId}%`);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const result = await sql`
            SELECT "TrackingID", "OrderID", "DriverID", "Latitude", "Longitude", "Status", "UpdatedAt"
            FROM "order_tracking"
            ${sql.raw(whereClause)}
            ORDER BY "UpdatedAt" DESC
            OFFSET ${offset} LIMIT ${limit}
        `;

        sendResponse(res, true, 'Order tracking fetched successfully', {
            page,
            limit,
            count: result.length,
            tracking: result
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب سجل واحد حسب TrackingID
router.get('/:id', async (req, res) => {
    try {
        const result = await sql`
            SELECT * FROM "order_tracking" WHERE "TrackingID"=${req.params.id}
        `;
        if (!result.length) return sendResponse(res, false, 'Tracking record not found', null, 404);
        sendResponse(res, true, 'Tracking record fetched successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إنشاء سجل تتبع جديد
router.post('/', async (req, res) => {
    try {
        const { OrderID, DriverID, Latitude, Longitude, Status } = req.body;
        if (!OrderID || !DriverID) return sendResponse(res, false, 'OrderID and DriverID are required', null, 400);

        const result = await sql`
            INSERT INTO "order_tracking" 
            ("OrderID", "DriverID", "Latitude", "Longitude", "Status", "UpdatedAt")
            VALUES (${OrderID}, ${DriverID}, ${Latitude || null}, ${Longitude || null}, ${Status || null}, NOW())
            RETURNING *
        `;
        sendResponse(res, true, 'Tracking record created successfully', result[0], 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث سجل تتبع
router.put('/:id', async (req, res) => {
    try {
        const updates = req.body;
        const keys = Object.keys(updates);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        // بناء SET dynamically
        const setClauses = keys.map((k, idx) => `"${k}"=$${idx + 1}`).join(', ');
        const values = keys.map(k => updates[k]);

        const result = await sql`
            UPDATE "order_tracking"
            SET ${sql.raw(setClauses)}, "UpdatedAt"=NOW()
            WHERE "TrackingID"=${req.params.id}
            RETURNING *
        `;
        if (!result.length) return sendResponse(res, false, 'Tracking record not found', null, 404);
        sendResponse(res, true, 'Tracking record updated successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف سجل تتبع
router.delete('/:id', async (req, res) => {
    try {
        const result = await sql`
            DELETE FROM "order_tracking"
            WHERE "TrackingID"=${req.params.id}
            RETURNING *
        `;
        if (!result.length) return sendResponse(res, false, 'Tracking record not found', null, 404);
        sendResponse(res, true, 'Tracking record deleted successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
