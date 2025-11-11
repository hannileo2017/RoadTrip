const express = require('express');
const router = express.Router();
const sql = require('../db');

// Helper للردود
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// GET جميع الوحدات مع دعم pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    const params = [];
    let whereSQL = '';
    if (search) {
      params.push(`%${search}%`);
      whereSQL = `WHERE unitname ILIKE $${params.length} OR unitcategory ILIKE $${params.length}`;
    }

    params.push(limit, offset);
    const query = `
      SELECT unitid, unitname, unitcategory
      FROM units
      ${whereSQL}
      ORDER BY unitid DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await sql.query(query, params);

    sendResponse(res, true, 'Units retrieved successfully', {
      page,
      limit,
      count: result.rows.length,
      units: result.rows
    });
  } catch (err) {
    console.error('GET /units error:', err);
    sendResponse(res, false, 'Failed to fetch units', null, 500);
  }
});

// GET وحدة واحدة حسب unitid
router.get('/:id', async (req, res) => {
  try {
    const unitid = parseInt(req.params.id);
    if (isNaN(unitid)) return sendResponse(res, false, 'Invalid unitid', null, 400);

    const result = await sql.query(`SELECT unitid, unitname, unitcategory FROM units WHERE unitid=$1`, [unitid]);
    if (!result.rows.length) return sendResponse(res, false, `Unit with ID ${unitid} not found`, null, 404);

    sendResponse(res, true, 'Unit retrieved successfully', result.rows[0]);
  } catch (err) {
    console.error('GET /units/:id error:', err);
    sendResponse(res, false, 'Failed to fetch unit', null, 500);
  }
});

// POST إضافة وحدة جديدة
router.post('/', async (req, res) => {
  try {
    const { unitname, unitcategory } = req.body;
    if (!unitname) return sendResponse(res, false, 'unitname is required', null, 400);

    const result = await sql.query(`
      INSERT INTO units (unitname, unitcategory)
      VALUES ($1, $2)
      RETURNING unitid, unitname, unitcategory
    `, [unitname, unitcategory || null]);

    sendResponse(res, true, 'Unit created successfully', result.rows[0], 201);
  } catch (err) {
    console.error('POST /units error:', err);
    sendResponse(res, false, 'Failed to create unit', null, 500);
  }
});

// PATCH لتحديث وحدة
router.patch('/:id', async (req, res) => {
  try {
    const unitid = parseInt(req.params.id);
    if (isNaN(unitid)) return sendResponse(res, false, 'Invalid unitid', null, 400);

    const { unitname, unitcategory } = req.body;
    if (!unitname && !unitcategory) return sendResponse(res, false, 'Nothing to update', null, 400);

    const updates = [];
    const params = [];
    let idx = 1;

    if (unitname !== undefined) { updates.push(`unitname=$${idx++}`); params.push(unitname); }
    if (unitcategory !== undefined) { updates.push(`unitcategory=$${idx++}`); params.push(unitcategory); }

    params.push(unitid);
    const result = await sql.query(`
      UPDATE units SET ${updates.join(', ')} WHERE unitid=$${idx} RETURNING unitid, unitname, unitcategory
    `, params);

    if (!result.rows.length) return sendResponse(res, false, `Unit with ID ${unitid} not found`, null, 404);
    sendResponse(res, true, 'Unit updated successfully', result.rows[0]);
  } catch (err) {
    console.error('PATCH /units/:id error:', err);
    sendResponse(res, false, 'Failed to update unit', null, 500);
  }
});

// DELETE حذف وحدة
router.delete('/:id', async (req, res) => {
  try {
    const unitid = parseInt(req.params.id);
    if (isNaN(unitid)) return sendResponse(res, false, 'Invalid unitid', null, 400);

    const result = await sql.query(`DELETE FROM units WHERE unitid=$1 RETURNING unitid`, [unitid]);
    if (!result.rows.length) return sendResponse(res, false, `Unit with ID ${unitid} not found`, null, 404);

    sendResponse(res, true, 'Unit deleted successfully');
  } catch (err) {
    console.error('DELETE /units/:id error:', err);
    sendResponse(res, false, 'Failed to delete unit', null, 500);
  }
});

module.exports = router;
