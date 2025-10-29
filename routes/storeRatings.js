const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// 📍 عرض كل تقييمات المتاجر
router.get('/', async (req, res) => {
    try {
        const result = await sql`SELECT * FROM "store_rating" ORDER BY "RatedAt" DESC`;
        sendResponse(res, true, 'Store ratings fetched successfully', { count: result.length, ratings: result });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة تقييم جديد
router.post('/', async (req, res) => {
    try {
        const { StoreID, CustomerID, Rating, Comment } = req.body;
        if (!StoreID || !CustomerID || !Rating) {
            return sendResponse(res, false, 'StoreID, CustomerID, and Rating are required', null, 400);
        }

        const result = await sql`
            INSERT INTO "store_rating" ("StoreID", "CustomerID", "Rating", "Comment", "RatedAt")
            VALUES (${StoreID}, ${CustomerID}, ${Rating}, ${Comment || null}, NOW())
            RETURNING *
        `;
        sendResponse(res, true, 'Store rating created successfully', result[0], 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث تقييم
router.put('/:RatingID', async (req, res) => {
    try {
        const { RatingID } = req.params;
        const updateData = req.body;
        const keys = Object.keys(updateData);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const setClauses = keys.map((k, idx) => `"${k}"=$${idx + 1}`).join(', ');
        const values = keys.map(k => updateData[k]);

        const result = await sql`
            UPDATE "store_rating"
            SET ${sql.raw(setClauses)}
            WHERE "RatingID" = ${RatingID}
            RETURNING *
        `(...values);

        if (!result.length) return sendResponse(res, false, 'Rating not found', null, 404);
        sendResponse(res, true, 'Store rating updated successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف تقييم
router.delete('/:RatingID', async (req, res) => {
    try {
        const { RatingID } = req.params;
        const result = await sql`
            DELETE FROM "store_rating"
            WHERE "RatingID" = ${RatingID}
            RETURNING *
        `;
        if (!result.length) return sendResponse(res, false, 'Rating not found', null, 404);
        sendResponse(res, true, 'Store rating deleted successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
