const express = require('express');
const router = express.Router();
const sql = require('../db'); // الاتصال بقاعدة بيانات PostgreSQL

// ==========================
// دالة مساعدة للرد موحدة
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// 📍 GET: عرض كل التصنيفات
router.get('/', async (req, res) => {
  try {
    const result = await sql.query(`SELECT * FROM "store_category" ORDER BY "categoryname" ASC;`);
    sendResponse(res, true, 'Categories fetched successfully', { count: result.rows.length, categories: result.rows });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 GET: عرض تصنيف محدد
router.get('/:categoryid', async (req, res) => {
  const { categoryid } = req.params;
  try {
    const result = await sql.query(`SELECT * FROM "store_category" WHERE "categoryid" = $1;`, [categoryid]);
    if (!result.rows.length) return sendResponse(res, false, 'Category not found', null, 404);
    sendResponse(res, true, 'Category fetched successfully', result.rows[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 POST: إضافة تصنيف جديد
router.post('/', async (req, res) => {
  const { categoryname, description } = req.body;
  if (!categoryname) return sendResponse(res, false, 'CategoryName is required', null, 400);

  try {
    const result = await sql.query(`
      INSERT INTO "store_category" ("categoryname", "description")
      VALUES ($1, $2)
      RETURNING *;
    `, [categoryname, description || null]);

    sendResponse(res, true, 'Category created successfully', result.rows[0], 201);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// ✏️ PUT: تحديث تصنيف
router.put('/:categoryid', async (req, res) => {
  const { categoryid } = req.params;
  const { categoryname, description } = req.body;

  if (!categoryname) return sendResponse(res, false, 'CategoryName is required', null, 400);

  try {
    const result = await sql.query(`
      UPDATE "store_category"
      SET "categoryname" = $1, "description" = $2
      WHERE "categoryid" = $3
      RETURNING *;
    `, [categoryname, description || null, categoryid]);

    if (!result.rows.length) return sendResponse(res, false, 'Category not found', null, 404);
    sendResponse(res, true, 'Category updated successfully', result.rows[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 🗑️ DELETE: حذف تصنيف
router.delete('/:categoryid', async (req, res) => {
  const { categoryid } = req.params;
  try {
    const result = await sql.query(`
      DELETE FROM "store_category"
      WHERE "categoryid" = $1
      RETURNING *;
    `, [categoryid]);

    if (!result.rows.length) return sendResponse(res, false, 'Category not found', null, 404);
    sendResponse(res, true, 'Category deleted successfully', result.rows[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
