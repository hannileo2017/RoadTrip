
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
// 📍 عرض كل تقييمات المتاجر
router.get('/', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM "store_rating" ORDER BY "RatedAt" DESC`, [/* add params here */]);
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

        const result = await sql.query(`
            INSERT INTO "store_rating" ("StoreID", "CustomerID", "Rating", "Comment", "RatedAt")
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
        `, [/* add params here */]);
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

        const result = await sql.query(`
            UPDATE "store_rating"
            SET $1
            WHERE "RatingID" = $2
            RETURNING *
        `, [/* add params here */])(...values);

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
        const result = await sql.query(`
            DELETE FROM "store_rating"
            WHERE "RatingID" = $1
            RETURNING *
        `, [/* add params here */]);
        if (!result.length) return sendResponse(res, false, 'Rating not found', null, 404);
        sendResponse(res, true, 'Store rating deleted successfully', result[0]);
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
