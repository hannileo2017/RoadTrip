const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// عرض كل الأدوار
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Roles');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// إضافة دور جديد
router.post('/', async (req, res) => {
    const { RoleID, RoleName, Description } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('RoleID', sql.Int, RoleID)
            .input('RoleName', sql.NVarChar(200), RoleName)
            .input('Description', sql.NVarChar(510), Description)
            .query(`INSERT INTO Roles (RoleID, RoleName, Description) VALUES (@RoleID,@RoleName,@Description)`);
        res.status(201).json({ message: '✅ تم إضافة الدور بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// تحديث دور
router.put('/:RoleID', async (req, res) => {
    const { RoleID } = req.params;
    const updateData = req.body;
    try {
        const pool = await poolPromise;
        const request = pool.request().input('RoleID', sql.Int, RoleID);
        const fields = Object.keys(updateData);
        fields.forEach(f => request.input(f, sql.NVarChar, updateData[f]));
        const setQuery = fields.map(f => `${f}=@${f}`).join(',');
        await request.query(`UPDATE Roles SET ${setQuery} WHERE RoleID=@RoleID`);
        res.json({ message: '✅ تم تحديث الدور بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// حذف دور
router.delete('/:RoleID', async (req, res) => {
    const { RoleID } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request().input('RoleID', sql.Int, RoleID)
            .query('DELETE FROM Roles WHERE RoleID=@RoleID');
        res.json({ message: '✅ تم حذف الدور بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
