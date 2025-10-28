// routes/users.js
const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// ✅ دالة موحدة لإرسال الرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ✅ اختبار الاتصال عند تحميل الراوت (للتأكد من عمل القاعدة على Render)
(async () => {
    try {
        const pool = await poolPromise;
        console.log('📡 Users route connected to DB successfully');
    } catch (err) {
        console.error('❌ Users route DB connection error:', err.message);
    }
})();

// ==========================
// 📍 جلب جميع المستخدمين
// ==========================
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Users ORDER BY CreatedAt DESC');
        sendResponse(res, true, 'Users fetched successfully', result.recordset);
    } catch (err) {
        console.error('❌ Error fetching users:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 جلب مستخدم محدد
// ==========================
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.NVarChar(50), req.params.id)
            .query('SELECT * FROM Users WHERE UserID=@UserID');

        if (!result.recordset.length)
            return sendResponse(res, false, 'User not found', null, 404);

        sendResponse(res, true, 'User fetched successfully', result.recordset[0]);
    } catch (err) {
        console.error('❌ Error fetching user by ID:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة مستخدم جديد
// ==========================
router.post('/', async (req, res) => {
    try {
        const {
            UserID, FullName, UserName, Email, Phone, Password,
            RoleID, CityID, AreaID, Address, Status, PhotoURL,
            IsActive, FCMToken
        } = req.body;

        if (!UserID || !FullName || !Phone)
            return sendResponse(res, false, 'UserID, FullName and Phone are required', null, 400);

        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.NVarChar(50), UserID)
            .input('FullName', sql.NVarChar(200), FullName)
            .input('UserName', sql.NVarChar(100), UserName || null)
            .input('Email', sql.NVarChar(200), Email || null)
            .input('Phone', sql.NVarChar(50), Phone)
            .input('Password', sql.NVarChar(200), Password || null)
            .input('RoleID', sql.Int, RoleID || null)
            .input('CityID', sql.Int, CityID || null)
            .input('AreaID', sql.Int, AreaID || null)
            .input('Address', sql.NVarChar(400), Address || null)
            .input('Status', sql.NVarChar(100), Status || null)
            .input('PhotoURL', sql.NVarChar(400), PhotoURL || null)
            .input('IsActive', sql.Bit, IsActive ? 1 : 0)
            .input('FCMToken', sql.NVarChar(400), FCMToken || null)
            .query(`
                INSERT INTO Users
                (UserID, FullName, UserName, Email, Phone, Password, RoleID,
                 CityID, AreaID, Address, Status, PhotoURL, IsActive, FCMToken, CreatedAt)
                VALUES
                (@UserID, @FullName, @UserName, @Email, @Phone, @Password, @RoleID,
                 @CityID, @AreaID, @Address, @Status, @PhotoURL, @IsActive, @FCMToken, GETDATE())
            `);

        sendResponse(res, true, 'User added successfully');
    } catch (err) {
        console.error('❌ Error adding user:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث بيانات مستخدم
// ==========================
router.put('/:id', async (req, res) => {
    try {
        const updates = req.body;
        const keys = Object.keys(updates);
        if (keys.length === 0)
            return sendResponse(res, false, 'No fields to update', null, 400);

        const setQuery = keys.map(k => `${k}=@${k}`).join(', ');
        const pool = await poolPromise;
        const request = pool.request().input('UserID', sql.NVarChar(50), req.params.id);
        keys.forEach(k => request.input(k, updates[k]));

        await request.query(`UPDATE Users SET ${setQuery}, LastUpdated=GETDATE() WHERE UserID=@UserID`);
        sendResponse(res, true, 'User updated successfully');
    } catch (err) {
        console.error('❌ Error updating user:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف مستخدم
// ==========================
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.NVarChar(50), req.params.id)
            .query('DELETE FROM Users WHERE UserID=@UserID');

        sendResponse(res, true, 'User deleted successfully');
    } catch (err) {
        console.error('❌ Error deleting user:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث FCMToken فقط
// ==========================
router.patch('/:id/fcmtoken', async (req, res) => {
    try {
        const { FCMToken } = req.body;
        const pool = await poolPromise;

        await pool.request()
            .input('UserID', sql.NVarChar(50), req.params.id)
            .input('FCMToken', sql.NVarChar(400), FCMToken || null)
            .query('UPDATE Users SET FCMToken=@FCMToken, LastUpdated=GETDATE() WHERE UserID=@UserID');

        sendResponse(res, true, 'FCMToken updated successfully');
    } catch (err) {
        console.error('❌ Error updating FCMToken:', err);
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
