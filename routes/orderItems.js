const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// عرض كل العناصر
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM OrderItems');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// إضافة عنصر جديد للطلب
router.post('/', async (req, res) => {
    const { OrderItemID, OrderID, ProductID, Quantity, Price } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('OrderItemID', sql.Int, OrderItemID)
            .input('OrderID', sql.NVarChar(80), OrderID)
            .input('ProductID', sql.Int, ProductID)
            .input('Quantity', sql.Int, Quantity)
            .input('Price', sql.Decimal(9,18), Price)
            .query(`INSERT INTO OrderItems (OrderItemID, OrderID, ProductID, Quantity, Price)
                    VALUES (@OrderItemID,@OrderID,@ProductID,@Quantity,@Price)`);
        res.status(201).json({ message: '✅ تم إضافة العنصر للطلب بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// تحديث عنصر
router.put('/:OrderItemID', async (req, res) => {
    const { OrderItemID } = req.params;
    const updateData = req.body;
    try {
        const pool = await poolPromise;
        const request = pool.request().input('OrderItemID', sql.Int, OrderItemID);
        const fields = Object.keys(updateData);
        fields.forEach(f => {
            const type = typeof updateData[f] === 'number' ? sql.Int : sql.NVarChar;
            request.input(f, type, updateData[f]);
        });
        const setQuery = fields.map(f => `${f}=@${f}`).join(',');
        await request.query(`UPDATE OrderItems SET ${setQuery} WHERE OrderItemID=@OrderItemID`);
        res.json({ message: '✅ تم تحديث بيانات العنصر بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// حذف عنصر
router.delete('/:OrderItemID', async (req, res) => {
    const { OrderItemID } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request().input('OrderItemID', sql.Int, OrderItemID)
            .query('DELETE FROM OrderItems WHERE OrderItemID=@OrderItemID');
        res.json({ message: '✅ تم حذف العنصر بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
