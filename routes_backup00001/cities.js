
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

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

        const check = await sql.query(`SELECT "CityID" FROM "cities" WHERE "CityName" = $1`, [/* add params here */]);
        if (check.length > 0)
            return sendResponse(res, false, 'City already exists', null, 409);

        await sql.query(`INSERT INTO "Cities" ("CityName", "CreatedAt") VALUES ($1, NOW())`, [/* add params here */]);

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

        const check = await sql.query(`SELECT "CityID" FROM "cities" WHERE "CityID" = $1`, [/* add params here */]);
        if (check.length === 0) return sendResponse(res, false, 'City not found', null, 404);

        const dupCheck = await sql.query(`SELECT "CityID" FROM "cities" WHERE "CityName" = $1 AND "CityID" <> $2`, [/* add params here */]);
        if (dupCheck.length > 0) return sendResponse(res, false, 'Another city with this name already exists', null, 409);

        await sql.query(`UPDATE "Cities" SET "CityName" = $1, "UpdatedAt" = NOW() WHERE "CityID" = $2`, [/* add params here */]);

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

        const check = await sql.query(`SELECT "CityID" FROM "cities" WHERE "CityID" = $1`, [/* add params here */]);
        if (check.length === 0) return sendResponse(res, false, 'City not found', null, 404);

        const areaCheck = await sql.query(`SELECT count(*) AS total FROM "areas" WHERE "CityID" = $1`, [/* add params here */]);
        if (parseInt(areaCheck[0].total) > 0)
            return sendResponse(res, false, 'Cannot delete city with linked areas', null, 400);

        await sql.query(`DELETE FROM "cities" WHERE "CityID" = $1`, [/* add params here */]);

        sendResponse(res, true, 'City deleted successfully');
    } catch (err) {
        console.error('Error DELETE /cities/:id:', err);
        sendResponse(res, false, 'Failed to delete city', null, 500);
    }
});

module.exports = router;

// --- auto-added init shim (safe) ---
try {
  if (!module.exports) module.exports = router;
} catch(e) {}

if (!module.exports.init) {
  module.exports.init = function initRoute(opts = {}) {
    try {
      if (opts.supabaseKey && !supabase && SUPABASE_URL) {
        try {
          
          supabase = createClient(SUPABASE_URL, opts.supabaseKey);
        } catch(err) { /* ignore */ }
      }
    } catch(err) { /* ignore */ }
    return module.exports;
  };
}
