const express = require('express');
const router = express.Router();

// --- AUTO-GENERATED ROUTE ---
router.get('/', async (req, res) => {
    res.json({ message: 'GET all coupon' });
});

router.post('/', async (req, res) => {
    const body = req.body;

    // --- توليد الحقول الخاصة ---



    res.json({ message: 'Created new coupon',  });
});

module.exports = router;
