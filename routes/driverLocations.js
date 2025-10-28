// routes/driverLocations.js
const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// 📍 جلب كل المواقع مع Pagination
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 50, search = '' } = req.query;
        page = parseInt(page); limit = parseInt(limit);
        const offset = (page - 1) * limit;

        const pool = await poolPromise;
        const request = pool.request();
        let whereClause = '';

        if (search) {
            request.input('Search', sql.NVarChar(100), `%${search}%`);
            whereClause = 'WHERE DriverID LIKE @Search';
        }

        const result = await request.query(`
            SELECT LocationID, DriverID, Latitude, Longitude, Timestamp, Status, UpdatedAt
            FROM DriverLocations
            ${whereClause}
            ORDER BY Timestamp DESC
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
        `);

        sendResponse(res, true, 'Driver locations fetched successfully', {
            count: result.recordset.length,
            locations: result.recordset
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// باقي CRUD كما هو موجود حالياً...

module.exports = router;
