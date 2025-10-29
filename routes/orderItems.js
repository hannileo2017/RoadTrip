const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// 📍 جلب كل العناصر مع Pagination + فلترة
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 50, orderId = '', productId = '' } = req.query;
        page = parseInt(page); limit = parseInt(limit);
        const offset = (page - 1) * limit;

        let where = [];
        let params = [];

        if (orderId) {
            where.push(`"OrderID" ILIKE $${params.length + 1}`);
            params.push(`%${orderId}%`);
        }
        if (productId) {
            where.push(`"ProductID" = $${params.length + 1}`);
            params.push(parseInt(productId));
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const result = await sql`
            SELECT "OrderItemID", "OrderID", "ProductID", "Quantity", "Price"
            FROM "order_items"
            ${sql.raw(whereClause)}
            ORDER BY "OrderItemID" ASC
            OFFSET ${offset} LIMIT ${limit}
        `;

        sendResponse(res, true, 'Order items fetched successfully', {
            page,
            limit,
            count: result.length,
            items: result
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة عنصر جديد
router.post('/', async (req, res) => {
    try {
        const { OrderID, ProductID, Quantity, Price } = req.body;
        if (!OrderID || !ProductID || !Quantity || !Price) 
            return sendResponse(res, false, 'All fields are required', null, 400);

        const result = await sql`
            INSERT INTO "OrderItems" ("OrderID","ProductID","Quantity","Price")
            VALUES (${OrderID}, ${ProductID}, ${Quantity}, ${Price})
            RETURNING *
        `;

        sendResponse(res, true, 'Order item created successfully', result[0], 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث عنصر
router.put('/:OrderItemID', async (req, res) => {
    try {
        const { OrderItemID } = req.params;
        const updates = req.body;
        const keys = Object.keys(updates);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        // بناء SET dynamically
        const setClauses = keys.map((k, idx) => `"${k}"=$${idx + 1}`).join(', ');
        const values = keys.map(k => updates[k]);

        const result = await sql`
            UPDATE "OrderItems"
            SET ${sql.raw(setClauses)}
            WHERE "OrderItemID"=${OrderItemID}
            RETURNING *
        `;

        if (!result.length) return sendResponse(res, false, 'Order item not found', null, 404);
        sendResponse(res, true, 'Order item updated successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف عنصر
router.delete('/:OrderItemID', async (req, res) => {
    try {
        const { OrderItemID } = req.params;
        const result = await sql`
            DELETE FROM "order_items"
            WHERE "OrderItemID"=${OrderItemID}
            RETURNING *
        `;

        if (!result.length) return sendResponse(res, false, 'Order item not found', null, 404);
        sendResponse(res, true, 'Order item deleted successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
