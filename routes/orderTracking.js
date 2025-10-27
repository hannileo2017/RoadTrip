const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// 📍 جلب كل سجلات التتبع
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM OrderTracking ORDER BY UpdatedAt DESC');
        sendResponse(res, true, 'Order tracking records fetched successfully', { count: result.recordset.length, records: result.recordset });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب سجل تتبع محدد
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('TrackingID', sql.Int, req.params.id)
            .query('SELECT * FROM OrderTracking WHERE TrackingID=@TrackingID');
        if (!result.recordset.length) return sendResponse(res, false, 'Tracking record not found', null, 404);
        sendResponse(res, true, 'Tracking record fetched successfully', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة سجل تتبع جديد
router.post('/', async (req, res) => {
    try {
        const { OrderID, DriverID, Latitude, Longitude, Status } = req.body;
        if (!OrderID || !DriverID || !Latitude || !Longitude || !Status)
            return sendResponse(res, false, 'OrderID, DriverID, Latitude, Longitude, and Status are required', null, 400);

        const pool = await poolPromise;
        const result = await pool.request()
            .input('OrderID', sql.NVarChar(80), OrderID)
            .input('DriverID', sql.NVarChar(80), DriverID)
            .input('Latitude', sql.Decimal(9,6), Latitude)
            .input('Longitude', sql.Decimal(9,6), Longitude)
            .input('Status', sql.NVarChar(200), Status)
            .input('UpdatedAt', sql.DateTime, new Date())
            .query(`INSERT INTO OrderTracking
                    (OrderID, DriverID, Latitude, Longitude, Status, UpdatedAt)
                    VALUES (@OrderID, @DriverID, @Latitude, @Longitude, @Status, @UpdatedAt);
                    SELECT SCOPE_IDENTITY() AS TrackingID`);
        sendResponse(res, true, 'Tracking record created successfully', { TrackingID: result.recordset[0].TrackingID });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث سجل تتبع (تحديث جزئي)
router.put('/:id', async (req, res) => {
    try {
        const updateData = req.body;
        const keys = Object.keys(updateData);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const pool = await poolPromise;
        const request = pool.request().input('TrackingID', sql.Int, req.params.id);

        keys.forEach(k => {
            let type = sql.NVarChar;
            if (['Latitude','Longitude'].includes(k)) type = sql.Decimal(9,6);
            request.input(k, type, updateData[k]);
        });

        const setQuery = keys.map(k => `${k}=@${k}`).join(', ');
        await request.query(`UPDATE OrderTracking SET ${setQuery}, UpdatedAt=GETDATE() WHERE TrackingID=@TrackingID`);
        sendResponse(res, true, 'Tracking record updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف سجل تتبع
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('TrackingID', sql.Int, req.params.id)
            .query('DELETE FROM OrderTracking WHERE TrackingID=@TrackingID');
        sendResponse(res, true, 'Tracking record deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
