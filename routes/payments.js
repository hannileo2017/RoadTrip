const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// 📍 عرض كل المدفوعات
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Payments ORDER BY PaymentDate DESC');
        sendResponse(res, true, 'Payments fetched successfully', { count: result.recordset.length, payments: result.recordset });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 عرض دفعة محددة
router.get('/:PaymentID', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('PaymentID', sql.Int, req.params.PaymentID)
            .query('SELECT * FROM Payments WHERE PaymentID=@PaymentID');
        if (!result.recordset.length) return sendResponse(res, false, 'Payment not found', null, 404);
        sendResponse(res, true, 'Payment fetched successfully', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة دفعة جديدة
router.post('/', async (req, res) => {
    try {
        const { OrderID, PaymentMethod, Amount, PaymentStatus, PaymentDate } = req.body;
        if (!OrderID || !PaymentMethod || !Amount || !PaymentStatus || !PaymentDate)
            return sendResponse(res, false, 'OrderID, PaymentMethod, Amount, PaymentStatus, and PaymentDate are required', null, 400);

        const pool = await poolPromise;
        const result = await pool.request()
            .input('OrderID', sql.NVarChar(80), OrderID)
            .input('PaymentMethod', sql.NVarChar(100), PaymentMethod)
            .input('Amount', sql.Decimal(9,2), Amount)
            .input('PaymentStatus', sql.NVarChar(100), PaymentStatus)
            .input('PaymentDate', sql.DateTime, PaymentDate)
            .query(`INSERT INTO Payments
                    (OrderID, PaymentMethod, Amount, PaymentStatus, PaymentDate)
                    VALUES (@OrderID, @PaymentMethod, @Amount, @PaymentStatus, @PaymentDate);
                    SELECT SCOPE_IDENTITY() AS PaymentID`);
        sendResponse(res, true, 'Payment created successfully', { PaymentID: result.recordset[0].PaymentID });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث دفعة (تحديث جزئي)
router.put('/:PaymentID', async (req, res) => {
    try {
        const updateData = req.body;
        const keys = Object.keys(updateData);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const pool = await poolPromise;
        const request = pool.request().input('PaymentID', sql.Int, req.params.PaymentID);

        keys.forEach(k => {
            let type = sql.NVarChar;
            if (['Amount'].includes(k)) type = sql.Decimal(9,2);
            if (['PaymentDate'].includes(k)) type = sql.DateTime;
            request.input(k, type, updateData[k]);
        });

        const setQuery = keys.map(k => `${k}=@${k}`).join(', ');
        await request.query(`UPDATE Payments SET ${setQuery} WHERE PaymentID=@PaymentID`);
        sendResponse(res, true, 'Payment updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف دفعة
router.delete('/:PaymentID', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('PaymentID', sql.Int, req.params.PaymentID)
            .query('DELETE FROM Payments WHERE PaymentID=@PaymentID');
        sendResponse(res, true, 'Payment deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
