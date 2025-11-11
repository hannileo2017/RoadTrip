const express = require('express');
const router = express.Router();
const sql = require('../db');
require('dotenv').config();

// 🧩 دالة موحدة للردود
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// 📍 1. جلب جميع التذاكر
router.get('/', async (req, res) => {
    try {
        const result = await sql.query(
            `SELECT * FROM "supportticket" ORDER BY "createdat" DESC`
        );
        sendResponse(res, true, 'All support tickets fetched successfully', {
            count: result.rows.length,
            tickets: result.rows
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 2. جلب التذاكر حسب UserID
router.get('/user/:userid', async (req, res) => {
    const { userid } = req.params;
    try {
        const result = await sql.query(
            `SELECT * FROM "supportticket" WHERE "userid" = $1 ORDER BY "createdat" DESC`,
            [userid]
        );

        if (result.rows.length === 0)
            return sendResponse(res, false, 'No tickets found for this user', [], 404);

        sendResponse(res, true, 'Support tickets for user fetched successfully', {
            count: result.rows.length,
            tickets: result.rows
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 3. جلب التذاكر حسب نوع المستخدم (UserType)
router.get('/type/:usertype', async (req, res) => {
    const { usertype } = req.params;
    try {
        const result = await sql.query(
            `SELECT * FROM "supportticket" WHERE LOWER("usertype") = LOWER($1) ORDER BY "createdat" DESC`,
            [usertype]
        );

        if (result.rows.length === 0)
            return sendResponse(res, false, 'No tickets found for this user type', [], 404);

        sendResponse(res, true, 'Support tickets by user type fetched successfully', {
            count: result.rows.length,
            tickets: result.rows
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 4. جلب التذاكر حسب الحالة (Status)
router.get('/status/:status', async (req, res) => {
    const { status } = req.params;
    try {
        const result = await sql.query(
            `SELECT * FROM "supportticket" WHERE LOWER("status") = LOWER($1) ORDER BY "createdat" DESC`,
            [status]
        );

        if (result.rows.length === 0)
            return sendResponse(res, false, 'No tickets found for this status', [], 404);

        sendResponse(res, true, 'Support tickets by status fetched successfully', {
            count: result.rows.length,
            tickets: result.rows
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 5. إنشاء تذكرة جديدة
router.post('/', async (req, res) => {
    const { usertype, userid, subject, message, status = 'open', priority = 'normal' } = req.body;

    try {
        if (!usertype || !userid || !subject || !message)
            return sendResponse(res, false, 'usertype, userid, subject, and message are required', null, 400);

        const insertResult = await sql.query(
            `INSERT INTO "supportticket" ("usertype", "userid", "subject", "message", "status", "priority", "createdat", "updatedat")
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
             RETURNING "ticketid"`,
            [usertype, userid, subject, message, status, priority]
        );

        sendResponse(res, true, 'Support ticket created successfully', {
            ticketid: insertResult.rows[0].ticketid
        }, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 6. تحديث تذكرة
router.put('/:ticketid', async (req, res) => {
    const { ticketid } = req.params;
    const updateData = req.body;

    try {
        const fields = Object.keys(updateData);
        if (fields.length === 0) return sendResponse(res, false, 'Nothing to update', null, 400);

        const setClause = fields.map((f, i) => `"${f.toLowerCase()}" = $${i + 1}`).join(', ');
        const values = Object.values(updateData);

        const query = `
            UPDATE "supportticket"
            SET ${setClause}, "updatedat" = NOW()
            WHERE "ticketid" = $${fields.length + 1}
            RETURNING *;
        `;

        const result = await sql.query(query, [...values, ticketid]);
        if (result.rows.length === 0) return sendResponse(res, false, 'Ticket not found', null, 404);

        sendResponse(res, true, 'Support ticket updated successfully', result.rows[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 7. حذف تذكرة
router.delete('/:ticketid', async (req, res) => {
    const { ticketid } = req.params;

    try {
        const result = await sql.query(
            `DELETE FROM "supportticket" WHERE "ticketid" = $1 RETURNING *`,
            [ticketid]
        );

        if (result.rows.length === 0)
            return sendResponse(res, false, 'Ticket not found', null, 404);

        sendResponse(res, true, 'Support ticket deleted successfully', result.rows[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
