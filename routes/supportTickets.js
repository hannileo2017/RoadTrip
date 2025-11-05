
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

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
        const result = await sql.query(`SELECT * FROM "supporttickets" ORDER BY "CreatedAt" DESC`, [/* add params here */]);
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

        const result = await sql.query(`
            INSERT INTO "SupportTickets" ("UserType","UserID","Subject","Message","Status","Priority","CreatedAt","UpdatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING "TicketID"
        `, [/* add params here */]);
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
        const result = await sql.query(`
            UPDATE "SupportTickets"
            SET $1, "UpdatedAt" = NOW()
            WHERE "TicketID" = $2
            RETURNING *
        `, [/* add params here */]);
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
        const result = await sql.query(`
            DELETE FROM "supporttickets"
            WHERE "TicketID" = $1
            RETURNING *
        `, [/* add params here */]);
        if (!result.length) return sendResponse(res, false, 'Ticket not found', null, 404);
        sendResponse(res, true, 'Support ticket deleted successfully', result[0]);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;

// --- auto-added init shim (safe) ---
try {
  if (!module.exports) module.exports = router;
} catch(e) {}

if (!module.exports.init) {
  module.exports.init = function initRoute(opts = {}) {
    try {
      if (opts.supabaseKey && !supabase && SUPABASE_URL) {
        try {
          
          supabase = createClient(SUPABASE_URL, opts.supabaseKey);
        } catch(err) { /* ignore */ }
      }
    } catch(err) { /* ignore */ }
    return module.exports;
  };
}
