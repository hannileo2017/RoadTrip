require('dotenv').config();
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/verifyToken');
const { sendOTP } = require('../smsSender');
const sendResponse = require('../helpers/response');
const { generateRandomPassword, generateOTP } = require('../helpers/generate');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// دالة مساعدة للتحويل إلى INT مع قيمة افتراضية
const parseIntOrDefault = (value, def = 1) => {
  const n = parseInt(value);
  return isNaN(n) ? def : n;
};

// ==========================
// 📍 جلب العملاء مع Pagination + بحث + فلترة
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 20, search = '', CityID, AreaID } = req.query;
    page = parseIntOrDefault(page, 1);
    limit = parseIntOrDefault(limit, 20);
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    const values = [];
    let where = 'WHERE 1=1';
    let idx = 1;

    if (search) {
      where += ` AND ("FullName" ILIKE $${idx} OR "Phone" ILIKE $${idx} OR "Email" ILIKE $${idx})`;
      values.push(`%${search}%`);
      idx++;
    }
    if (CityID) {
      where += ` AND "CityID"=$${idx}`;
      values.push(CityID);
      idx++;
    }
    if (AreaID) {
      where += ` AND "AreaID"=$${idx}`;
      values.push(AreaID);
      idx++;
    }

    const query = `
      SELECT "CustomerID", "FullName", "Phone", "Email", "Address", "CityID", "AreaID", "CreatedAt"
      FROM "customers"
      ${where}
      ORDER BY "CreatedAt" DESC
      OFFSET $${idx} ROWS FETCH NEXT $${idx + 1} ROWS ONLY
    `;
    values.push(offset, limit);

    const result = await client.query(query, values);
    client.release();

    sendResponse(res, true, 'Customers fetched successfully', {
      page,
      limit,
      count: result.rows.length,
      customers: result.rows
    });
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 تسجيل عميل جديد
router.post('/', async (req, res) => {
  try {
    const { FullName, Phone, Email, Address, CityID, AreaID, Password } = req.body;
    if (!FullName || !Phone) return sendResponse(res, false, 'FullName and Phone are required', null, 400);

    const client = await pool.connect();

    // تحقق من التكرار
    const dupQuery = Email
      ? 'SELECT "CustomerID" FROM "customers" WHERE "Phone"=$1 OR "Email"=$2'
      : 'SELECT "CustomerID" FROM "customers" WHERE "Phone"=$1';
    const dupValues = Email ? [Phone, Email] : [Phone];
    const dup = await client.query(dupQuery, dupValues);
    if (dup.rows.length) {
      client.release();
      return sendResponse(res, false, 'Phone or Email already registered', null, 409);
    }

    const finalPassword = Password || generateRandomPassword(8);
    const hashedPassword = await bcrypt.hash(finalPassword, SALT_ROUNDS);

    const OTP = generateOTP();
    const OTPExpires = new Date(Date.now() + 5 * 60 * 1000);

    const insertQuery = `
      INSERT INTO "customers"
        ("FullName","Phone","Email","Address","CityID","AreaID","Password","OTP","OTPExpires","CreatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      RETURNING "CustomerID","FullName","Phone","Email","CityID","AreaID"
    `;
    const insertValues = [FullName, Phone, Email || null, Address || null, CityID || null, AreaID || null,
      hashedPassword, OTP, OTPExpires
    ];

    const insertResult = await client.query(insertQuery, insertValues);
    client.release();

    // إرسال OTP
    if (process.env.NODE_ENV !== 'production') {
      return sendResponse(res, true, 'Customer created successfully. OTP sent.', {
        otp: OTP,
        password: finalPassword,
        customer: insertResult.rows[0]
      }, 201);
    }

    await sendOTP(Phone, OTP);
    sendResponse(res, true, 'Customer created successfully. OTP sent via SMS.', insertResult.rows[0], 201);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 تسجيل الدخول عبر OTP
router.post('/login-otp', async (req, res) => {
  try {
    const { Phone } = req.body;
    if (!Phone) return sendResponse(res, false, 'Phone is required', null, 400);

    const client = await pool.connect();
    const result = await client.query('SELECT "CustomerID" FROM "customers" WHERE "Phone"=$1', [Phone]);
    if (!result.rows.length) {
      client.release();
      return sendResponse(res, false, 'Phone not registered', null, 404);
    }

    const OTP = generateOTP();
    const OTPExpires = new Date(Date.now() + 5 * 60 * 1000);

    await client.query('UPDATE "customers" SET "OTP"=$1, "OTPExpires"=$2 WHERE "Phone"=$3', [OTP, OTPExpires, Phone]);
    client.release();

    if (process.env.NODE_ENV !== 'production') {
      return sendResponse(res, true, 'OTP generated successfully', { otp: OTP }, 200);
    }

    await sendOTP(Phone, OTP);
    sendResponse(res, true, 'OTP sent via SMS', null, 200);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 تحقق من OTP وتسجيل الدخول
router.post('/verify-otp', async (req, res) => {
  try {
    const { Phone, OTP } = req.body;
    if (!Phone || !OTP) return sendResponse(res, false, 'Phone and OTP required', null, 400);

    const client = await pool.connect();
    const result = await client.query(
      'SELECT "CustomerID","FullName" FROM "customers" WHERE "Phone"=$1 AND "OTP"=$2 AND "OTPExpires">NOW()',
      [Phone, OTP]
    );

    if (!result.rows.length) {
      client.release();
      return sendResponse(res, false, 'Invalid or expired OTP', null, 401);
    }

    const user = result.rows[0];
    const token = jwt.sign({ customerId: user.CustomerID }, JWT_SECRET, { expiresIn: '7d' });

    await client.query('UPDATE "customers" SET "OTP"=NULL,"OTPExpires"=NULL WHERE "Phone"=$1', [Phone]);
    client.release();

    sendResponse(res, true, 'Login successful', { token, customer: user }, 200);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 الملف الشخصي (محمي)
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT "CustomerID","FullName","Phone","Email","Address","CityID","AreaID" FROM "customers" WHERE "CustomerID"=$1',
      [req.customerId]
    );
    client.release();

    if (!result.rows.length) return sendResponse(res, false, 'Customer not found', null, 404);

    sendResponse(res, true, 'Profile fetched successfully', result.rows[0]);
  } catch (err) {
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
