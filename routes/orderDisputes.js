const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// 📍 جلب كل شكاوى الطلبات
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT * FROM OrderDisputes ORDER BY CreatedAt DESC');
        sendResponse(res, true, 'Order disputes fetched successfully', result.recordset);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب شكوى حسب ID
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('DisputeID', sql.Int, req.params.id)
            .query('SELECT * FROM OrderDisputes WHERE DisputeID=@DisputeID');

        if (!result.recordset.length) return sendResponse(res, false, 'Dispute not found', null, 404);

        sendResponse(res, true, 'Dispute fetched', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إنشاء شكوى جديدة
router.post('/', async (req, res) => {
    try {
        const { OrderID, CustomerID, Description, Status } = req.body;
        if (!OrderID || !CustomerID || !Description) 
            return sendResponse(res, false, 'OrderID, CustomerID, and Description are required', null, 400);

        const pool = await poolPromise;
        const result = await pool.request()
            .input('OrderID', sql.NVarChar(80), OrderID)
            .input('CustomerID', sql.Int, CustomerID)
            .input('Description', sql.NVarChar(sql.MAX), Description)
            .input('Status', sql.NVarChar(100), Status || 'Pending')
            .input('CreatedAt', sql.DateTime, new Date())
            .input('ResolvedAt', sql.DateTime, null)
            .query(`INSERT INTO OrderDisputes (OrderID, CustomerID, Description, Status, CreatedAt, ResolvedAt)
                    VALUES (@OrderID, @CustomerID, @Description, @Status, @CreatedAt, @ResolvedAt);
                    SELECT SCOPE_IDENTITY() AS DisputeID`);

        sendResponse(res, true, 'Dispute created successfully', { DisputeID: result.recordset[0].DisputeID });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث شكوى
router.put('/:id', async (req, res) => {
    try {
        const updateData = req.body;
        const keys = Object.keys(updateData);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const pool = await poolPromise;
        const request = pool.request().input('DisputeID', sql.Int, req.params.id);

        keys.forEach(k => {
            let type = sql.NVarChar;
            if (['CustomerID'].includes(k)) type = sql.Int;
            if (['ResolvedAt'].includes(k)) type = sql.DateTime;
            request.input(k, type, updateData[k]);
        });

        const setQuery = keys.map(k => `${k}=@${k}`).join(', ');
        await request.query(`UPDATE OrderDisputes SET ${setQuery}, UpdatedAt=GETDATE() WHERE DisputeID=@DisputeID`);

        sendResponse(res, true, 'Dispute updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف شكوى
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('DisputeID', sql.Int, req.params.id)
            .query('DELETE FROM OrderDisputes WHERE DisputeID=@DisputeID');
        sendResponse(res, true, 'Dispute deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
