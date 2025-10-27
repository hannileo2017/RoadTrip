const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// 📍 جلب كل Device Tokens
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT * FROM DeviceTokens ORDER BY TokenID DESC');
        sendResponse(res, true, 'Device tokens fetched successfully', result.recordset);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب Device Token حسب ID
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('TokenID', sql.Int, req.params.id)
            .query('SELECT * FROM DeviceTokens WHERE TokenID=@TokenID');

        if (!result.recordset.length) return sendResponse(res, false, 'Device token not found', null, 404);

        sendResponse(res, true, 'Device token fetched', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إنشاء Device Token جديد
router.post('/', async (req, res) => {
    try {
        const { UserID, DriverID, StoreID, Token, UserType } = req.body;
        if (!Token || !UserType) return sendResponse(res, false, 'Token and UserType are required', null, 400);

        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.Int, UserID || null)
            .input('DriverID', sql.NVarChar(80), DriverID || null)
            .input('StoreID', sql.Int, StoreID || null)
            .input('Token', sql.NVarChar(1000), Token)
            .input('UserType', sql.NVarChar(100), UserType)
            .input('CreatedAt', sql.DateTime, new Date())
            .query(`INSERT INTO DeviceTokens (UserID, DriverID, StoreID, Token, UserType, CreatedAt)
                    VALUES (@UserID, @DriverID, @StoreID, @Token, @UserType, @CreatedAt)`);

        sendResponse(res, true, 'Device token created successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث Device Token
router.put('/:id', async (req, res) => {
    try {
        const { UserID, DriverID, StoreID, Token, UserType } = req.body;
        const pool = await poolPromise;
        const request = pool.request().input('TokenID', sql.Int, req.params.id);

        const setQuery = [];
        if (UserID !== undefined) { request.input('UserID', sql.Int, UserID); setQuery.push('UserID=@UserID'); }
        if (DriverID !== undefined) { request.input('DriverID', sql.NVarChar(80), DriverID); setQuery.push('DriverID=@DriverID'); }
        if (StoreID !== undefined) { request.input('StoreID', sql.Int, StoreID); setQuery.push('StoreID=@StoreID'); }
        if (Token !== undefined) { request.input('Token', sql.NVarChar(1000), Token); setQuery.push('Token=@Token'); }
        if (UserType !== undefined) { request.input('UserType', sql.NVarChar(100), UserType); setQuery.push('UserType=@UserType'); }

        if (!setQuery.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        await request.query(`UPDATE DeviceTokens SET ${setQuery.join(', ')}, UpdatedAt=GETDATE() WHERE TokenID=@TokenID`);
        sendResponse(res, true, 'Device token updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف Device Token
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('TokenID', sql.Int, req.params.id)
            .query('DELETE FROM DeviceTokens WHERE TokenID=@TokenID');
        sendResponse(res, true, 'Device token deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
