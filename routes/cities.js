// routes/cities.js
const express = require('express');
const router = express.Router();
const { dbQuery, requireSession, requireRole } = require('../middleware/auth');

// =====================
// Helper للردود
// =====================
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// =====================
// 📍 جلب جميع المدن مع البحث + Pagination + Filter
// =====================
router.get('/', requireSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search ? req.query.search.trim() : '';
        const isActive = req.query.isactive !== undefined ? req.query.isactive === 'true' : null;
        const offset = (page - 1) * limit;

        let whereClauses = [];
        let values = [];
        let idx = 1;

        if (search) {
            whereClauses.push(`cityname ILIKE $${idx}`);
            values.push(`%${search}%`);
            idx++;
        }
        if (isActive !== null) {
            whereClauses.push(`isactive = $${idx}`);
            values.push(isActive);
            idx++;
        }

        const whereClause = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

        values.push(limit, offset);

        const result = await dbQuery(`
            SELECT * FROM cities
            ${whereClause}
            ORDER BY cityname ASC
            LIMIT $${idx} OFFSET $${idx + 1}
        `, values);

        sendResponse(res, true, 'Cities retrieved successfully', {
            page,
            limit,
            count: result.length,
            cities: result
        });
    } catch (err) {
        console.error('Error GET /cities:', err);
        sendResponse(res, false, 'Failed to retrieve cities', null, 500);
    }
});

// =====================
// 📍 إضافة مدينة جديدة (Admin/Manager فقط)
// =====================
router.post('/', requireSession, requireRole(['Admin', 'Manager']), async (req, res) => {
    try {
        const cityName = req.body.cityname?.trim();
        const isActive = req.body.isactive !== undefined ? req.body.isactive : true;

        if (!cityName) return sendResponse(res, false, 'cityname is required', null, 400);

        const check = await dbQuery(`SELECT cityid FROM cities WHERE cityname = $1`, [cityName]);
        if (check.length > 0) return sendResponse(res, false, 'City already exists', null, 409);

        const inserted = await dbQuery(
            `INSERT INTO cities (cityname, isactive, createdat) VALUES ($1, $2, NOW()) RETURNING *`,
            [cityName, isActive]
        );

        sendResponse(res, true, 'City added successfully', inserted[0], 201);
    } catch (err) {
        console.error('Error POST /cities:', err);
        sendResponse(res, false, 'Failed to add city', null, 500);
    }
});

// =====================
// 📍 تعديل مدينة (Admin/Manager فقط)
// =====================
router.put('/:id', requireSession, requireRole(['Admin', 'Manager']), async (req, res) => {
    try {
        const cityID = parseInt(req.params.id);
        const cityName = req.body.cityname?.trim();
        const isActive = req.body.isactive;

        if (isNaN(cityID)) return sendResponse(res, false, 'Invalid cityid', null, 400);
        if (!cityName) return sendResponse(res, false, 'cityname is required', null, 400);

        const exists = await dbQuery(`SELECT * FROM cities WHERE cityid = $1`, [cityID]);
        if (!exists.length) return sendResponse(res, false, 'City not found', null, 404);

        const dupCheck = await dbQuery(
            `SELECT cityid FROM cities WHERE cityname = $1 AND cityid <> $2`,
            [cityName, cityID]
        );
        if (dupCheck.length > 0) return sendResponse(res, false, 'Another city with this name already exists', null, 409);

        const updated = await dbQuery(`
            UPDATE cities
            SET cityname = $1, isactive = $2, updatedat = NOW()
            WHERE cityid = $3
            RETURNING *
        `, [cityName, isActive !== undefined ? isActive : exists[0].isactive, cityID]);

        sendResponse(res, true, 'City updated successfully', updated[0]);
    } catch (err) {
        console.error('Error PUT /cities/:id:', err);
        sendResponse(res, false, 'Failed to update city', null, 500);
    }
});

// =====================
// 📍 حذف مدينة (Admin/Manager فقط)
// =====================
router.delete('/:id', requireSession, requireRole(['Admin', 'Manager']), async (req, res) => {
    try {
        const cityID = parseInt(req.params.id);
        if (isNaN(cityID)) return sendResponse(res, false, 'Invalid cityid', null, 400);

        const exists = await dbQuery(`SELECT * FROM cities WHERE cityid = $1`, [cityID]);
        if (!exists.length) return sendResponse(res, false, 'City not found', null, 404);

        const areaCheck = await dbQuery(`SELECT COUNT(*) AS total FROM areas WHERE cityid = $1`, [cityID]);
        if (parseInt(areaCheck[0].total) > 0)
            return sendResponse(res, false, 'Cannot delete city with linked areas', null, 400);

        const deleted = await dbQuery(`DELETE FROM cities WHERE cityid = $1 RETURNING *`, [cityID]);
        sendResponse(res, true, 'City deleted successfully', deleted[0]);
    } catch (err) {
        console.error('Error DELETE /cities/:id:', err);
        sendResponse(res, false, 'Failed to delete city', null, 500);
    }
});

module.exports = router;
