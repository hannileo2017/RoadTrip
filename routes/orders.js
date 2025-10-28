// routes/orders.js
const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// ✅ دالة موحدة لإرسال الردود
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ✅ فحص الاتصال عند تحميل الراوت (مفيد لتتبع الأخطاء في Render)
(async () => {
    try {
        const pool = await poolPromise;
        console.log('📡 Orders route connected to DB successfully');
    } catch (err) {
        console.error('❌ Orders route DB connection error:', err.message);
    }
})();

// ==========================
// 📍 جلب الطلبات (أحدث 10)
// ==========================
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`SELECT TOP 10 * FROM [Order] ORDER BY CreatedAt DESC`);

        sendResponse(res, true, 'Orders fetched successfully', {
            count: result.recordset.length,
            orders: result.recordset
        });
    } catch (err) {
        console.error('❌ Error fetching orders:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب طلب محدد حسب ID
// ==========================
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM [Order] WHERE ID=@id');

        if (!result.recordset.length)
            return sendResponse(res, false, 'Order not found', null, 404);

        sendResponse(res, true, 'Order fetched successfully', result.recordset[0]);
    } catch (err) {
        console.error('❌ Error fetching order by ID:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة طلب جديد
// ==========================
router.post('/', async (req, res) => {
    try {
        const { CustomerID, StoreID, DriverID, Status, TotalAmount } = req.body;

        if (!CustomerID || !StoreID || !Status) {
            return sendResponse(res, false, 'CustomerID, StoreID, and Status are required', null, 400);
        }

        const pool = await poolPromise;
        await pool.request()
            .input('CustomerID', sql.Int, CustomerID)
            .input('StoreID', sql.Int, StoreID)
            .input('DriverID', sql.Int, DriverID || null)
            .input('Status', sql.NVarChar(100), Status)
            .input('TotalAmount', sql.Decimal(9, 2), TotalAmount || 0)
            .input('CreatedAt', sql.DateTime, new Date())
            .query(`INSERT INTO [Order] (CustomerID, StoreID, DriverID, Status, TotalAmount, CreatedAt)
                    VALUES (@CustomerID, @StoreID, @DriverID, @Status, @TotalAmount, @CreatedAt)`);

        sendResponse(res, true, 'Order added successfully');
    } catch (err) {
        console.error('❌ Error adding order:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث طلب
// ==========================
router.put('/:id', async (req, res) => {
    try {
        const updateData = req.body;
        const keys = Object.keys(updateData);
        if (!keys.length)
            return sendResponse(res, false, 'Nothing to update', null, 400);

        const pool = await poolPromise;
        const request = pool.request().input('ID', sql.Int, req.params.id);

        keys.forEach(k => {
            let type = sql.NVarChar;
            if (['CustomerID', 'StoreID', 'DriverID'].includes(k)) type = sql.Int;
            if (['TotalAmount'].includes(k)) type = sql.Decimal(9, 2);
            request.input(k, type, updateData[k]);
        });

        const setQuery = keys.map(k => `${k}=@${k}`).join(', ');
        await request.query(`UPDATE [Order] SET ${setQuery}, LastUpdated=GETDATE() WHERE ID=@ID`);

        sendResponse(res, true, 'Order updated successfully');
    } catch (err) {
        console.error('❌ Error updating order:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف طلب
// ==========================
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('ID', sql.Int, req.params.id)
            .query('DELETE FROM [Order] WHERE ID=@ID');

        sendResponse(res, true, 'Order deleted successfully');
    } catch (err) {
        console.error('❌ Error deleting order:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
