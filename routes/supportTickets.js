const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// عرض جميع التذاكر
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM SupportTickets');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// إنشاء تذكرة جديدة
router.post('/', async (req, res) => {
    const { TicketID, UserType, UserID, Subject, Message, Status, Priority } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('TicketID', sql.Int, TicketID)
            .input('UserType', sql.NVarChar(100), UserType)
            .input('UserID', sql.Int, UserID)
            .input('Subject', sql.NVarChar(510), Subject)
            .input('Message', sql.NVarChar(sql.MAX), Message)
            .input('Status', sql.NVarChar(100), Status)
            .input('Priority', sql.NVarChar(100), Priority)
            .input('CreatedAt', sql.DateTime, new Date())
            .input('UpdatedAt', sql.DateTime, new Date())
            .query(`INSERT INTO SupportTickets 
                    (TicketID, UserType, UserID, Subject, Message, Status, CreatedAt, UpdatedAt, Priority)
                    VALUES (@TicketID,@UserType,@UserID,@Subject,@Message,@Status,@CreatedAt,@UpdatedAt,@Priority)`);
        res.status(201).json({ message: '✅ تم إنشاء التذكرة بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// تحديث تذكرة
router.put('/:TicketID', async (req, res) => {
    const { TicketID } = req.params;
    const updateData = req.body;
    try {
        const pool = await poolPromise;
        const request = pool.request().input('TicketID', sql.Int, TicketID);
        const fields = Object.keys(updateData);
        fields.forEach(f => request.input(f, sql.NVarChar, updateData[f]));
        const setQuery = fields.map(f => `${f}=@${f}`).join(',');
        await request.query(`UPDATE SupportTickets SET ${setQuery}, UpdatedAt=GETDATE() WHERE TicketID=@TicketID`);
        res.json({ message: '✅ تم تحديث التذكرة بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// حذف تذكرة
router.delete('/:TicketID', async (req, res) => {
    const { TicketID } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request().input('TicketID', sql.Int, TicketID)
            .query('DELETE FROM SupportTickets WHERE TicketID=@TicketID');
        res.json({ message: '✅ تم حذف التذكرة بنجاح' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
