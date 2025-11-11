// routes/drivers.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireSession, requireRole, dbQuery } = require('../middleware/auth');

// =====================
// Helpers
// =====================
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({
    success,
    message,
    timestamp: new Date().toISOString(),
    data
  });
}

function generateSalt(size = 16) {
  return crypto.randomBytes(size).toString('base64');
}

function hashPasswordWithSalt(password, salt) {
  const h = crypto.createHash('sha256');
  h.update(salt + password, 'utf8');
  return h.digest('hex');
}

function makeStoredPassword(password) {
  const salt = generateSalt();
  const hash = hashPasswordWithSalt(password, salt);
  return `${salt}:${hash}`;
}

function verifyStoredPassword(stored, password) {
  const parts = (stored || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  return hashPasswordWithSalt(password, salt) === hash;
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// =====================
// Routes (محميّة حيث يلزم)
// =====================

// GET: قائمة السائقين مع بحث و pagination
// محمي: يحتاج جلسة وصلاحية Admin أو Manager
router.get('/', requireSession, requireRole(['Admin','Manager']), async (req, res) => {
  try {
    let { page = 1, limit = 10, search = '' } = req.query;
    page = parseInt(page) || 1;
    limit = Math.min(parseInt(limit) || 10, 100);
    const offset = (page - 1) * limit;

    const params = [];
    const whereParts = [];

    if (search) {
      params.push(`%${search}%`);
      // نستخدم نفس المعامل للـ fullname و phone (يسمح بإعادة استخدام $n)
      whereParts.push(`(fullname ILIKE $${params.length} OR phone ILIKE $${params.length})`);
    }

    const whereSQL = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    params.push(limit, offset);

    const query = `
      SELECT *
      FROM drivers
      ${whereSQL}
      ORDER BY createdat DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const rows = await dbQuery(query, params);
    // جمع العدد الكلي (يمكن تحسين بعرض count منفصل لتحسين الأداء عند الحاجة)
    const countQuery = `SELECT COUNT(*)::int AS total FROM drivers ${whereSQL}`;
    const totalResult = await dbQuery(countQuery, params.slice(0, params.length - 2));

    sendResponse(res, true, 'Drivers list retrieved', {
      page,
      limit,
      total: totalResult[0] ? totalResult[0].total : (rows.length || 0),
      drivers: rows
    });
  } catch (err) {
    console.error('GET /drivers error:', err);
    sendResponse(res, false, 'Server error retrieving drivers', null, 500);
  }
});

// GET: سائق واحد
router.get('/:driverid', requireSession, requireRole(['Admin','Manager']), async (req, res) => {
  try {
    const { driverid } = req.params;
    const rows = await dbQuery('SELECT * FROM drivers WHERE driverid=$1 LIMIT 1', [driverid]);
    if (!rows.length) {
      console.warn(`Attempt to GET non-existing driver ${driverid} by ${req.user?.username || 'unknown'}`);
      return sendResponse(res, false, 'Driver not found', null, 404);
    }
    sendResponse(res, true, 'Driver retrieved', rows[0]);
  } catch (err) {
    console.error('GET /drivers/:id error:', err);
    sendResponse(res, false, 'Server error retrieving driver', null, 500);
  }
});

// POST: إضافة سائق (Admin/Manager)
router.post('/', requireSession, requireRole(['Admin','Manager']), async (req, res) => {
  try {
    const {
      fullname, phone, email, password,
      vehicletype, vehiclenumber, licensenumber, nationalid,
      address, cityid, areaid, status, maxload, model,
      notes, photourl, available, rating, fcmtoken,
      nationalcardurl, licenseurl, qrcode
    } = req.body;

    if (!fullname || !phone) return sendResponse(res, false, 'fullname & phone are required', null, 400);

    const dup = await dbQuery('SELECT driverid FROM drivers WHERE phone=$1 LIMIT 1', [phone]);
    if (dup.length) return sendResponse(res, false, 'Phone already registered', null, 409);

    const driverid = `DRV-${Date.now()}-${(crypto.randomUUID ? crypto.randomUUID().slice(0,8) : crypto.randomBytes(4).toString('hex'))}`;
    const storedPwd = password ? makeStoredPassword(password) : null;
    const isActiveVal = true;
    const availableVal = (typeof available === 'boolean') ? available : true;

    const insertQuery = `
      INSERT INTO drivers (
        driverid, fullname, phone, email, password,
        vehicletype, vehiclenumber, licensenumber, nationalid,
        address, isactive, createdat, cityid, areaid, status,
        maxload, model, lastupdated, notes, photourl, available,
        rating, fcmtoken, nationalcardurl, licenseurl, otp, qrcode, otpexpires
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,
        $10,$11,NOW(),$12,$13,$14,
        $15,$16,NOW(),$17,$18,$19,
        $20,$21,$22,$23,$24,$25,$26
      )
      RETURNING *
    `;

    const params = [
      driverid, fullname, phone, email || null, storedPwd,
      vehicletype || null, vehiclenumber || null, licensenumber || null, nationalid || null,
      address || null, isActiveVal, cityid || null, areaid || null, status || null,
      maxload || null, model || null, notes || null, photourl || null, availableVal,
      rating || null, fcmtoken || null, nationalcardurl || null, licenseurl || null,
      null, qrcode || null, null
    ];

    const result = await dbQuery(insertQuery, params);
    sendResponse(res, true, 'Driver created', result[0], 201);
  } catch (err) {
    console.error('POST /drivers error:', err);
    sendResponse(res, false, 'Server error creating driver', null, 500);
  }
});

// PUT: تحديث سائق (Admin/Manager)
router.put('/:driverid', requireSession, requireRole(['Admin','Manager']), async (req, res) => {
  try {
    const { driverid } = req.params;
    const updateData = { ...req.body };
    if (!Object.keys(updateData).length) return sendResponse(res, false, 'Nothing to update', null, 400);

    if (updateData.password) updateData.password = makeStoredPassword(updateData.password);

    const keys = Object.keys(updateData).filter(k => updateData[k] !== undefined);
    if (!keys.length) return sendResponse(res, false, 'No valid fields to update', null, 400);

    const setClauses = keys.map((k, i) => `"${k}"=$${i + 1}`).join(', ');
    const params = keys.map(k => updateData[k]);
    params.push(driverid);

    const query = `UPDATE drivers SET ${setClauses}, lastupdated=NOW() WHERE driverid=$${params.length} RETURNING *`;
    const result = await dbQuery(query, params);
    if (!result.length) return sendResponse(res, false, 'Driver not found', null, 404);

    sendResponse(res, true, 'Driver updated', result[0]);
  } catch (err) {
    console.error('PUT /drivers/:id error:', err);
    sendResponse(res, false, 'Server error updating driver', null, 500);
  }
});

// DELETE: حذف سائق (Admin/Manager)
router.delete('/:driverid', requireSession, requireRole(['Admin','Manager']), async (req, res) => {
  try {
    const { driverid } = req.params;
    const result = await dbQuery('DELETE FROM drivers WHERE driverid=$1 RETURNING *', [driverid]);
    if (!result.length) {
      console.warn(`Attempt to delete non-existing driver ${driverid} by ${req.user?.username || 'unknown'}`);
      return sendResponse(res, false, 'Driver not found', null, 404);
    }
    sendResponse(res, true, 'Driver deleted', result[0]);
  } catch (err) {
    console.error('DELETE /drivers/:id error:', err);
    sendResponse(res, false, 'Server error deleting driver', null, 500);
  }
});

// ----------------- OTP Endpoints بدون جلسة -----------------

// طلب OTP لإعادة التفعيل/استعادة الحساب
router.post('/request-reset', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return sendResponse(res, false, 'Phone required', null, 400);

    const r = await dbQuery('SELECT driverid FROM drivers WHERE phone=$1 LIMIT 1', [phone]);
    if (!r.length) return sendResponse(res, false, 'Driver not found', null, 404);

    const otp = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await dbQuery('UPDATE drivers SET otp=$1, otpexpires=$2 WHERE phone=$3', [otp, expires, phone]);

    if (process.env.NODE_ENV !== 'production') {
      return sendResponse(res, true, 'OTP generated (development)', { otp, expiresAt: expires });
    }

    // في بيئة الإنتاج أضف هنا إرسال SMS فعلي
    sendResponse(res, true, 'OTP generated');
  } catch (err) {
    console.error('POST /drivers/request-reset error:', err);
    sendResponse(res, false, 'Server error generating OTP', null, 500);
  }
});

// التحقق من OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return sendResponse(res, false, 'Phone & OTP required', null, 400);

    const r = await dbQuery('SELECT otp, otpexpires FROM drivers WHERE phone=$1 LIMIT 1', [phone]);
    if (!r.length) return sendResponse(res, false, 'Driver not found', null, 404);

    const drv = r[0];
    if (!drv.otp || drv.otp !== otp) {
      console.warn(`Invalid OTP attempt for ${phone}`);
      return sendResponse(res, false, 'Invalid OTP', null, 400);
    }
    if (drv.otpexpires && new Date(drv.otpexpires) < new Date()) {
      console.warn(`Expired OTP attempt for ${phone}`);
      return sendResponse(res, false, 'OTP expired', null, 400);
    }

    sendResponse(res, true, 'OTP verified');
  } catch (err) {
    console.error('POST /drivers/verify-otp error:', err);
    sendResponse(res, false, 'Server error verifying OTP', null, 500);
  }
});

// إعادة تعيين كلمة المرور بالـ OTP
router.post('/reset-password', async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body;
    if (!phone || !otp || !newPassword) return sendResponse(res, false, 'Phone, OTP & newPassword required', null, 400);

    const r = await dbQuery('SELECT otp, otpexpires FROM drivers WHERE phone=$1 LIMIT 1', [phone]);
    if (!r.length) return sendResponse(res, false, 'Driver not found', null, 404);

    const drv = r[0];
    if (!drv.otp || drv.otp !== otp) {
      console.warn(`Invalid OTP attempt for reset-password ${phone}`);
      return sendResponse(res, false, 'Invalid OTP', null, 400);
    }
    if (drv.otpexpires && new Date(drv.otpexpires) < new Date()) {
      console.warn(`Expired OTP attempt for reset-password ${phone}`);
      return sendResponse(res, false, 'OTP expired', null, 400);
    }

    const storedPass = makeStoredPassword(newPassword);
    await dbQuery('UPDATE drivers SET password=$1, otp=NULL, otpexpires=NULL, lastupdated=NOW() WHERE phone=$2', [storedPass, phone]);

    sendResponse(res, true, 'Password reset successfully');
  } catch (err) {
    console.error('POST /drivers/reset-password error:', err);
    sendResponse(res, false, 'Server error resetting password', null, 500);
  }
});

module.exports = router;
