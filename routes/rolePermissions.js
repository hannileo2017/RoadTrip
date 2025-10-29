const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// ==========================
// 📍 عرض كل الصلاحيات
router.get('/', async (req, res) => {
    try {
        const result = await sql`SELECT * FROM "role_permission"`;
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
        const result = await sql`
            INSERT INTO "role_permission"
            ("PermissionID", "RoleID", "PermissionKey", "CanView", "CanEdit", "CanDelete", "CanAdd")
            VALUES (${PermissionID}, ${RoleID}, ${PermissionKey}, ${CanView}, ${CanEdit}, ${CanDelete}, ${CanAdd})
            RETURNING *
        `;
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

        const result = await sql`
            UPDATE "role_permission"
            SET ${sql.raw(setClauses)}
            WHERE "PermissionID"=${PermissionID}
            RETURNING *
        `;

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
        const result = await sql`
            DELETE FROM "role_permission"
            WHERE "PermissionID"=${PermissionID}
            RETURNING *
        `;
        if (!result.length) return res.status(404).json({ message: 'الصلاحية غير موجودة' });
        res.json({ message: '✅ تم حذف الصلاحية بنجاح', permission: result[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
