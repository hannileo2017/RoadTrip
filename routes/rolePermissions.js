
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// ==========================
// 📍 عرض كل الصلاحيات
router.get('/', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM "role_permission"`, [/* add params here */]);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================
// 📍 إضافة صلاحية جديدة
router.post('/', async (req, res) => {
    const { PermissionID, RoleID, PermissionKey, CanView, CanEdit, CanDelete, CanAdd } = req.body;
    try {
        const result = await sql.query(`
            INSERT INTO "role_permission"
            ("PermissionID", "RoleID", "PermissionKey", "CanView", "CanEdit", "CanDelete", "CanAdd")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [/* add params here */]);
        res.status(201).json({ message: '✅ تم إضافة الصلاحية بنجاح', permission: result[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================
// 📍 تحديث صلاحية
router.put('/:PermissionID', async (req, res) => {
    const { PermissionID } = req.params;
    const updateData = req.body;
    const keys = Object.keys(updateData);
    if (!keys.length) return res.status(400).json({ message: 'لا يوجد بيانات لتحديثها' });

    try {
        const setClauses = keys.map((k, idx) => `"${k}"=$${idx + 1}`).join(', ');
        const values = keys.map(k => updateData[k]);

        const result = await sql.query(`
            UPDATE "role_permission"
            SET $1
            WHERE "PermissionID"=$2
            RETURNING *
        `, [/* add params here */]);

        if (!result.length) return res.status(404).json({ message: 'الصلاحية غير موجودة' });
        res.json({ message: '✅ تم تحديث الصلاحية بنجاح', permission: result[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================
// 📍 حذف صلاحية
router.delete('/:PermissionID', async (req, res) => {
    const { PermissionID } = req.params;
    try {
        const result = await sql.query(`
            DELETE FROM "role_permission"
            WHERE "PermissionID"=$1
            RETURNING *
        `, [/* add params here */]);
        if (!result.length) return res.status(404).json({ message: 'الصلاحية غير موجودة' });
        res.json({ message: '✅ تم حذف الصلاحية بنجاح', permission: result[0] });
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
