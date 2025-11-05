
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

require('dotenv').config();
// routes/systemSettings.js
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js متصل بـ PostgreSQL

// دالة مساعدة للرد
const sendResponse = (res, success, message, data = null, status = 200) => {
    res.status(status).json({ success, message, data, timestamp: new Date() });
};

// ==========================
// GET جميع الإعدادات
router.get('/', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM "systemsettings" ORDER BY "SettingKey" ASC`, [/* add params here */]);
        sendResponse(res, true, 'System settings fetched successfully', { count: result.length, settings: result });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// PUT تحديث إعداد
router.put('/:SettingID', async (req, res) => {
    try {
        const { SettingID } = req.params;
        const { SettingValue } = req.body;
        if (SettingValue === undefined) return sendResponse(res, false, 'SettingValue is required', null, 400);

        const result = await sql.query(`
            UPDATE "SystemSettings"
            SET "SettingValue" = $1
            WHERE "SettingID" = $2
            RETURNING *
        `, [/* add params here */]);
        if (!result.length) return sendResponse(res, false, 'Setting not found', null, 404);

        sendResponse(res, true, 'System setting updated successfully', result[0]);
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
