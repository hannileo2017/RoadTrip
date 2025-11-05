
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// ==========================
// 📍 عرض كل الأدوار
router.get('/', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM "roles"`, [/* add params here */]);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================
// 📍 إضافة دور جديد
router.post('/', async (req, res) => {
    const { RoleID, RoleName, Description } = req.body;
    try {
        const result = await sql.query(`
            INSERT INTO "Roles" ("RoleID", "RoleName", "Description")
            VALUES ($1, $2, $3)
            RETURNING *
        `, [/* add params here */]);
        res.status(201).json({ message: '✅ تم إضافة الدور بنجاح', role: result[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================
// 📍 تحديث دور
router.put('/:RoleID', async (req, res) => {
    const { RoleID } = req.params;
    const updateData = req.body;
    const keys = Object.keys(updateData);
    if (!keys.length) return res.status(400).json({ message: 'لا يوجد بيانات لتحديثها' });

    try {
        const setClauses = keys.map((k, idx) => `"${k}"=$${idx + 1}`).join(', ');
        const values = keys.map(k => updateData[k]);

        const result = await sql.query(`
            UPDATE "Roles"
            SET $1
            WHERE "RoleID"=$2
            RETURNING *
        `, [/* add params here */]);

        if (!result.length) return res.status(404).json({ message: 'الدور غير موجود' });
        res.json({ message: '✅ تم تحديث الدور بنجاح', role: result[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================
// 📍 حذف دور
router.delete('/:RoleID', async (req, res) => {
    const { RoleID } = req.params;
    try {
        const result = await sql.query(`
            DELETE FROM "roles"
            WHERE "RoleID"=$1
            RETURNING *
        `, [/* add params here */]);
        if (!result.length) return res.status(404).json({ message: 'الدور غير موجود' });
        res.json({ message: '✅ تم حذف الدور بنجاح', role: result[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
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
