const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // PostgreSQL client

// دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({
        success,
        message,
        timestamp: new Date(),
        data
    });
}

// 📍 جلب جميع المدن مع البحث + Pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search ? req.query.search.trim() : '';
        const offset = (page - 1) * limit;

        let query = `SELECT "CityID", "CityName", "CreatedAt" FROM "cities"`;
        if (search) query += ` WHERE "CityName" ILIKE ${'%' + search + '%'}`;
        query += ` ORDER BY "CityName" ASC LIMIT ${limit} OFFSET ${offset}`;

        const cities = await sql(query);

        sendResponse(res, true, 'Cities retrieved successfully', {
            page,
            limit,
            count: cities.length,
            cities
        });
    } catch (err) {
        console.error('Error GET /cities:', err);
        sendResponse(res, false, 'Failed to retrieve cities', null, 500);
    }
});

// 📍 إضافة مدينة جديدة
router.post('/', async (req, res) => {
    try {
        const cityName = req.body.CityName?.trim();
        if (!cityName) return sendResponse(res, false, 'CityName is required', null, 400);

        const check = await sql`SELECT "CityID" FROM "cities" WHERE "CityName" = ${cityName}`;
        if (check.length > 0)
            return sendResponse(res, false, 'City already exists', null, 409);

        await sql`INSERT INTO "Cities" ("CityName", "CreatedAt") VALUES (${cityName}, NOW())`;

        sendResponse(res, true, 'City added successfully');
    } catch (err) {
        console.error('Error POST /cities:', err);
        sendResponse(res, false, 'Failed to add city', null, 500);
    }
});

// 📍 تعديل مدينة
router.put('/:id', async (req, res) => {
    try {
        const cityID = parseInt(req.params.id);
        const cityName = req.body.CityName?.trim();

        if (isNaN(cityID)) return sendResponse(res, false, 'Invalid CityID', null, 400);
        if (!cityName) return sendResponse(res, false, 'CityName is required', null, 400);

        const check = await sql`SELECT "CityID" FROM "cities" WHERE "CityID" = ${cityID}`;
        if (check.length === 0) return sendResponse(res, false, 'City not found', null, 404);

        const dupCheck = await sql`SELECT "CityID" FROM "cities" WHERE "CityName" = ${cityName} AND "CityID" <> ${cityID}`;
        if (dupCheck.length > 0) return sendResponse(res, false, 'Another city with this name already exists', null, 409);

        await sql`UPDATE "Cities" SET "CityName" = ${cityName}, "UpdatedAt" = NOW() WHERE "CityID" = ${cityID}`;

        sendResponse(res, true, 'City updated successfully');
    } catch (err) {
        console.error('Error PUT /cities/:id:', err);
        sendResponse(res, false, 'Failed to update city', null, 500);
    }
});

// 📍 حذف مدينة
router.delete('/:id', async (req, res) => {
    try {
        const cityID = parseInt(req.params.id);
        if (isNaN(cityID)) return sendResponse(res, false, 'Invalid CityID', null, 400);

        const check = await sql`SELECT "CityID" FROM "cities" WHERE "CityID" = ${cityID}`;
        if (check.length === 0) return sendResponse(res, false, 'City not found', null, 404);

        const areaCheck = await sql`SELECT COUNT(*) AS total FROM "areas" WHERE "CityID" = ${cityID}`;
        if (parseInt(areaCheck[0].total) > 0)
            return sendResponse(res, false, 'Cannot delete city with linked areas', null, 400);

        await sql`DELETE FROM "cities" WHERE "CityID" = ${cityID}`;

        sendResponse(res, true, 'City deleted successfully');
    } catch (err) {
        console.error('Error DELETE /cities/:id:', err);
        sendResponse(res, false, 'Failed to delete city', null, 500);
    }
});

module.exports = router;
