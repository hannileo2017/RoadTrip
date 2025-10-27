const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// 📍 جلب كل سجل التاريخ للطلبات
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT * FROM OrderHistory ORDER BY ChangeDate DESC');
        sendResponse(res, true, 'Order history fetched successfully', result.recordset);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب سجل تاريخ حسب ID
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('HistoryID', sql.Int, req.params.id)
            .query('SELECT * FROM OrderHistory WHERE HistoryID=@HistoryID');

        if (!result.recordset.length) return sendResponse(res, false, 'History record not found', null, 404);

        sendResponse(res, true, 'History record fetched', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إنشاء سجل تاريخ جديد
router.post('/', async (req, res) => {
    try {
        const { OrderID, Status, ChangedBy, DriverID, CouponID, TotalAmount, ChangeDate, Notes } = req.body;
        if (!OrderID || !Status || !ChangeDate) 
            return sendResponse(res, false, 'OrderID, Status, and ChangeDate are required', null, 400);

        const pool = await poolPromise;
        const result = await pool.request()
            .input('OrderID', sql.NVarChar(80), OrderID)
            .input('Status', sql.NVarChar(100), Status)
            .input('ChangedBy', sql.NVarChar(100), ChangedBy || null)
            .input('DriverID', sql.Int, DriverID || null)
            .input('CouponID', sql.Int, CouponID || null)
            .input('TotalAmount', sql.Decimal(9,2), TotalAmount || 0)
            .input('ChangeDate', sql.DateTime, ChangeDate)
            .input('Notes', sql.NVarChar(510), Notes || null)
            .query(`INSERT INTO OrderHistory
                    (OrderID, Status, ChangedBy, DriverID, CouponID, TotalAmount, ChangeDate, Notes)
                    VALUES (@OrderID, @Status, @ChangedBy, @DriverID, @CouponID, @TotalAmount, @ChangeDate, @Notes);
                    SELECT SCOPE_IDENTITY() AS HistoryID`);

        sendResponse(res, true, 'History record created successfully', { HistoryID: result.recordset[0].HistoryID });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث سجل التاريخ
router.put('/:id', async (req, res) => {
    try {
        const updateData = req.body;
        const keys = Object.keys(updateData);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const pool = await poolPromise;
        const request = pool.request().input('HistoryID', sql.Int, req.params.id);

        keys.forEach(k => {
            let type = sql.NVarChar;
            if (['DriverID', 'CouponID'].includes(k)) type = sql.Int;
            if (['TotalAmount'].includes(k)) type = sql.Decimal(9,2);
            if (['ChangeDate'].includes(k)) type = sql.DateTime;
            request.input(k, type, updateData[k]);
        });

        const setQuery = keys.map(k => `${k}=@${k}`).join(', ');
        await request.query(`UPDATE OrderHistory SET ${setQuery}, UpdatedAt=GETDATE() WHERE HistoryID=@HistoryID`);

        sendResponse(res, true, 'History record updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف سجل التاريخ
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('HistoryID', sql.Int, req.params.id)
            .query('DELETE FROM OrderHistory WHERE HistoryID=@HistoryID');
        sendResponse(res, true, 'History record deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
