const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// 📍 عرض كل الجلسات
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Sessions ORDER BY LoginTime DESC');
        sendResponse(res, true, 'Sessions fetched successfully', { count: result.recordset.length, sessions: result.recordset });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة جلسة جديدة
router.post('/', async (req, res) => {
    try {
        const { UserID, LoginTime, LogoutTime, DeviceInfo, SessionToken } = req.body;
        if (!UserID || !LoginTime || !SessionToken) {
            return sendResponse(res, false, 'UserID, LoginTime, and SessionToken are required', null, 400);
        }

        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.Int, UserID)
            .input('LoginTime', sql.DateTime, LoginTime)
            .input('LogoutTime', sql.DateTime, LogoutTime || null)
            .input('DeviceInfo', sql.NVarChar(510), DeviceInfo || null)
            .input('SessionToken', sql.NVarChar(510), SessionToken)
            .query(`INSERT INTO Sessions (UserID, LoginTime, LogoutTime, DeviceInfo, SessionToken)
                    VALUES (@UserID, @LoginTime, @LogoutTime, @DeviceInfo, @SessionToken)`);

        sendResponse(res, true, 'Session created successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث جلسة
router.put('/:SessionID', async (req, res) => {
    try {
        const { SessionID } = req.params;
        const updateData = req.body;
        if (Object.keys(updateData).length === 0) return sendResponse(res, false, 'No fields to update', null, 400);

        const pool = await poolPromise;
        const request = pool.request().input('SessionID', sql.Int, SessionID);

        Object.keys(updateData).forEach(f => {
            const value = updateData[f];
            const type = typeof value === 'number' ? sql.Int : sql.NVarChar;
            request.input(f, type, value);
        });

        const setQuery = Object.keys(updateData).map(f => `${f}=@${f}`).join(',');
        await request.query(`UPDATE Sessions SET ${setQuery} WHERE SessionID=@SessionID`);

        sendResponse(res, true, 'Session updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف جلسة
router.delete('/:SessionID', async (req, res) => {
    try {
        const { SessionID } = req.params;
        const pool = await poolPromise;
        await pool.request().input('SessionID', sql.Int, SessionID)
            .query('DELETE FROM Sessions WHERE SessionID=@SessionID');
        sendResponse(res, true, 'Session deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
