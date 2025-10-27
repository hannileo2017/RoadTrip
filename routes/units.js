const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// عرض كل الوحدات
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Units');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// إضافة وحدة جديدة
router.post('/', async (req, res) => {
    const { UnitID, UnitName, UnitCategory } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('UnitID', sql.Int, UnitID)
            .input('UnitName', sql.NVarChar(200), UnitName)
            .input('UnitCategory', sql.NVarChar(100), UnitCategory)
            .query(`INSERT INTO Units (UnitID, UnitName, UnitCategory) VALUES (@UnitID,@UnitName,@UnitCategory)`);
        res.status(201).json({ message: '✅ تم إضافة الوحدة بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// تحديث وحدة
router.put('/:UnitID', async (req, res) => {
    const { UnitID } = req.params;
    const updateData = req.body;
    try {
        const pool = await poolPromise;
        const request = pool.request().input('UnitID', sql.Int, UnitID);
        const fields = Object.keys(updateData);
        fields.forEach(f => request.input(f, sql.NVarChar, updateData[f]));
        const setQuery = fields.map(f => `${f}=@${f}`).join(',');
        await request.query(`UPDATE Units SET ${setQuery} WHERE UnitID=@UnitID`);
        res.json({ message: '✅ تم تحديث الوحدة بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// حذف وحدة
router.delete('/:UnitID', async (req, res) => {
    const { UnitID } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request().input('UnitID', sql.Int, UnitID)
            .query('DELETE FROM Units WHERE UnitID=@UnitID');
        res.json({ message: '✅ تم حذف الوحدة بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
