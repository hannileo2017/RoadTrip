const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// عرض كل الصلاحيات
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM RolePermissions');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// إضافة صلاحية جديدة
router.post('/', async (req, res) => {
    const { PermissionID, RoleID, PermissionKey, CanView, CanEdit, CanDelete, CanAdd } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('PermissionID', sql.Int, PermissionID)
            .input('RoleID', sql.Int, RoleID)
            .input('PermissionKey', sql.NVarChar(400), PermissionKey)
            .input('CanView', sql.Bit, CanView)
            .input('CanEdit', sql.Bit, CanEdit)
            .input('CanDelete', sql.Bit, CanDelete)
            .input('CanAdd', sql.Bit, CanAdd)
            .query(`INSERT INTO RolePermissions (PermissionID, RoleID, PermissionKey, CanView, CanEdit, CanDelete, CanAdd)
                    VALUES (@PermissionID,@RoleID,@PermissionKey,@CanView,@CanEdit,@CanDelete,@CanAdd)`);
        res.status(201).json({ message: '✅ تم إضافة الصلاحية بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// تحديث صلاحية
router.put('/:PermissionID', async (req, res) => {
    const { PermissionID } = req.params;
    const updateData = req.body;
    try {
        const pool = await poolPromise;
        const request = pool.request().input('PermissionID', sql.Int, PermissionID);
        const fields = Object.keys(updateData);
        fields.forEach(f => request.input(f, sql.Bit, updateData[f]));
        const setQuery = fields.map(f => `${f}=@${f}`).join(',');
        await request.query(`UPDATE RolePermissions SET ${setQuery} WHERE PermissionID=@PermissionID`);
        res.json({ message: '✅ تم تحديث الصلاحية بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// حذف صلاحية
router.delete('/:PermissionID', async (req, res) => {
    const { PermissionID } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request().input('PermissionID', sql.Int, PermissionID)
            .query('DELETE FROM RolePermissions WHERE PermissionID=@PermissionID');
        res.json({ message: '✅ تم حذف الصلاحية بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
