const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// 📍 جلب كل المواقع
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT * FROM DriverLocations ORDER BY Timestamp DESC');
        sendResponse(res, true, 'Driver locations fetched successfully', result.recordset);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب موقع حسب LocationID
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('LocationID', sql.Int, req.params.id)
            .query('SELECT * FROM DriverLocations WHERE LocationID=@LocationID');

        if (!result.recordset.length) return sendResponse(res, false, 'Driver location not found', null, 404);

        sendResponse(res, true, 'Driver location fetched', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة موقع جديد
router.post('/', async (req, res) => {
    try {
        const { DriverID, Latitude, Longitude, Timestamp, Status } = req.body;
        if (!DriverID || Latitude === undefined || Longitude === undefined) 
            return sendResponse(res, false, 'DriverID, Latitude, and Longitude are required', null, 400);

        const pool = await poolPromise;
        await pool.request()
            .input('DriverID', sql.NVarChar(80), DriverID)
            .input('Latitude', sql.Decimal(9,6), Latitude)
            .input('Longitude', sql.Decimal(9,6), Longitude)
            .input('Timestamp', sql.DateTime, Timestamp || new Date())
            .input('Status', sql.NVarChar(40), Status || 'active')
            .query(`INSERT INTO DriverLocations (DriverID, Latitude, Longitude, Timestamp, Status)
                    VALUES (@DriverID, @Latitude, @Longitude, @Timestamp, @Status)`);

        sendResponse(res, true, 'Driver location added successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث موقع
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const pool = await poolPromise;
        const request = pool.request().input('LocationID', sql.Int, id);

        const fields = Object.keys(updateData);
        if (!fields.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        fields.forEach(f => {
            let type = sql.NVarChar;
            if (['Latitude','Longitude'].includes(f)) type = sql.Decimal(9,6);
            if (f === 'Timestamp') type = sql.DateTime;
            request.input(f, type, updateData[f]);
        });

        const setQuery = fields.map(f => `${f}=@${f}`).join(',');
        await request.query(`UPDATE DriverLocations SET ${setQuery}, UpdatedAt=GETDATE() WHERE LocationID=@LocationID`);

        sendResponse(res, true, 'Driver location updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف موقع
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('LocationID', sql.Int, req.params.id)
            .query('DELETE FROM DriverLocations WHERE LocationID=@LocationID');

        sendResponse(res, true, 'Driver location deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
