const supabase = require('../supabase');
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');

// كل روت داخل هذا الملف يستخدم التحقق
router.get('/', verifyToken, async (req, res) => {
  // هنا كود جلب الطلبات
  res.json({ message: 'Orders fetched successfully' });
});

module.exports = router;
