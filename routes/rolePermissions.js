// routes/role_permission.js
const express = require('express');
const router = express.Router();
const sql = require('../db'); // اتصال PostgreSQL

// دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// ==========================
// GET: جلب كل الصلاحيات (مع اختيار الانضمام إلى اسم الدور)
router.get('/', async (req, res) => {
  try {
    const result = await sql.query(`
      SELECT rp.*, r.rolename
      FROM "role_permission" rp
      LEFT JOIN "roles" r ON rp.roleid = r.roleid
      ORDER BY rp.permissionid ASC
    `);
    sendResponse(res, true, 'Role permissions fetched successfully', result.rows);
  } catch (err) {
    console.error('Error GET /role_permission:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// GET: جلب صلاحيات دور معين
router.get('/role/:roleid', async (req, res) => {
  const { roleid } = req.params;
  try {
    const result = await sql.query(
      `SELECT rp.*, r.rolename
       FROM "role_permission" rp
       LEFT JOIN "roles" r ON rp.roleid = r.roleid
       WHERE rp.roleid = $1
       ORDER BY rp.permissionid ASC`,
      [roleid]
    );
    sendResponse(res, true, 'Role permissions fetched successfully', result.rows);
  } catch (err) {
    console.error('Error GET /role_permission/role/:roleid', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// GET: جلب صلاحية واحدة بحسب permissionid
router.get('/:permissionid', async (req, res) => {
  const { permissionid } = req.params;
  try {
    const result = await sql.query(`SELECT * FROM "role_permission" WHERE permissionid = $1`, [permissionid]);
    if (!result.rows.length) return sendResponse(res, false, 'Permission not found', null, 404);
    sendResponse(res, true, 'Permission fetched successfully', result.rows[0]);
  } catch (err) {
    console.error('Error GET /role_permission/:permissionid', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// POST: إضافة صلاحية جديدة (مع تحقق من وجود الدور ومنع التكرار)
router.post('/', async (req, res) => {
  try {
    const { permissionid, roleid, permissionkey, canview = false, canedit = false, candelete = false, canadd = false } = req.body;

    if (roleid === undefined || !permissionkey) {
      return sendResponse(res, false, 'roleid and permissionkey are required', null, 400);
    }

    // تحقق من وجود الدور
    const roleCheck = await sql.query(`SELECT 1 FROM "roles" WHERE roleid = $1`, [roleid]);
    if (!roleCheck.rows.length) return sendResponse(res, false, 'Role not found', null, 404);

    // تحقق من عدم تكرار نفس permissionkey لنفس الدور
    const dup = await sql.query(
      `SELECT 1 FROM "role_permission" WHERE roleid = $1 AND permissionkey = $2`,
      [roleid, permissionkey]
    );
    if (dup.rows.length) return sendResponse(res, false, 'Permission already exists for this role', null, 409);

    // إدراج جديد
    const insertQuery = `
      INSERT INTO "role_permission" (permissionid, roleid, permissionkey, canview, canedit, candelete, canadd)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    // إذا permissionid undefined سيتم إدخال NULL ويُفترض أن العمود SERIAL يتعامل مع ذلك
    const vals = [permissionid || null, roleid, permissionkey, canview, canedit, candelete, canadd];
    const result = await sql.query(insertQuery, vals);

    sendResponse(res, true, 'Permission created successfully', result.rows[0], 201);
  } catch (err) {
    console.error('Error POST /role_permission:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// PUT: تحديث صلاحية (ديناميكي)
router.put('/:permissionid', async (req, res) => {
  try {
    const { permissionid } = req.params;
    const updateData = req.body;
    const keys = Object.keys(updateData);
    if (!keys.length) return sendResponse(res, false, 'No fields to update', null, 400);

    // إذا يحاول المستخدم تغيير roleid أو permissionkey إلى قيمة موجودة مسبقاً لنفس الدور => تحقق تكرار
    if ((updateData.roleid !== undefined || updateData.permissionkey !== undefined)) {
      const newRoleId = updateData.roleid;
      const newKey = updateData.permissionkey;
      // جلب القيم الحالية
      const existing = await sql.query(`SELECT roleid, permissionkey FROM "role_permission" WHERE permissionid = $1`, [permissionid]);
      if (!existing.rows.length) return sendResponse(res, false, 'Permission not found', null, 404);
      const current = existing.rows[0];

      const checkRole = newRoleId !== undefined ? newRoleId : current.roleid;
      const checkKey = newKey !== undefined ? newKey : current.permissionkey;

      const dup = await sql.query(
        `SELECT 1 FROM "role_permission" WHERE roleid = $1 AND permissionkey = $2 AND permissionid <> $3`,
        [checkRole, checkKey, permissionid]
      );
      if (dup.rows.length) return sendResponse(res, false, 'Another permission with same key exists for this role', null, 409);

      // إذا تم تغيير الدور فنتحقق أن الدور الجديد موجود
      if (newRoleId !== undefined) {
        const roleCheck = await sql.query(`SELECT 1 FROM "roles" WHERE roleid = $1`, [newRoleId]);
        if (!roleCheck.rows.length) return sendResponse(res, false, 'Target role not found', null, 404);
      }
    }

    // بناء جملة التحديث بشكل آمن
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = keys.map(k => updateData[k]);
    values.push(permissionid);

    const q = `
      UPDATE "role_permission"
      SET ${setClauses}
      WHERE permissionid = $${values.length}
      RETURNING *
    `;
    const result = await sql.query(q, values);
    if (!result.rows.length) return sendResponse(res, false, 'Permission not found', null, 404);

    sendResponse(res, true, 'Permission updated successfully', result.rows[0]);
  } catch (err) {
    console.error('Error PUT /role_permission/:permissionid', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// DELETE: حذف صلاحية
router.delete('/:permissionid', async (req, res) => {
  try {
    const { permissionid } = req.params;
    const result = await sql.query(`DELETE FROM "role_permission" WHERE permissionid = $1 RETURNING *`, [permissionid]);
    if (!result.rows.length) return sendResponse(res, false, 'Permission not found', null, 404);
    sendResponse(res, true, 'Permission deleted successfully', result.rows[0]);
  } catch (err) {
    console.error('Error DELETE /role_permission/:permissionid', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
