const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// 📍 جلب كل الإشعارات
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT * FROM Notifications ORDER BY CreatedAt DESC');
        sendResponse(res, true, 'Notifications fetched successfully', result.recordset);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب إشعار حسب ID
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('NotificationID', sql.Int, req.params.id)
            .query('SELECT * FROM Notifications WHERE NotificationID=@NotificationID');

        if (!result.recordset.length) return sendResponse(res, false, 'Notification not found', null, 404);

        sendResponse(res, true, 'Notification fetched', result.recordset[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إنشاء إشعار جديد
router.post('/', async (req, res) => {
    try {
        const { UserType, UserID, Message, Title, NotificationType } = req.body;
        if (!UserType || !Message) return sendResponse(res, false, 'UserType and Message are required', null, 400);

        const pool = await poolPromise;
        await pool.request()
            .input('UserType', sql.NVarChar(100), UserType)
            .input('UserID', sql.Int, UserID || null)
            .input('Message', sql.NVarChar(510), Message)
            .input('IsRead', sql.Bit, 0)
            .input('CreatedAt', sql.DateTime, new Date())
            .input('Title', sql.NVarChar(400), Title || null)
            .input('NotificationType', sql.NVarChar(200), NotificationType || null)
            .query(`INSERT INTO Notifications (UserType, UserID, Message, IsRead, CreatedAt, Title, NotificationType)
                    VALUES (@UserType, @UserID, @Message, @IsRead, @CreatedAt, @Title, @NotificationType)`);

        sendResponse(res, true, 'Notification created successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث إشعار
router.put('/:id', async (req, res) => {
    try {
        const { UserType, UserID, Message, IsRead, Title, NotificationType } = req.body;
        const pool = await poolPromise;
        const request = pool.request().input('NotificationID', sql.Int, req.params.id);

        const fields = {};
        if (UserType !== undefined) fields.UserType = UserType;
        if (UserID !== undefined) fields.UserID = UserID;
        if (Message !== undefined) fields.Message = Message;
        if (IsRead !== undefined) fields.IsRead = IsRead;
        if (Title !== undefined) fields.Title = Title;
        if (NotificationType !== undefined) fields.NotificationType = NotificationType;

        const keys = Object.keys(fields);
        if (!keys.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        keys.forEach(k => {
            let type = sql.NVarChar;
            if (['UserID'].includes(k)) type = sql.Int;
            if (['IsRead'].includes(k)) type = sql.Bit;
            request.input(k, type, fields[k]);
        });

        const setQuery = keys.map(k => `${k}=@${k}`).join(', ');
        await request.query(`UPDATE Notifications SET ${setQuery}, UpdatedAt=GETDATE() WHERE NotificationID=@NotificationID`);

        sendResponse(res, true, 'Notification updated successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف إشعار
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('NotificationID', sql.Int, req.params.id)
            .query('DELETE FROM Notifications WHERE NotificationID=@NotificationID');
        sendResponse(res, true, 'Notification deleted successfully');
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
