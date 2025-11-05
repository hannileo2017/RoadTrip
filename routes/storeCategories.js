
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

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
        const result = await sql.query(`SELECT * FROM "store_category" ORDER BY "CategoryName" ASC`, [/* add params here */]);
        sendResponse(res, true, 'Categories fetched successfully', { count: result.length, categories: result });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 عرض تصنيف محدد
router.get('/:CategoryID', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM "store_category" WHERE "CategoryID" = $1`, [/* add params here */]);
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

        const result = await sql.query(`
            INSERT INTO "StoreCategories" ("CategoryName")
            VALUES ($1)
            RETURNING "CategoryID"
        `, [/* add params here */]);
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

        const result = await sql.query(`
            UPDATE "StoreCategories"
            SET "CategoryName" = $1
            WHERE "CategoryID" = $2
            RETURNING *
        `, [/* add params here */]);
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
        const result = await sql.query(`
            DELETE FROM "store_category"
            WHERE "CategoryID" = $1
            RETURNING *
        `, [/* add params here */]);
        if (!result.length) return sendResponse(res, false, 'Category not found', null, 404);
        sendResponse(res, true, 'Category deleted successfully', result[0]);
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
