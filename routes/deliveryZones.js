const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// 📍 جلب كل مناطق التوصيل
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT dz.ZoneID, dz.ZoneName, dz.CityID, c.CityName FROM DeliveryZones dz LEFT JOIN Cities c ON dz.CityID=c.CityID');
        sendResponse(res, true, 'Delivery zones fetched successfully', result.recordset);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب منطقة توصيل حسب ID
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('ZoneID', sql.Int, req.params.id)
            .query('SELECT * FROM DeliveryZones WHERE ZoneID=@ZoneID');

        if (!result.recordset.length) return sendResponse(res, false, 'Delivery zone not found', null, 404);

        sendResponse(res, true, 'Delivery zone fetched', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة منطقة توصيل جديدة
router.post('/', async (req, res) => {
    try {
        const { ZoneName, CityID } = req.body;
        if (!ZoneName || !CityID) return sendResponse(res, false, 'ZoneName and CityID are required', null, 400);

        const pool = await poolPromise;
        await pool.request()
            .input('ZoneName', sql.NVarChar(200), ZoneName)
            .input('CityID', sql.Int, CityID)
            .query(`INSERT INTO DeliveryZones (ZoneName, CityID, CreatedAt) VALUES (@ZoneName, @CityID, GETDATE())`);

        sendResponse(res, true, 'Delivery zone added successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث منطقة توصيل
router.put('/:id', async (req, res) => {
    try {
        const { ZoneName, CityID } = req.body;
        const { id } = req.params;

        if (!ZoneName && !CityID) return sendResponse(res, false, 'Nothing to update', null, 400);

        const pool = await poolPromise;
        const request = pool.request().input('ZoneID', sql.Int, id);

        let setQuery = [];
        if (ZoneName) {
            request.input('ZoneName', sql.NVarChar(200), ZoneName);
            setQuery.push('ZoneName=@ZoneName');
        }
        if (CityID) {
            request.input('CityID', sql.Int, CityID);
            setQuery.push('CityID=@CityID');
        }

        await request.query(`UPDATE DeliveryZones SET ${setQuery.join(', ')}, UpdatedAt=GETDATE() WHERE ZoneID=@ZoneID`);
        sendResponse(res, true, 'Delivery zone updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف منطقة توصيل
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('ZoneID', sql.Int, req.params.id)
            .query('DELETE FROM DeliveryZones WHERE ZoneID=@ZoneID');

        sendResponse(res, true, 'Delivery zone deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
