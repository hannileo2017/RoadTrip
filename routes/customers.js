// routes/customers.js
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
const { supabase } = require('../supabase');
const { requireSession, requireRole, dbQuery } = require('../middleware/auth');
const { logRejectedAccess } = require('../helpers/logRejected');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const BUCKET = 'Customers';

// ----------------- Helpers -----------------
const parseIntOrDefault = (value, def = 1) => {
  const n = parseInt(value);
  return isNaN(n) ? def : n;
};

async function uploadPhoto(bucket, name, base64) {
  if (!base64) return null;
  const buf = Buffer.from(base64, 'base64');
  const objPath = `${bucket}/${name}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(objPath, buf, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objPath);
  return urlData.publicUrl;
}

async function removePhotoByUrl(publicUrl) {
  if (!publicUrl) return;
  try {
    const url = new URL(publicUrl);
    const pathParts = url.pathname.split('/');
    const objectPath = decodeURIComponent(pathParts.slice(-2).join('/')); // bucket/filename
    await supabase.storage.from(BUCKET).remove([objectPath]);
  } catch (err) {
    console.warn('⚠️ Failed to remove photo:', err.message);
  }
}

// ----------------- Routes -----------------

// GET: جميع العملاء مع فلترة + Pagination
router.get('/', verifyToken, async (req, res) => {
  try {
    let { page = 1, limit = 20, search = '', cityid, areaid } = req.query;
    page = parseIntOrDefault(page);
    limit = parseIntOrDefault(limit);
    const offset = (page - 1) * limit;

    const values = [];
    let where = 'WHERE 1=1 AND isactive=TRUE';
    let idx = 1;

    if (search) {
      where += ` AND (fullname ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`;
      values.push(`%${search}%`);
      idx++;
    }
    if (cityid) { where += ` AND cityid=$${idx}`; values.push(cityid); idx++; }
    if (areaid) { where += ` AND areaid=$${idx}`; values.push(areaid); idx++; }

    values.push(offset, limit);
    const query = `
      SELECT customerid, fullname, phone, email, address, cityid, areaid, createdat, updatedat, lastlogin, photoURL
      FROM customers
      ${where}
      ORDER BY createdat DESC
      OFFSET $${idx} ROWS FETCH NEXT $${idx + 1} ROWS ONLY
    `;
    const result = await dbQuery(query, values);

    sendResponse(res, true, 'Customers fetched successfully', {
      page,
      limit,
      count: result.length,
      customers: result
    });
  } catch (err) {
    console.error('GET /customers error:', err);
    sendResponse(res, false, err.message || 'Internal error', null, 500);
  }
});

// GET: جلب عميل واحد
router.get('/:customerid', verifyToken, async (req, res) => {
  try {
    const customerid = parseInt(req.params.customerid);
    if (isNaN(customerid)) {
      await logRejectedAccess(req.params.customerid, '/customers/:id', 'Invalid customerid');
      return sendResponse(res, false, 'Invalid customerid', null, 400);
    }

    const result = await dbQuery(
      `SELECT customerid, fullname, phone, email, address, cityid, areaid, createdat, updatedat, lastlogin, photoURL
       FROM customers WHERE customerid=$1 AND isactive=TRUE LIMIT 1`,
      [customerid]
    );

    if (!result.length) {
      await logRejectedAccess(customerid, '/customers/:id', 'Customer not found');
      return sendResponse(res, false, 'Customer not found', null, 404);
    }
    sendResponse(res, true, 'Customer fetched successfully', result[0]);
  } catch (err) {
    console.error('GET /customers/:id error:', err);
    sendResponse(res, false, err.message || 'Internal error', null, 500);
  }
});

// POST: تسجيل عميل جديد مع صورة اختيارية
router.post('/', async (req, res) => {
  try {
    const { fullname, phone, email, address, cityid, areaid, password, photoBase64 } = req.body;
    if (!fullname || !phone) {
      await logRejectedAccess(phone, '/customers', 'FullName or Phone missing');
      return sendResponse(res, false, 'FullName and Phone are required', null, 400);
    }

    const dupQuery = email ?
      'SELECT customerid FROM customers WHERE phone=$1 OR lower(email)=lower($2) LIMIT 1' :
      'SELECT customerid FROM customers WHERE phone=$1 LIMIT 1';
    const dupValues = email ? [phone, email] : [phone];
    const dup = await dbQuery(dupQuery, dupValues);
    if (dup.length) {
      await logRejectedAccess(phone, '/customers', 'Phone or Email already registered');
      return sendResponse(res, false, 'Phone or Email already registered', null, 409);
    }

    const finalPassword = password || generateRandomPassword(8);
    const hashedPassword = await bcrypt.hash(finalPassword, SALT_ROUNDS);
    const OTP = generateOTP();
    const OTPExpires = new Date(Date.now() + 5 * 60 * 1000);

    let photoURL = null;
    if (photoBase64) photoURL = await uploadPhoto(BUCKET, `customer-${Date.now()}`, photoBase64);

    const insertQuery = `
      INSERT INTO customers (fullname, phone, email, address, cityid, areaid, password, otp, otpexpires, isactive, createdat, photoURL)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,NOW(),$10)
      RETURNING customerid, fullname, phone, email, cityid, areaid, createdat, photoURL
    `;
    const insertValues = [fullname, phone, email || null, address || null, cityid || null, areaid || null,
      hashedPassword, OTP, OTPExpires, photoURL
    ];
    const result = await dbQuery(insertQuery, insertValues);

    if (process.env.NODE_ENV !== 'production') {
      return sendResponse(res, true, 'Customer created successfully. OTP generated.', {
        otp: OTP,
        password: finalPassword,
        customer: result[0]
      }, 201);
    }

    await sendOTP(phone, OTP);
    sendResponse(res, true, 'Customer created successfully. OTP sent via SMS.', result[0], 201);
  } catch (err) {
    console.error('POST /customers error:', err);
    sendResponse(res, false, err.message || 'Internal error', null, 500);
  }
});

// PUT: تحديث بيانات العميل مع صورة (تحذف القديمة عند وجودها)
router.put('/:customerid', verifyToken, async (req, res) => {
  try {
    const { customerid } = req.params;
    const { fullname, phone, email, address, cityid, areaid, password, fcmtoken, photoBase64 } = req.body;

    const check = await dbQuery('SELECT customerid, photoURL FROM customers WHERE customerid=$1 LIMIT 1', [customerid]);
    if (!check.length) {
      await logRejectedAccess(customerid, '/customers/:id', 'Customer not found for update');
      return sendResponse(res, false, 'Customer not found', null, 404);
    }

    const currentPhotoURL = check[0].photourl;
    const updateFields = [];
    const values = [];
    let idx = 1;

    // تحقق تضارب phone/email مع العملاء الآخرين
    if (phone) {
      const q = await dbQuery('SELECT customerid FROM customers WHERE phone=$1 AND customerid<>$2 LIMIT 1', [phone, customerid]);
      if (q.length) {
        await logRejectedAccess(phone, '/customers/:id', 'Phone already used by another customer');
        return sendResponse(res, false, 'Phone already used by another customer', null, 409);
      }
    }
    if (email) {
      const q = await dbQuery('SELECT customerid FROM customers WHERE lower(email)=lower($1) AND customerid<>$2 LIMIT 1', [email, customerid]);
      if (q.length) {
        await logRejectedAccess(email, '/customers/:id', 'Email already used by another customer');
        return sendResponse(res, false, 'Email already used by another customer', null, 409);
      }
    }

    if (fullname) { updateFields.push(`fullname=$${idx++}`); values.push(fullname); }
    if (phone) { updateFields.push(`phone=$${idx++}`); values.push(phone); }
    if (email) { updateFields.push(`email=$${idx++}`); values.push(email); }
    if (address) { updateFields.push(`address=$${idx++}`); values.push(address); }
    if (cityid) { updateFields.push(`cityid=$${idx++}`); values.push(cityid); }
    if (areaid) { updateFields.push(`areaid=$${idx++}`); values.push(areaid); }
    if (password) { const hashed = await bcrypt.hash(password, SALT_ROUNDS); updateFields.push(`password=$${idx++}`); values.push(hashed); }
    if (fcmtoken) { updateFields.push(`fcmtoken=$${idx++}`); values.push(fcmtoken); }

    if (photoBase64) {
      if (currentPhotoURL) await removePhotoByUrl(currentPhotoURL);
      const photoURL = await uploadPhoto(BUCKET, `customer-${customerid}-${Date.now()}`, photoBase64);
      updateFields.push(`photoURL=$${idx++}`);
      values.push(photoURL);
    }

    updateFields.push(`updatedat=NOW()`);
    if (updateFields.length === 0) return sendResponse(res, false, 'No fields to update', null, 400);

    const query = `UPDATE customers SET ${updateFields.join(', ')} WHERE customerid=$${idx} RETURNING *`;
    values.push(customerid);
    const updated = await dbQuery(query, values);

    sendResponse(res, true, 'Customer updated successfully', updated[0]);
  } catch (err) {
    console.error('PUT /customers/:id error:', err);
    sendResponse(res, false, err.message || 'Internal error', null, 500);
  }
});

// DELETE العميل
router.delete('/:customerid', verifyToken, async (req, res) => {
  try {
    const { customerid } = req.params;
    const check = await dbQuery('SELECT photoURL FROM customers WHERE customerid=$1 LIMIT 1', [customerid]);
    if (!check.length) {
      await logRejectedAccess(customerid, '/customers/:id', 'Customer not found for deletion');
      return sendResponse(res, false, 'Customer not found', null, 404);
    }

    if (check[0].photourl) await removePhotoByUrl(check[0].photourl);
    const deleted = await dbQuery('DELETE FROM customers WHERE customerid=$1 RETURNING *', [customerid]);
    sendResponse(res, true, 'Customer deleted successfully', deleted[0]);
  } catch (err) {
    console.error('DELETE /customers/:id error:', err);
    sendResponse(res, false, err.message || 'Internal error', null, 500);
  }
});

// ----------------- OTP و Password -----------------

// POST: طلب OTP لتسجيل الدخول
router.post('/login-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      await logRejectedAccess(phone, '/customers/login-otp', 'Phone missing');
      return sendResponse(res, false, 'Phone is required', null, 400);
    }

    const user = (await dbQuery('SELECT customerid FROM customers WHERE phone=$1 LIMIT 1', [phone]))[0];
    if (!user) {
      await logRejectedAccess(phone, '/customers/login-otp', 'Phone not registered');
      return sendResponse(res, false, 'Phone not registered', null, 404);
    }

    const OTP = generateOTP();
    const OTPExpires = new Date(Date.now() + 5 * 60 * 1000);
    await dbQuery('UPDATE customers SET otp=$1, otpexpires=$2 WHERE phone=$3', [OTP, OTPExpires, phone]);

    if (process.env.NODE_ENV !== 'production') {
      return sendResponse(res, true, 'OTP generated for login', { otp: OTP }, 200);
    }

    await sendOTP(phone, OTP);
    sendResponse(res, true, 'OTP sent via SMS', null, 200);
  } catch (err) {
    console.error('POST /customers/login-otp error:', err);
    sendResponse(res, false, err.message || 'Internal error', null, 500);
  }
});

// POST: التحقق من OTP وتسجيل الدخول
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp, fcmtoken } = req.body;

    if (!phone || !otp) {
      await logRejectedAccess(phone, '/verify-otp', 'Phone or OTP missing');
      return sendResponse(res, false, 'Phone and OTP required', null, 400);
    }

    const customer = (await dbQuery(
      'SELECT customerid, fullname FROM customers WHERE phone=$1 AND otp=$2 AND otpexpires>NOW() LIMIT 1',
      [phone, otp]
    ))[0];

    if (!customer) {
      await logRejectedAccess(phone, '/verify-otp', 'Invalid or expired OTP');
      return sendResponse(res, false, 'Invalid or expired OTP', null, 401);
    }

    const token = jwt.sign({ customerid: customer.customerid }, JWT_SECRET, { expiresIn: '7d' });
    const updates = ['otp=NULL', 'otpexpires=NULL', 'lastlogin=NOW()'];
    const params = [];
    if (fcmtoken) { updates.push(`fcmtoken=$1`); params.push(fcmtoken); }

    await dbQuery(
      `UPDATE customers SET ${updates.join(', ')} WHERE customerid=$${params.length + 1}`,
      [...params, customer.customerid]
    );

    sendResponse(res, true, 'Login successful', { token, customer });
  } catch (err) {
    console.error('POST /customers/verify-otp error:', err);
    sendResponse(res, false, err.message || 'Internal error', null, 500);
  }
});

// POST: تغيير كلمة المرور
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return sendResponse(res, false, 'Old and New passwords are required', null, 400);

    const customer = (await dbQuery('SELECT customerid, password FROM customers WHERE customerid=$1 LIMIT 1', [req.customerid]))[0];
    if (!customer) return sendResponse(res, false, 'Customer not found', null, 404);

    const isMatch = await bcrypt.compare(oldPassword, customer.password);
    if (!isMatch) return sendResponse(res, false, 'Old password is incorrect', null, 401);

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await dbQuery('UPDATE customers SET password=$1, updatedat=NOW() WHERE customerid=$2', [hashed, req.customerid]);

    sendResponse(res, true, 'Password updated successfully');
  } catch (err) {
    console.error('POST /customers/change-password error:', err);
    sendResponse(res, false, err.message || 'Internal error', null, 500);
  }
});

// POST: نسيت كلمة المرور (OTP)
router.post('/forgot-password', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return sendResponse(res, false, 'Phone is required', null, 400);

    const user = (await dbQuery('SELECT customerid FROM customers WHERE phone=$1 LIMIT 1', [phone]))[0];
    if (!user) return sendResponse(res, false, 'Customer not found', null, 404);

    const OTP = generateOTP();
    const OTPExpires = new Date(Date.now() + 5 * 60 * 1000);
    await dbQuery('UPDATE customers SET otp=$1, otpexpires=$2 WHERE phone=$3', [OTP, OTPExpires, phone]);

    if (process.env.NODE_ENV !== 'production') {
      return sendResponse(res, true, 'OTP generated for password reset', { otp: OTP }, 200);
    }

    await sendOTP(phone, OTP);
    sendResponse(res, true, 'OTP sent via SMS', null, 200);
  } catch (err) {
    console.error('POST /customers/forgot-password error:', err);
    sendResponse(res, false, err.message || 'Internal error', null, 500);
  }
});

// POST: إعادة تعيين كلمة المرور بعد OTP
router.post('/reset-password', async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body;
    if (!phone || !otp || !newPassword) return sendResponse(res, false, 'Phone, OTP and newPassword required', null, 400);

    const customer = (await dbQuery('SELECT customerid FROM customers WHERE phone=$1 AND otp=$2 AND otpexpires>NOW() LIMIT 1', [phone, otp]))[0];
    if (!customer) return sendResponse(res, false, 'Invalid or expired OTP', null, 401);

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await dbQuery('UPDATE customers SET password=$1, otp=NULL, otpexpires=NULL, updatedat=NOW() WHERE phone=$2', [hashed, phone]);

    sendResponse(res, true, 'Password reset successfully', null, 200);
  } catch (err) {
    console.error('POST /customers/reset-password error:', err);
    sendResponse(res, false, err.message || 'Internal error', null, 500);
  }
});

module.exports = router;
