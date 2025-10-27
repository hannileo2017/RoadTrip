// routes/users.js
const express = require('express');
const router = express.Router();
const { poolPromise } = require('../db');

// ✅ جلب جميع المستخدمين
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Users');
        res.json({ success: true, users: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ✅ جلب مستخدم محدد
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', req.params.id)
            .query('SELECT * FROM Users WHERE UserID=@UserID');

        if (result.recordset.length === 0)
            return res.status(404).json({ success: false, message: 'User not found' });

        res.json({ success: true, user: result.recordset[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ✅ إضافة مستخدم جديد
router.post('/', async (req, res) => {
    try {
        const {
            UserID, FullName, UserName, Email, Phone, Password,
            RoleID, CityID, AreaID, Address, Status, PhotoURL,
            IsActive, FCMToken
        } = req.body;

        const pool = await poolPromise;
        await pool.request()
            .input('UserID', UserID)
            .input('FullName', FullName)
            .input('UserName', UserName)
            .input('Email', Email)
            .input('Phone', Phone)
            .input('Password', Password)
            .input('RoleID', RoleID)
            .input('CityID', CityID)
            .input('AreaID', AreaID)
            .input('Address', Address)
            .input('Status', Status)
            .input('PhotoURL', PhotoURL)
            .input('IsActive', IsActive)
            .input('FCMToken', FCMToken)
            .query(`
                INSERT INTO Users
                (UserID, FullName, UserName, Email, Phone, Password, RoleID,
                 CityID, AreaID, Address, Status, PhotoURL, IsActive, FCMToken, CreatedAt)
                VALUES
                (@UserID, @FullName, @UserName, @Email, @Phone, @Password, @RoleID,
                 @CityID, @AreaID, @Address, @Status, @PhotoURL, @IsActive, @FCMToken, GETDATE())
            `);

        res.json({ success: true, message: 'User added successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ✅ تحديث بيانات مستخدم
router.put('/:id', async (req, res) => {
    try {
        const updates = req.body;
        const keys = Object.keys(updates);
        if (keys.length === 0)
            return res.status(400).json({ success: false, message: 'No fields to update' });

        const setQuery = keys.map(k => `${k}=@${k}`).join(', ');
        const pool = await poolPromise;
        const request = pool.request().input('UserID', req.params.id);
        keys.forEach(k => request.input(k, updates[k]));

        await request.query(`UPDATE Users SET ${setQuery}, LastUpdated=GETDATE() WHERE UserID=@UserID`);
        res.json({ success: true, message: 'User updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ✅ حذف مستخدم
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request().input('UserID', req.params.id).query('DELETE FROM Users WHERE UserID=@UserID');
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ✅ تحديث FCMToken فقط
router.patch('/:id/fcmtoken', async (req, res) => {
    try {
        const { FCMToken } = req.body;
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', req.params.id)
            .input('FCMToken', FCMToken)
            .query('UPDATE Users SET FCMToken=@FCMToken, LastUpdated=GETDATE() WHERE UserID=@UserID');
        res.json({ success: true, message: 'FCMToken updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
