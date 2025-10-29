const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
require('dotenv').config();
// routes/transactions.js
const express = require('express');
const router = express.Router();
const sql = require('../db'); // db.js يستخدم postgres

// دالة مساعدة للرد
const sendResponse = (res, success, message, data = null, status = 200) => {
    res.status(status).json({ success, message, data, timestamp: new Date() });
};

// ==========================
// دوال التعامل مع قاعدة البيانات
// ==========================
async function getAllTransactions() {
    try {
        const result = await sql`SELECT * FROM "transactions" ORDER BY "CreatedAt" DESC`;
        return result;
    } catch (err) {
        throw new Error(err.message);
    }
}

async function getTransactionById(id) {
    try {
        const result = await sql`SELECT * FROM "transactions" WHERE "TransactionID" = ${id}`;
        return result[0] || null;
    } catch (err) {
        throw new Error(err.message);
    }
}

async function createTransaction(data) {
    try {
        const result = await sql`
            INSERT INTO "Transactions" ("CustomerID","Amount","paymentMethod","Status","CreatedAt")
            VALUES (${data.CustomerID}, ${data.Amount}, ${data.paymentMethod || null}, ${data.Status || 'Pending'}, NOW())
            RETURNING "TransactionID"
        `;
        return result[0].TransactionID;
    } catch (err) {
        throw new Error(err.message);
    }
}

async function updateTransaction(id, data) {
    try {
        const fields = Object.keys(data);
        if (!fields.length) throw new Error('No fields to update');

        const setQuery = fields.map(f => `"${f}" = ${data[f]}`).join(', ');

        const result = await sql`
            UPDATE "Transactions"
            SET ${sql.raw(setQuery)}, "UpdatedAt" = NOW()
            WHERE "TransactionID" = ${id}
            RETURNING *
        `;
        if (!result.length) throw new Error('Transaction not found');
        return result[0];
    } catch (err) {
        throw new Error(err.message);
    }
}

async function deleteTransaction(id) {
    try {
        const result = await sql`
            DELETE FROM "transactions"
            WHERE "TransactionID" = ${id}
            RETURNING *
        `;
        if (!result.length) throw new Error('Transaction not found');
        return result[0];
    } catch (err) {
        throw new Error(err.message);
    }
}

// ==========================
// Routes
// ==========================

// GET جميع المعاملات
router.get('/', async (req, res) => {
    try {
        const transactions = await getAllTransactions();
        sendResponse(res, true, 'Transactions fetched successfully', transactions);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// GET معاملة حسب ID
router.get('/:id', async (req, res) => {
    try {
        const transaction = await getTransactionById(req.params.id);
        if (!transaction) return sendResponse(res, false, 'Transaction not found', null, 404);
        sendResponse(res, true, 'Transaction fetched successfully', transaction);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// POST لإنشاء معاملة جديدة
router.post('/', async (req, res) => {
    try {
        const transactionId = await createTransaction(req.body);
        sendResponse(res, true, 'Transaction created', { TransactionID: transactionId }, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// PUT لتحديث معاملة موجودة
router.put('/:id', async (req, res) => {
    try {
        const updatedTransaction = await updateTransaction(req.params.id, req.body);
        sendResponse(res, true, 'Transaction updated', updatedTransaction);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// DELETE لحذف معاملة
router.delete('/:id', async (req, res) => {
    try {
        const deletedTransaction = await deleteTransaction(req.params.id);
        sendResponse(res, true, 'Transaction deleted', deletedTransaction);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
