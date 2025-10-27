const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// 📍 عرض كل المنتجات
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Products ORDER BY LastUpdated DESC');
        sendResponse(res, true, 'Products fetched successfully', { count: result.recordset.length, products: result.recordset });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 عرض منتج محدد
router.get('/:ProductID', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('ProductID', sql.Int, req.params.ProductID)
            .query('SELECT * FROM Products WHERE ProductID=@ProductID');
        if (!result.recordset.length) return sendResponse(res, false, 'Product not found', null, 404);
        sendResponse(res, true, 'Product fetched successfully', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة منتج جديد
router.post('/', async (req, res) => {
    try {
        const { StoreID, ProductName, Category, Price, Discount, ImageURL, UnitID, Description, IsAvailable, OriginalPrice, DiscountedPrice } = req.body;
        if (!StoreID || !ProductName || !Price) 
            return sendResponse(res, false, 'StoreID, ProductName, and Price are required', null, 400);

        const pool = await poolPromise;
        const result = await pool.request()
            .input('StoreID', sql.Int, StoreID)
            .input('ProductName', sql.NVarChar(200), ProductName)
            .input('Category', sql.NVarChar(100), Category || null)
            .input('Price', sql.Decimal(9,2), Price)
            .input('Discount', sql.Decimal(5,2), Discount || 0)
            .input('ImageURL', sql.NVarChar(1000), ImageURL || null)
            .input('UnitID', sql.Int, UnitID || null)
            .input('Description', sql.NVarChar(1000), Description || null)
            .input('IsAvailable', sql.Bit, IsAvailable !== undefined ? IsAvailable : true)
            .input('LastUpdated', sql.DateTime, new Date())
            .input('OriginalPrice', sql.Decimal(9,2), OriginalPrice || Price)
            .input('DiscountedPrice', sql.Decimal(9,2), DiscountedPrice || Price)
            .query(`INSERT INTO Products 
                    (StoreID, ProductName, Category, Price, Discount, ImageURL, UnitID, Description, IsAvailable, LastUpdated, OriginalPrice, DiscountedPrice)
                    VALUES 
                    (@StoreID,@ProductName,@Category,@Price,@Discount,@ImageURL,@UnitID,@Description,@IsAvailable,@LastUpdated,@OriginalPrice,@DiscountedPrice);
                    SELECT SCOPE_IDENTITY() AS ProductID`);
        sendResponse(res, true, 'Product created successfully', { ProductID: result.recordset[0].ProductID });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث منتج (تحديث جزئي)
router.put('/:ProductID', async (req, res) => {
    try {
        const updateData = req.body;
        const keys = Object.keys(updateData);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const pool = await poolPromise;
        const request = pool.request().input('ProductID', sql.Int, req.params.ProductID);

        keys.forEach(k => {
            let type = sql.NVarChar;
            if (['Price', 'Discount', 'OriginalPrice', 'DiscountedPrice'].includes(k)) type = sql.Decimal(9,2);
            if (['IsAvailable'].includes(k)) type = sql.Bit;
            if (['LastUpdated'].includes(k)) type = sql.DateTime;
            request.input(k, type, updateData[k]);
        });

        // تحديث LastUpdated تلقائي إذا لم يكن موجود
        if (!keys.includes('LastUpdated')) {
            request.input('LastUpdated', sql.DateTime, new Date());
            keys.push('LastUpdated');
        }

        const setQuery = keys.map(k => `${k}=@${k}`).join(', ');
        await request.query(`UPDATE Products SET ${setQuery} WHERE ProductID=@ProductID`);
        sendResponse(res, true, 'Product updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف منتج
router.delete('/:ProductID', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('ProductID', sql.Int, req.params.ProductID)
            .query('DELETE FROM Products WHERE ProductID=@ProductID');
        sendResponse(res, true, 'Product deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
