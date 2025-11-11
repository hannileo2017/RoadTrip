const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth'); // ملف الميدلوير لحماية التوكن والدور

// --- GET all __migrationhistory ---
// محمي: يحتاج توكن صالح
router.get('/', verifyToken, async (req, res) => {
    try {
        res.json({ message: 'GET all __migrationhistory' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- CREATE new __migrationhistory ---
// محمي: يحتاج توكن صالح + صلاحية admin مثلاً
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const body = req.body;

        // --- توليد الحقول الخاصة ---
        // مثال: body.createdAt = new Date();

        res.json({ message: 'Created new __migrationhistory' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
