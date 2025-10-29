const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
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

        const result = await sql`
            SELECT A.*, C."CityName"
            FROM "areas" A
            LEFT JOIN "cities" C ON A."CityID" = C."CityID"
            WHERE A."AreaName" ILIKE ${`%${search}%`} 
               OR C."CityName" ILIKE ${`%${search}%`}
            ORDER BY C."CityName", A."AreaName"
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
        `;

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

        const result = await sql`
            SELECT A.*, C."CityName"
            FROM "areas" A
            LEFT JOIN "cities" C ON A."CityID" = C."CityID"
            WHERE A."AreaID" = ${AreaID}
        `;

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

        await sql`
            INSERT INTO "Areas" ("AreaName","CityID","CreatedAt")
            VALUES (${AreaName}, ${cityIdNum}, NOW())
        `;

        sendResponse(res, true, 'Area added successfully');
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

        const exists = await sql`
            SELECT * FROM "areas" WHERE "AreaID" = ${AreaID}
        `;

        if (!exists.length)
            return sendResponse(res, false, `Area with ID ${AreaID} not found`, null, 404);

        await sql`
            UPDATE "Areas"
            SET "AreaName" = ${AreaName}, "CityID" = ${cityIdNum}, "UpdatedAt" = NOW()
            WHERE "AreaID" = ${AreaID}
        `;

        sendResponse(res, true, 'Area updated successfully');
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

        const exists = await sql`
            SELECT * FROM "areas" WHERE "AreaID" = ${AreaID}
        `;

        if (!exists.length)
            return sendResponse(res, false, `Area with ID ${AreaID} not found`, null, 404);

        await sql`
            DELETE FROM "areas" WHERE "AreaID" = ${AreaID}
        `;

        sendResponse(res, true, 'Area deleted successfully');
    } catch (err) {
        console.error('Error DELETE /areas/:id:', err);
        sendResponse(res, false, 'Failed to delete area', null, 500);
    }
});

module.exports = router;
