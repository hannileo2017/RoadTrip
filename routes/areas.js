// routes/areas.js
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
// 📍 جلب جميع المناطق مع البحث + Pagination + فلترة حسب المدينة
// =====================
router.get('/', requireSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search ? req.query.search.trim() : '';
        const cityID = req.query.cityid ? parseInt(req.query.cityid) : null;
        const offset = (page - 1) * limit;

        let whereClauses = [];
        let values = [];
        let idx = 1;

        if (search) {
            whereClauses.push(`a.areaname ILIKE $${idx}`);
            values.push(`%${search}%`);
            idx++;
        }
        if (cityID) {
            whereClauses.push(`a.cityid = $${idx}`);
            values.push(cityID);
            idx++;
        }

        const whereClause = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
        values.push(limit, offset);

        const result = await dbQuery(`
            SELECT a.*, c.cityname
            FROM areas a
            LEFT JOIN cities c ON a.cityid = c.cityid
            ${whereClause}
            ORDER BY c.cityname, a.areaname
            LIMIT $${idx} OFFSET $${idx + 1}
        `, values);

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

// =====================
// 📍 جلب منطقة حسب ID
// =====================
router.get('/:id', requireSession, async (req, res) => {
    try {
        const areaID = parseInt(req.params.id);
        if (isNaN(areaID)) return sendResponse(res, false, 'Invalid AreaID', null, 400);

        const result = await dbQuery(`
            SELECT a.*, c.cityname
            FROM areas a
            LEFT JOIN cities c ON a.cityid = c.cityid
            WHERE a.areaid = $1
        `, [areaID]);

        if (!result.length) return sendResponse(res, false, `Area with ID ${areaID} not found`, null, 404);

        sendResponse(res, true, 'Area retrieved successfully', result[0]);
    } catch (err) {
        console.error('Error GET /areas/:id', err);
        sendResponse(res, false, 'Failed to retrieve area', null, 500);
    }
});

// =====================
// 📍 إضافة منطقة جديدة (Admin/Manager فقط)
// =====================
router.post('/', requireSession, requireRole(['Admin', 'Manager']), async (req, res) => {
    try {
        const { areaname, cityid } = req.body;
        const cityIdNum = parseInt(cityid);

        if (!areaname || isNaN(cityIdNum)) return sendResponse(res, false, 'areaname and valid cityid are required', null, 400);

        const cityCheck = await dbQuery(`SELECT * FROM cities WHERE cityid = $1`, [cityIdNum]);
        if (!cityCheck.length) return sendResponse(res, false, 'City not found', null, 404);

        const inserted = await dbQuery(`
            INSERT INTO areas (areaname, cityid, createdat)
            VALUES ($1, $2, NOW())
            RETURNING *
        `, [areaname, cityIdNum]);

        sendResponse(res, true, 'Area added successfully', inserted[0]);
    } catch (err) {
        console.error('Error POST /areas:', err);
        sendResponse(res, false, 'Failed to add area', null, 500);
    }
});

// =====================
// 📍 تعديل بيانات منطقة (Admin/Manager فقط)
// =====================
router.put('/:id', requireSession, requireRole(['Admin', 'Manager']), async (req, res) => {
    try {
        const areaID = parseInt(req.params.id);
        const { areaname, cityid } = req.body;
        const cityIdNum = parseInt(cityid);

        if (isNaN(areaID) || !areaname || isNaN(cityIdNum))
            return sendResponse(res, false, 'Valid areaID, areaname and cityid are required', null, 400);

        const exists = await dbQuery(`SELECT * FROM areas WHERE areaid = $1`, [areaID]);
        if (!exists.length) return sendResponse(res, false, `Area with ID ${areaID} not found`, null, 404);

        const cityCheck = await dbQuery(`SELECT * FROM cities WHERE cityid = $1`, [cityIdNum]);
        if (!cityCheck.length) return sendResponse(res, false, 'City not found', null, 404);

        const updated = await dbQuery(`
            UPDATE areas
            SET areaname = $1, cityid = $2, updatedat = NOW()
            WHERE areaid = $3
            RETURNING *
        `, [areaname, cityIdNum, areaID]);

        sendResponse(res, true, 'Area updated successfully', updated[0]);
    } catch (err) {
        console.error('Error PUT /areas/:id:', err);
        sendResponse(res, false, 'Failed to update area', null, 500);
    }
});

// =====================
// 📍 حذف منطقة (Admin/Manager فقط)
// =====================
router.delete('/:id', requireSession, requireRole(['Admin', 'Manager']), async (req, res) => {
    try {
        const areaID = parseInt(req.params.id);
        if (isNaN(areaID)) return sendResponse(res, false, 'Invalid AreaID', null, 400);

        const exists = await dbQuery(`SELECT * FROM areas WHERE areaid = $1`, [areaID]);
        if (!exists.length) return sendResponse(res, false, `Area with ID ${areaID} not found`, null, 404);

        const deleted = await dbQuery(`DELETE FROM areas WHERE areaid = $1 RETURNING *`, [areaID]);
        sendResponse(res, true, 'Area deleted successfully', deleted[0]);
    } catch (err) {
        console.error('Error DELETE /areas/:id:', err);
        sendResponse(res, false, 'Failed to delete area', null, 500);
    }
});

module.exports = router;
