const express = require('express');
const router = express.Router();
const sql = require('../db'); // الاتصال بقاعدة بيانات PostgreSQL

// ==========================
// 📍 دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// ==========================
// 📍 عرض كل الأدوار مع ترتيب حسب roleid
router.get('/', async (req, res) => {
    try {
        const result = await sql.query(`SELECT * FROM "roles" ORDER BY "roleid" ASC`);
        sendResponse(res, true, 'Roles fetched successfully', result.rows);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 عرض دور محدد
router.get('/:roleid', async (req, res) => {
    const { roleid } = req.params;
    try {
        const result = await sql.query(`SELECT * FROM "roles" WHERE "roleid"=$1`, [roleid]);
        if (!result.rows.length) return sendResponse(res, false, '❌ الدور غير موجود', null, 404);
        sendResponse(res, true, 'Role fetched successfully', result.rows[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إضافة دور جديد مع التحقق من التكرار
router.post('/', async (req, res) => {
    const { roleid, rolename, description } = req.body;

    if (!rolename) {
        return sendResponse(res, false, '❌ اسم الدور مطلوب', null, 400);
    }

    try {
        // تحقق من وجود roleid أو rolename مسبقًا
        const existing = await sql.query(
            `SELECT * FROM "roles" WHERE "roleid"=$1 OR "rolename"=$2`,
            [roleid, rolename]
        );

        if (existing.rows.length) {
            return sendResponse(res, false, '❌ هذا الدور موجود بالفعل', null, 400);
        }

        const result = await sql.query(`
            INSERT INTO "roles" ("roleid", "rolename", "description")
            VALUES ($1, $2, $3)
            RETURNING *
        `, [roleid, rolename, description]);

        sendResponse(res, true, '✅ تم إضافة الدور بنجاح', result.rows[0], 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث دور
router.put('/:roleid', async (req, res) => {
    const { roleid } = req.params;
    const updateData = req.body;
    const keys = Object.keys(updateData);
    if (!keys.length) return sendResponse(res, false, '❌ لا يوجد بيانات لتحديثها', null, 400);

    try {
        const setClauses = keys.map((k, idx) => `"${k}"=$${idx + 1}`).join(', ');
        const values = keys.map(k => updateData[k]);
        values.push(roleid);

        const result = await sql.query(`
            UPDATE "roles"
            SET ${setClauses}
            WHERE "roleid"=$${values.length}
            RETURNING *
        `, values);

        if (!result.rows.length) return sendResponse(res, false, '❌ الدور غير موجود', null, 404);
        sendResponse(res, true, '✅ تم تحديث الدور بنجاح', result.rows[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف دور
router.delete('/:roleid', async (req, res) => {
    const { roleid } = req.params;
    try {
        const result = await sql.query(`
            DELETE FROM "roles"
            WHERE "roleid"=$1
            RETURNING *
        `, [roleid]);

        if (!result.rows.length) return sendResponse(res, false, '❌ الدور غير موجود', null, 404);
        sendResponse(res, true, '✅ تم حذف الدور بنجاح', result.rows[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
