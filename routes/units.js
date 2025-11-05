
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

require('dotenv').config();
// routes/units.js
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// دالة مساعدة للرد
const sendResponse = (res, success, message, data = null, status = 200) => {
    res.status(status).json({ success, message, data, timestamp: new Date() });
};

// ==========================
// GET كل الوحدات
router.get('/', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM "units" ORDER BY "UnitName" ASC`, [/* add params here */]);
        sendResponse(res, true, 'Units fetched successfully', result);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// POST إضافة وحدة جديدة
router.post('/', async (req, res) => {
    try {
        const { UnitName, UnitCategory } = req.body;
        if (!UnitName) return sendResponse(res, false, 'UnitName is required', null, 400);

        const result = await sql.query(`
            INSERT INTO "Units" ("UnitName","UnitCategory")
            VALUES ($1, $2)
            RETURNING "UnitID"
        `, [/* add params here */]);
        sendResponse(res, true, 'Unit created successfully', { UnitID: result[0].UnitID }, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// PUT تحديث وحدة
router.put('/:UnitID', async (req, res) => {
    try {
        const { UnitID } = req.params;
        const updateData = req.body;
        const fields = Object.keys(updateData);
        if (!fields.length) return sendResponse(res, false, 'No fields to update', null, 400);

        const setQuery = fields.map(f => `"${f}" = ${updateData[f]}`).join(', ');
        const result = await sql.query(`
            UPDATE "Units"
            SET $1
            WHERE "UnitID" = $2
            RETURNING *
        `, [/* add params here */]);
        if (!result.length) return sendResponse(res, false, 'Unit not found', null, 404);
        sendResponse(res, true, 'Unit updated successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// DELETE حذف وحدة
router.delete('/:UnitID', async (req, res) => {
    try {
        const { UnitID } = req.params;
        const result = await sql.query(`
            DELETE FROM "units"
            WHERE "UnitID" = $1
            RETURNING *
        `, [/* add params here */]);
        if (!result.length) return sendResponse(res, false, 'Unit not found', null, 404);
        sendResponse(res, true, 'Unit deleted successfully', result[0]);
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
