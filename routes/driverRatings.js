const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// عرض كل تقييمات السائقين
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM DriverRatings');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// إضافة تقييم جديد
router.post('/', async (req, res) => {
    const { RatingID, DriverID, CustomerID, Rating, Comment } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('RatingID', sql.Int, RatingID)
            .input('DriverID', sql.NVarChar(80), DriverID)
            .input('CustomerID', sql.Int, CustomerID)
            .input('Rating', sql.Int, Rating)
            .input('Comment', sql.NVarChar(1000), Comment)
            .query(`INSERT INTO DriverRatings (RatingID, DriverID, CustomerID, Rating, Comment, CreatedAt)
                    VALUES (@RatingID,@DriverID,@CustomerID,@Rating,@Comment,GETDATE())`);
        res.status(201).json({ message: '✅ تم إضافة تقييم السائق بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// تحديث تقييم
router.put('/:RatingID', async (req, res) => {
    const { RatingID } = req.params;
    const updateData = req.body;
    try {
        const pool = await poolPromise;
        const request = pool.request().input('RatingID', sql.Int, RatingID);
        const fields = Object.keys(updateData);
        fields.forEach(f => request.input(f, sql.NVarChar, updateData[f]));
        const setQuery = fields.map(f => `${f}=@${f}`).join(',');
        await request.query(`UPDATE DriverRatings SET ${setQuery} WHERE RatingID=@RatingID`);
        res.json({ message: '✅ تم تحديث تقييم السائق بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// حذف تقييم
router.delete('/:RatingID', async (req, res) => {
    const { RatingID } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request().input('RatingID', sql.Int, RatingID)
            .query('DELETE FROM DriverRatings WHERE RatingID=@RatingID');
        res.json({ message: '✅ تم حذف تقييم السائق بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
