const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
// routes/units.js
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// دالة مساعدة للرد
const sendResponse = (res, success, message, data = null, status = 200) => {
    res.status(status).json({ success, message, data, timestamp: new Date() });
};

// ==========================
// GET كل الوحدات
router.get('/', async (req, res) => {
    try {
        const result = await sql`SELECT * FROM "units" ORDER BY "UnitName" ASC`;
        sendResponse(res, true, 'Units fetched successfully', result);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// POST إضافة وحدة جديدة
router.post('/', async (req, res) => {
    try {
        const { UnitName, UnitCategory } = req.body;
        if (!UnitName) return sendResponse(res, false, 'UnitName is required', null, 400);

        const result = await sql`
            INSERT INTO "Units" ("UnitName","UnitCategory")
            VALUES (${UnitName}, ${UnitCategory || null})
            RETURNING "UnitID"
        `;
        sendResponse(res, true, 'Unit created successfully', { UnitID: result[0].UnitID }, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// PUT تحديث وحدة
router.put('/:UnitID', async (req, res) => {
    try {
        const { UnitID } = req.params;
        const updateData = req.body;
        const fields = Object.keys(updateData);
        if (!fields.length) return sendResponse(res, false, 'No fields to update', null, 400);

        const setQuery = fields.map(f => `"${f}" = ${updateData[f]}`).join(', ');
        const result = await sql`
            UPDATE "Units"
            SET ${sql.raw(setQuery)}
            WHERE "UnitID" = ${UnitID}
            RETURNING *
        `;
        if (!result.length) return sendResponse(res, false, 'Unit not found', null, 404);
        sendResponse(res, true, 'Unit updated successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// DELETE حذف وحدة
router.delete('/:UnitID', async (req, res) => {
    try {
        const { UnitID } = req.params;
        const result = await sql`
            DELETE FROM "units"
            WHERE "UnitID" = ${UnitID}
            RETURNING *
        `;
        if (!result.length) return sendResponse(res, false, 'Unit not found', null, 404);
        sendResponse(res, true, 'Unit deleted successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
