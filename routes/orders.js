const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// ==========================
// 📍 جلب الطلبات مع Pagination وفلترة
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 10, status = '' } = req.query;
        page = parseInt(page); limit = parseInt(limit);
        const offset = (page - 1) * limit;

        let where = [];
        let params = [];

        if (status) {
            where.push(`"Status" ILIKE $${params.length + 1}`);
            params.push(`%${status}%`);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const result = await sql`
            SELECT * FROM "orders"
            ${sql.raw(whereClause)}
            ORDER BY "CreatedAt" DESC
            OFFSET ${offset} LIMIT ${limit}
        `;

        sendResponse(res, true, 'Orders fetched successfully', {
            count: result.length,
            orders: result
        });
    } catch (err) {
        console.error('❌ Error fetching orders:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب طلب محدد حسب ID
router.get('/:id', async (req, res) => {
    try {
        const result = await sql`
            SELECT * FROM "orders" WHERE "ID"=${req.params.id}
        `;
        if (!result.length) return sendResponse(res, false, 'Order not found', null, 404);
        sendResponse(res, true, 'Order fetched successfully', result[0]);
    } catch (err) {
        console.error('❌ Error fetching orders by ID:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة طلب جديد
router.post('/', async (req, res) => {
    try {
        const { CustomerID, StoreID, DriverID, Status, TotalAmount } = req.body;
        if (!CustomerID || !StoreID || !Status)
            return sendResponse(res, false, 'CustomerID, StoreID, and Status are required', null, 400);

        const result = await sql`
            INSERT INTO "Order" ("CustomerID","StoreID","DriverID","Status","TotalAmount","CreatedAt")
            VALUES (${CustomerID}, ${StoreID}, ${DriverID || null}, ${Status}, ${TotalAmount || 0}, NOW())
            RETURNING *
        `;
        sendResponse(res, true, 'Order added successfully', result[0], 201);
    } catch (err) {
        console.error('❌ Error adding orders:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث طلب
router.put('/:id', async (req, res) => {
    try {
        const updateData = req.body;
        const keys = Object.keys(updateData);
        if (!keys.length)
            return sendResponse(res, false, 'Nothing to update', null, 400);

        // إعداد SET dynamically مع قيم
        const setClauses = keys.map((k, idx) => `"${k}"=$${idx + 1}`).join(', ');
        const values = keys.map(k => updateData[k]);

        // الربط مع postgres.js
        const result = await sql`
            UPDATE "Order"
            SET ${sql.raw(setClauses)}, "LastUpdated"=NOW()
            WHERE "ID"=${req.params.id}
            RETURNING *
        `(...values); // <-- هنا قمنا بتمرير القيم الفعلية

        if (!result.length)
            return sendResponse(res, false, 'Order not found', null, 404);

        sendResponse(res, true, 'Order updated successfully', result[0]);
    } catch (err) {
        console.error('❌ Error updating orders:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف طلب
router.delete('/:id', async (req, res) => {
    try {
        const result = await sql`
            DELETE FROM "orders" WHERE "ID"=${req.params.id} RETURNING *
        `;
        if (!result.length)
            return sendResponse(res, false, 'Order not found', null, 404);
        sendResponse(res, true, 'Order deleted successfully', result[0]);
    } catch (err) {
        console.error('❌ Error deleting orders:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
