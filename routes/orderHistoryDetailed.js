const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({
        success,
        message,
        timestamp: new Date(),
        data
    });
}

// ==========================
// 📍 جلب كل سجلات التاريخ المفصل للطلبات
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT * FROM OrderHistoryDetailed ORDER BY ChangeTime DESC');
        sendResponse(res, true, 'Order history detailed fetched successfully', result.recordset);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب سجل التاريخ المفصل حسب ID
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('HistoryID', sql.Int, req.params.id)
            .query('SELECT * FROM OrderHistoryDetailed WHERE HistoryID=@HistoryID');

        if (!result.recordset.length) return sendResponse(res, false, 'History record not found', null, 404);

        sendResponse(res, true, 'History record fetched', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إنشاء سجل تاريخ مفصل جديد
router.post('/', async (req, res) => {
    try {
        const { OrderID, PreviousStatus, NewStatus, ChangedBy, ChangeTime } = req.body;
        if (!OrderID || !NewStatus || !ChangeTime) 
            return sendResponse(res, false, 'OrderID, NewStatus, and ChangeTime are required', null, 400);

        const pool = await poolPromise;
        const result = await pool.request()
            .input('OrderID', sql.NVarChar(80), OrderID)
            .input('PreviousStatus', sql.NVarChar(100), PreviousStatus || null)
            .input('NewStatus', sql.NVarChar(100), NewStatus)
            .input('ChangedBy', sql.NVarChar(100), ChangedBy || null)
            .input('ChangeTime', sql.DateTime, ChangeTime)
            .query(`INSERT INTO OrderHistoryDetailed
                    (OrderID, PreviousStatus, NewStatus, ChangedBy, ChangeTime)
                    VALUES (@OrderID, @PreviousStatus, @NewStatus, @ChangedBy, @ChangeTime);
                    SELECT SCOPE_IDENTITY() AS HistoryID`);

        sendResponse(res, true, 'History detailed record created successfully', { HistoryID: result.recordset[0].HistoryID });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث سجل التاريخ المفصل
router.put('/:id', async (req, res) => {
    try {
        const updateData = req.body;
        const keys = Object.keys(updateData);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const pool = await poolPromise;
        const request = pool.request().input('HistoryID', sql.Int, req.params.id);

        keys.forEach(k => {
            let type = sql.NVarChar;
            if (['ChangeTime'].includes(k)) type = sql.DateTime;
            request.input(k, type, updateData[k]);
        });

        const setQuery = keys.map(k => `${k}=@${k}`).join(', ');
        await request.query(`UPDATE OrderHistoryDetailed SET ${setQuery}, UpdatedAt=GETDATE() WHERE HistoryID=@HistoryID`);

        sendResponse(res, true, 'History detailed record updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف سجل التاريخ المفصل
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('HistoryID', sql.Int, req.params.id)
            .query('DELETE FROM OrderHistoryDetailed WHERE HistoryID=@HistoryID');
        sendResponse(res, true, 'History detailed record deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
