// routes/transactions.js
const express = require('express');
const router = express.Router();
const sql = require('../db'); // الاتصال بقاعدة PostgreSQL

// دالة موحدة للرد
const sendResponse = (res, success, message, data = null, status = 200) => {
    res.status(status).json({ success, message, data, timestamp: new Date() });
};

// ==========================
// دوال التعامل مع قاعدة البيانات
// ==========================

// الحصول على كل المعاملات
async function getAllTransactions() {
    try {
        const result = await sql.query(`SELECT * FROM "transactions" ORDER BY "transactiondate" DESC`);
        return result.rows;
    } catch (err) {
        throw new Error(err.message);
    }
}

// الحصول على معاملة حسب ID
async function getTransactionById(id) {
    try {
        const result = await sql.query(`SELECT * FROM "transactions" WHERE "transactionid" = $1`, [id]);
        return result.rows[0] || null;
    } catch (err) {
        throw new Error(err.message);
    }
}

// إنشاء معاملة جديدة
async function createTransaction(data) {
    try {
        const { orderid, amount, paymentmethod } = data;
        if (!orderid || !amount || !paymentmethod) throw new Error("Missing required fields");

        const result = await sql.query(`
            INSERT INTO "transactions" ("orderid", "amount", "paymentmethod", "transactiondate")
            VALUES ($1, $2, $3, NOW())
            RETURNING *
        `, [orderid, amount, paymentmethod]);

        return result.rows[0];
    } catch (err) {
        throw new Error(err.message);
    }
}

// تحديث معاملة موجودة
async function updateTransaction(id, data) {
    try {
        const existing = await getTransactionById(id);
        if (!existing) throw new Error('Transaction not found');

        const { orderid, amount, paymentmethod } = data;

        const result = await sql.query(`
            UPDATE "transactions"
            SET "orderid" = COALESCE($1, "orderid"),
                "amount" = COALESCE($2, "amount"),
                "paymentmethod" = COALESCE($3, "paymentmethod")
            WHERE "transactionid" = $4
            RETURNING *
        `, [orderid, amount, paymentmethod, id]);

        return result.rows[0];
    } catch (err) {
        throw new Error(err.message);
    }
}

// حذف معاملة
async function deleteTransaction(id) {
    try {
        const result = await sql.query(`
            DELETE FROM "transactions"
            WHERE "transactionid" = $1
            RETURNING *
        `, [id]);
        if (!result.rows.length) throw new Error('Transaction not found');
        return result.rows[0];
    } catch (err) {
        throw new Error(err.message);
    }
}

// ==========================
// Routes
// ==========================

// 🔹 GET جميع المعاملات
router.get('/', async (req, res) => {
    try {
        const transactions = await getAllTransactions();
        sendResponse(res, true, 'Transactions fetched successfully', transactions);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// 🔹 GET معاملة واحدة
router.get('/:id', async (req, res) => {
    try {
        const transaction = await getTransactionById(req.params.id);
        if (!transaction) return sendResponse(res, false, 'Transaction not found', null, 404);
        sendResponse(res, true, 'Transaction fetched successfully', transaction);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// 🔹 POST إنشاء معاملة
router.post('/', async (req, res) => {
    try {
        const newTransaction = await createTransaction(req.body);
        sendResponse(res, true, 'Transaction created successfully', newTransaction, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// 🔹 PUT تحديث معاملة
router.put('/:id', async (req, res) => {
    try {
        const updated = await updateTransaction(req.params.id, req.body);
        sendResponse(res, true, 'Transaction updated successfully', updated);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// 🔹 DELETE حذف معاملة
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await deleteTransaction(req.params.id);
        sendResponse(res, true, 'Transaction deleted successfully', deleted);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
