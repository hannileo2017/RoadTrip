// routes/transactions.js

const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db'); // تأكد أن لديك db.js جاهز

// ==========================
// دوال التعامل مع قاعدة البيانات
// ==========================
async function getAllTransactions() {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT * FROM Transactions ORDER BY CreatedAt DESC');
        return result.recordset;
    } catch (err) {
        throw new Error(err.message);
    }
}

async function getTransactionById(id) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('TransactionID', sql.Int, id)
            .query('SELECT * FROM Transactions WHERE TransactionID=@TransactionID');
        return result.recordset[0] || null;
    } catch (err) {
        throw new Error(err.message);
    }
}

async function createTransaction(data) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('CustomerID', sql.Int, data.CustomerID)
            .input('Amount', sql.Float, data.Amount)
            .input('PaymentMethod', sql.NVarChar(sql.MAX), data.PaymentMethod || null)
            .input('Status', sql.NVarChar(sql.MAX), data.Status || 'Pending')
            .query(`
                INSERT INTO Transactions (CustomerID, Amount, PaymentMethod, Status, CreatedAt)
                OUTPUT INSERTED.TransactionID
                VALUES (@CustomerID, @Amount, @PaymentMethod, @Status, GETDATE())
            `);
        return result.recordset[0].TransactionID;
    } catch (err) {
        throw new Error(err.message);
    }
}

async function updateTransaction(id, data) {
    try {
        const pool = await poolPromise;
        const fields = [];
        if (data.Amount !== undefined) fields.push('Amount=@Amount');
        if (data.PaymentMethod !== undefined) fields.push('PaymentMethod=@PaymentMethod');
        if (data.Status !== undefined) fields.push('Status=@Status');
        if (!fields.length) throw new Error('No fields to update');

        const query = `UPDATE Transactions SET ${fields.join(', ')}, UpdatedAt=GETDATE() WHERE TransactionID=@TransactionID`;
        const request = pool.request().input('TransactionID', sql.Int, id);
        if (data.Amount !== undefined) request.input('Amount', sql.Float, data.Amount);
        if (data.PaymentMethod !== undefined) request.input('PaymentMethod', sql.NVarChar(sql.MAX), data.PaymentMethod);
        if (data.Status !== undefined) request.input('Status', sql.NVarChar(sql.MAX), data.Status);

        await request.query(query);
        return true;
    } catch (err) {
        throw new Error(err.message);
    }
}

async function deleteTransaction(id) {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('TransactionID', sql.Int, id)
            .query('DELETE FROM Transactions WHERE TransactionID=@TransactionID');
        return true;
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
        res.json({ success: true, data: transactions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET معاملة حسب ID
router.get('/:id', async (req, res) => {
    try {
        const transaction = await getTransactionById(req.params.id);
        if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
        res.json({ success: true, data: transaction });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST لإنشاء معاملة جديدة
router.post('/', async (req, res) => {
    try {
        const transactionId = await createTransaction(req.body);
        res.json({ success: true, message: 'Transaction created', transactionId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT لتحديث معاملة موجودة
router.put('/:id', async (req, res) => {
    try {
        await updateTransaction(req.params.id, req.body);
        res.json({ success: true, message: 'Transaction updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE لحذف معاملة
router.delete('/:id', async (req, res) => {
    try {
        await deleteTransaction(req.params.id);
        res.json({ success: true, message: 'Transaction deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
