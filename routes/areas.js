const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');

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
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (page - 1) * limit;

        const pool = await poolPromise;
        const result = await pool.request()
            .input('Search', `%${search}%`)
            .query(`
                SELECT A.*, C.CityName
                FROM Areas A
                LEFT JOIN Cities C ON A.CityID = C.CityID
                WHERE A.AreaName LIKE @Search OR C.CityName LIKE @Search
                ORDER BY C.CityName, A.AreaName
                OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
            `);

        sendResponse(res, true, 'Areas retrieved successfully', {
            count: result.recordset.length,
            areas: result.recordset
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// 📍 جلب منطقة حسب ID
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('AreaID', req.params.id)
            .query(`
                SELECT A.*, C.CityName
                FROM Areas A
                LEFT JOIN Cities C ON A.CityID = C.CityID
                WHERE A.AreaID = @AreaID
            `);

        if (result.recordset.length === 0)
            return sendResponse(res, false, 'Area not found', null, 404);

        sendResponse(res, true, 'Area retrieved successfully', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// 📍 إضافة منطقة جديدة
router.post('/', async (req, res) => {
    try {
        const { AreaName, CityID } = req.body;

        if (!AreaName || !CityID)
            return sendResponse(res, false, 'AreaName and CityID are required', null, 400);

        const pool = await poolPromise;
        await pool.request()
            .input('AreaName', AreaName)
            .input('CityID', CityID)
            .query(`
                INSERT INTO Areas (AreaName, CityID, CreatedAt)
                VALUES (@AreaName, @CityID, GETDATE());
            `);

        sendResponse(res, true, 'Area added successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// 📍 تعديل بيانات منطقة
router.put('/:id', async (req, res) => {
    try {
        const { AreaName, CityID } = req.body;

        if (!AreaName || !CityID)
            return sendResponse(res, false, 'AreaName and CityID are required', null, 400);

        const pool = await poolPromise;

        // تحقق من وجود المنطقة
        const check = await pool.request()
            .input('AreaID', req.params.id)
            .query('SELECT AreaID FROM Areas WHERE AreaID=@AreaID');
        if (check.recordset.length === 0)
            return sendResponse(res, false, 'Area not found', null, 404);

        await pool.request()
            .input('AreaID', req.params.id)
            .input('AreaName', AreaName)
            .input('CityID', CityID)
            .query(`
                UPDATE Areas
                SET AreaName=@AreaName, CityID=@CityID, UpdatedAt=GETDATE()
                WHERE AreaID=@AreaID;
            `);

        sendResponse(res, true, 'Area updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// 📍 حذف منطقة
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;

        // تحقق من وجود المنطقة قبل الحذف
        const check = await pool.request()
            .input('AreaID', req.params.id)
            .query('SELECT AreaID FROM Areas WHERE AreaID=@AreaID');
        if (check.recordset.length === 0)
            return sendResponse(res, false, 'Area not found', null, 404);

        await pool.request()
            .input('AreaID', req.params.id)
            .query('DELETE FROM Areas WHERE AreaID=@AreaID');

        sendResponse(res, true, 'Area deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
