const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// 📍 عرض كل التصنيفات
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM StoreCategories ORDER BY CategoryName ASC');
        sendResponse(res, true, 'Categories fetched successfully', { count: result.recordset.length, categories: result.recordset });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 عرض تصنيف محدد
router.get('/:CategoryID', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('CategoryID', sql.Int, req.params.CategoryID)
            .query('SELECT * FROM StoreCategories WHERE CategoryID=@CategoryID');
        if (!result.recordset.length) return sendResponse(res, false, 'Category not found', null, 404);
        sendResponse(res, true, 'Category fetched successfully', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة تصنيف جديد
router.post('/', async (req, res) => {
    try {
        const { CategoryName } = req.body;
        if (!CategoryName) return sendResponse(res, false, 'CategoryName is required', null, 400);

        const pool = await poolPromise;
        const result = await pool.request()
            .input('CategoryName', sql.NVarChar(400), CategoryName)
            .query(`INSERT INTO StoreCategories (CategoryName)
                    VALUES (@CategoryName);
                    SELECT SCOPE_IDENTITY() AS CategoryID`);
        sendResponse(res, true, 'Category created successfully', { CategoryID: result.recordset[0].CategoryID });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث تصنيف
router.put('/:CategoryID', async (req, res) => {
    try {
        const { CategoryID } = req.params;
        const { CategoryName } = req.body;
        if (!CategoryName) return sendResponse(res, false, 'CategoryName is required', null, 400);

        const pool = await poolPromise;
        await pool.request()
            .input('CategoryID', sql.Int, CategoryID)
            .input('CategoryName', sql.NVarChar(400), CategoryName)
            .query('UPDATE StoreCategories SET CategoryName=@CategoryName WHERE CategoryID=@CategoryID');
        sendResponse(res, true, 'Category updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف تصنيف
router.delete('/:CategoryID', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('CategoryID', sql.Int, req.params.CategoryID)
            .query('DELETE FROM StoreCategories WHERE CategoryID=@CategoryID');
        sendResponse(res, true, 'Category deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
