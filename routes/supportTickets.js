const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data, timestamp: new Date() });
}

// ==========================
// 📍 عرض جميع التذاكر
router.get('/', async (req, res) => {
    try {
        const result = await sql`SELECT * FROM "supporttickets" ORDER BY "CreatedAt" DESC`;
        sendResponse(res, true, 'Support tickets fetched successfully', { count: result.length, tickets: result });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 إنشاء تذكرة جديدة
router.post('/', async (req, res) => {
    const { UserType, UserID, Subject, Message, Status, Priority } = req.body;
    try {
        if (!UserType || !UserID || !Subject || !Message) 
            return sendResponse(res, false, 'UserType, UserID, Subject, and Message are required', null, 400);

        const result = await sql`
            INSERT INTO "SupportTickets" ("UserType","UserID","Subject","Message","Status","Priority","CreatedAt","UpdatedAt")
            VALUES (${UserType}, ${UserID}, ${Subject}, ${Message}, ${Status || 'Open'}, ${Priority || 'Normal'}, NOW(), NOW())
            RETURNING "TicketID"
        `;
        sendResponse(res, true, 'Support ticket created successfully', { TicketID: result[0].TicketID }, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 تحديث تذكرة
router.put('/:TicketID', async (req, res) => {
    const { TicketID } = req.params;
    const updateData = req.body;
    try {
        const fields = Object.keys(updateData);
        if (!fields.length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const setQuery = fields.map((f, i) => `"${f}" = ${updateData[f]}`).join(', ');
        const result = await sql`
            UPDATE "SupportTickets"
            SET ${sql.raw(setQuery)}, "UpdatedAt" = NOW()
            WHERE "TicketID" = ${TicketID}
            RETURNING *
        `;
        if (!result.length) return sendResponse(res, false, 'Ticket not found', null, 404);
        sendResponse(res, true, 'Support ticket updated successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// 📍 حذف تذكرة
router.delete('/:TicketID', async (req, res) => {
    const { TicketID } = req.params;
    try {
        const result = await sql`
            DELETE FROM "supporttickets"
            WHERE "TicketID" = ${TicketID}
            RETURNING *
        `;
        if (!result.length) return sendResponse(res, false, 'Ticket not found', null, 404);
        sendResponse(res, true, 'Support ticket deleted successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
