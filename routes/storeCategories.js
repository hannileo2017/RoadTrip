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
// 📍 عرض كل التصنيفات
router.get('/', async (req, res) => {
    try {
        const result = await sql`SELECT * FROM "store_category" ORDER BY "CategoryName" ASC`;
        sendResponse(res, true, 'Categories fetched successfully', { count: result.length, categories: result });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 عرض تصنيف محدد
router.get('/:CategoryID', async (req, res) => {
    try {
        const result = await sql`SELECT * FROM "store_category" WHERE "CategoryID" = ${req.params.CategoryID}`;
        if (!result.length) return sendResponse(res, false, 'Category not found', null, 404);
        sendResponse(res, true, 'Category fetched successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة تصنيف جديد
router.post('/', async (req, res) => {
    try {
        const { CategoryName } = req.body;
        if (!CategoryName) return sendResponse(res, false, 'CategoryName is required', null, 400);

        const result = await sql`
            INSERT INTO "StoreCategories" ("CategoryName")
            VALUES (${CategoryName})
            RETURNING "CategoryID"
        `;
        sendResponse(res, true, 'Category created successfully', { CategoryID: result[0].CategoryID });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث تصنيف
router.put('/:CategoryID', async (req, res) => {
    try {
        const { CategoryID } = req.params;
        const { CategoryName } = req.body;
        if (!CategoryName) return sendResponse(res, false, 'CategoryName is required', null, 400);

        const result = await sql`
            UPDATE "StoreCategories"
            SET "CategoryName" = ${CategoryName}
            WHERE "CategoryID" = ${CategoryID}
            RETURNING *
        `;
        if (!result.length) return sendResponse(res, false, 'Category not found', null, 404);
        sendResponse(res, true, 'Category updated successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف تصنيف
router.delete('/:CategoryID', async (req, res) => {
    try {
        const result = await sql`
            DELETE FROM "store_category"
            WHERE "CategoryID" = ${req.params.CategoryID}
            RETURNING *
        `;
        if (!result.length) return sendResponse(res, false, 'Category not found', null, 404);
        sendResponse(res, true, 'Category deleted successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
