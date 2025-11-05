// routes/areas.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // PostgreSQL client

// 🧩 دالة موحدة للردود
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({
        success,
        message,
        timestamp: new Date(),
        data
    });
}

// 📍 جلب جميع المناطق مع البحث والتقسيم (Pagination + Search)
router.get('/', async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        // Parameterized query
        const result = await sql.query(`
            SELECT a.*, c."CityName"
            FROM "areas" A
            LEFT JOIN "cities" C ON a."CityID" = C."CityID"
            WHERE a."AreaName" ILIKE $1 OR C."CityName" ILIKE $1
            ORDER BY C."CityName", A."AreaName"
            OFFSET $2 ROWS FETCH NEXT $3 ROWS ONLY
        `, [`%${search}%`, offset, limit]);

        sendResponse(res, true, 'Areas retrieved successfully', {
            page,
            limit,
            count: result.length,
            areas: result
        });
    } catch (err) {
        console.error('Error GET /areas:', err);
        sendResponse(res, false, 'Failed to retrieve areas', null, 500);
    }
});

// 📍 جلب منطقة حسب ID
router.get('/:id', async (req, res) => {
    try {
        const AreaID = parseInt(req.params.id);
        if (isNaN(AreaID))
            return sendResponse(res, false, 'Invalid AreaID', null, 400);

        const result = await sql.query(`
            SELECT a.*, c."CityName"
            FROM "areas" A
            LEFT JOIN "cities" C ON a."CityID" = C."CityID"
            WHERE a."AreaID" = $1
        `, [AreaID]);

        if (!result.length)
            return sendResponse(res, false, `Area with ID ${AreaID} not found`, null, 404);

        sendResponse(res, true, 'Area retrieved successfully', result[0]);
    } catch (err) {
        console.error('Error GET /areas/:id', err);
        sendResponse(res, false, 'Failed to retrieve area', null, 500);
    }
});

// 📍 إضافة منطقة جديدة
router.post('/', async (req, res) => {
    try {
        const { AreaName, CityID } = req.body;
        const cityIdNum = parseInt(CityID);

        if (!AreaName || isNaN(cityIdNum))
            return sendResponse(res, false, 'AreaName and valid CityID are required', null, 400);

        const inserted = await sql.query(`
            INSERT INTO "areas" ("AreaName","CityID","CreatedAt")
            VALUES ($1, $2, NOW())
            RETURNING *
        `, [AreaName, cityIdNum]);

        sendResponse(res, true, 'Area added successfully', inserted[0]);
    } catch (err) {
        console.error('Error POST /areas:', err);
        sendResponse(res, false, 'Failed to add area', null, 500);
    }
});

// 📍 تعديل بيانات منطقة
router.put('/:id', async (req, res) => {
    try {
        const AreaID = parseInt(req.params.id);
        const { AreaName, CityID } = req.body;
        const cityIdNum = parseInt(CityID);

        if (isNaN(AreaID) || !AreaName || isNaN(cityIdNum))
            return sendResponse(res, false, 'Valid AreaID, AreaName and CityID are required', null, 400);

        const exists = await sql.query(`SELECT * FROM "areas" WHERE "AreaID" = $1`, [AreaID]);
        if (!exists.length)
            return sendResponse(res, false, `Area with ID ${AreaID} not found`, null, 404);

        const updated = await sql.query(`
            UPDATE "areas"
            SET "AreaName" = $1, "CityID" = $2, "UpdatedAt" = NOW()
            WHERE "AreaID" = $3
            RETURNING *
        `, [AreaName, cityIdNum, AreaID]);

        sendResponse(res, true, 'Area updated successfully', updated[0]);
    } catch (err) {
        console.error('Error PUT /areas/:id:', err);
        sendResponse(res, false, 'Failed to update area', null, 500);
    }
});

// 📍 حذف منطقة
router.delete('/:id', async (req, res) => {
    try {
        const AreaID = parseInt(req.params.id);
        if (isNaN(AreaID))
            return sendResponse(res, false, 'Invalid AreaID', null, 400);

        const exists = await sql.query(`SELECT * FROM "areas" WHERE "AreaID" = $1`, [AreaID]);
        if (!exists.length)
            return sendResponse(res, false, `Area with ID ${AreaID} not found`, null, 404);

        const deleted = await sql.query(`DELETE FROM "areas" WHERE "AreaID" = $1 RETURNING *`, [AreaID]);

        sendResponse(res, true, 'Area deleted successfully', deleted[0]);
    } catch (err) {
        console.error('Error DELETE /areas/:id:', err);
        sendResponse(res, false, 'Failed to delete area', null, 500);
    }
});

module.exports = router;
