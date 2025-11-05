// routes/driver.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); 
// auto-inserted dbQuery helper (returns rows if pg returns result object)
const dbQuery = async (...args) => {
  const r = await dbQuery(...args);
  return (r && r.rows) ? r.rows : r;
};
// تأكد أن db.js يُرجع واجهة pg/pg-pool مع .query()
const crypto = require('crypto');

let supabase = null;
const BUCKET = 'RoadTrip';

// حاول إنشاء عميل Supabase إن كانت المكتبة متوفرة وENV مضبوطة
try {
  const { createClient } = require('@supabase/supabase-js');
  const SUPABASE_URL = process.env.SUPABASE_URL || null;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || null;
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
} catch (e) {
  // لو @supabase/supabase-js غير منصب محليًا، نكمل بدون supabase
  supabase = null;
}

// ----------------- Helpers -----------------
async function removeObjectByUrl(publicUrl) {
  if (!publicUrl || !supabase) return;
  try {
    const url = new URL(publicUrl);
    const prefix = `/storage/v1/object/public/${BUCKET}/`;
    const pathname = url.pathname || '';
    if (!pathname.includes(prefix)) return;
    const objectPath = decodeURIComponent(pathname.replace(prefix, ''));
    if (objectPath) {
      const { error } = await supabase.storage.from(BUCKET).remove([objectPath]);
      if (error) console.warn('removeObjectByUrl error:', error.message || error);
    }
  } catch (err) {
    console.warn('⚠️ removeObjectByUrl failed:', err.message);
  }
}

async function uploadDriverPhoto(base64String, objectPath) {
  if (!base64String || !supabase) throw new Error('No image data or supabase not configured');
  // base64String expected to be the raw base64 (no data: prefix)
  const fileBuffer = Buffer.from(base64String, 'base64');
  const { data, error } = await supabase.storage.from(BUCKET).upload(objectPath, fileBuffer, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return urlData.publicUrl;
}

async function generateDriverID() {
  // نأخذ أكبر رقم حالي من driverid إذا كان بالشكل RTD-0000001
  const result = await dbQuery(`SELECT coalesce(max(CAST(substring(driverid, 5) AS INTEGER)), 0) AS maxnum FROM drivers;`);
  const maxnum = result && result.rows && result.rows[0] ? Number(result.rows[0].maxnum || 0) : 0;
  const next = maxnum + 1;
  return 'RTD-' + String(next).padStart(7, '0');
}

function generateRandomPassword(length = 8) {
  if (length < 1) return '';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&@#$%';
  const buf = crypto.randomBytes(length);
  let pw = letters[buf[0] % letters.length];
  for (let i = 1; i < length; i++) pw += chars[buf[i] % chars.length];
  return pw;
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
  const salt = generateSalt(16);
  const hash = hashPasswordWithSalt(password, salt);
  return `${salt}:${hash}`;
}

function generateOTP() {
  const n = Math.floor(Math.random() * 1000000);
  return String(n).padStart(6, '0');
}

// ----------------- Routes -----------------

// GET /api/driver  -> أحدث 20 سائق
router.get('/', async (req, res) => {
  try {
    const result = await dbQuery(`SELECT * FROM drivers ORDER BY createdat DESC LIMIT 20;`);
    const rows = result && result.rows ? result.rows : [];
    const safe = rows.map(r => {
      const obj = { ...r };
      if (obj.password) delete obj.password;
      if (obj.Password) delete obj.Password;
      return obj;
    });
    res.json({ success: true, count: safe.length, drivers: safe });
  } catch (err) {
    console.error('❌ Error fetching drivers:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// POST /api/driver  -> إنشاء سائق جديد
router.post('/', async (req, res) => {
  try {
    const {
      fullname, phone, vehicletype, vehiclenumber,
      password: providedPassword,
      photoBase64
    } = req.body;

    if (!fullname || !phone) return res.status(400).json({ success: false, error: 'fullname and phone are required' });

    const driverid = await generateDriverID();
    const plainPassword = providedPassword && providedPassword.trim() ? providedPassword : generateRandomPassword(8);
    const passwordToSave = makeStoredPassword(plainPassword);
    const otp = generateOTP();

    // upload photo if provided and supabase available
    let photoUrl = null;
    if (photoBase64 && supabase) {
      const objectPath = `${driverid}/${driverid}-${Date.now()}.jpg`;
      try {
        photoUrl = await uploadDriverPhoto(photoBase64, objectPath);
      } catch (uploadErr) {
        console.warn('⚠️ Photo upload failed (continuing without photo):', uploadErr.message || uploadErr);
      }
    }

    const inserted = await dbQuery(`
      INSERT INTO drivers (
        driverid, fullname, phone, vehicletype, vehiclenumber,
        password, otp, photourl, createdat, available
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,NOW(), true
      ) RETURNING *;
    `, [driverid, fullname, phone, vehicletype || null, vehiclenumber || null, passwordToSave, otp, photoUrl]);

    const driver = inserted && inserted.rows && inserted.rows[0] ? inserted.rows[0] : null;
    if (driver) {
      if (driver.password) delete driver.password;
      if (driver.Password) delete driver.Password;
    }

    res.status(201).json({
      success: true,
      message: 'Driver created successfully',
      driver,
      plainPassword // فقط للاختبار — تخلص منه في الإنتاج
    });
  } catch (err) {
    console.error('❌ Error adding driver:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// PUT /api/driver/:driverid  -> تحديث
router.put('/:driverid', async (req, res) => {
  try {
    const { driverid } = req.params;
    const body = req.body || {};
    if (!driverid) return res.status(400).json({ success: false, error: 'driverid required' });

    const existingResult = await dbQuery(`SELECT * FROM drivers WHERE driverid = $1 LIMIT 1;`, [driverid]);
    const existingRows = existingResult && existingResult.rows ? existingResult.rows : [];
    if (!existingRows.length) return res.status(404).json({ success: false, error: 'Driver not found' });
    const existing = existingRows[0];

    // whitelist الحقول المسموح تعديلها (أسماء صغيرة لتوافق schema)
    const allowed = new Set([
      'fullname','phone','vehicletype','vehiclenumber','available',
      'email','notes','model','maxload','cityid','areaid'
    ]);

    const updateObj = {};
    for (const key of Object.keys(body)) {
      if (allowed.has(key.toLowerCase())) updateObj[key.toLowerCase()] = body[key];
    }

    // password
    if (body.password && String(body.password).trim() && body.password !== 'Hidden For Protection') {
      updateObj.password = makeStoredPassword(body.password);
    }

    // photoBase64: إزالة القديمة ثم رفع الجديدة (إن وُجدت)
    if (body.photoBase64 && supabase) {
      try {
        const oldUrl = existing.photourl || existing.PhotoURL || null;
        if (oldUrl) await removeObjectByUrl(oldUrl);
        const objectPath = `${driverid}/${driverid}-${Date.now()}.jpg`;
        const url = await uploadDriverPhoto(body.photoBase64, objectPath);
        updateObj.photourl = url;
      } catch (uploadErr) {
        console.warn('⚠️ Photo upload failed on update:', uploadErr.message || uploadErr);
      }
    }

    if (Object.keys(updateObj).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    // إذا كان supabase مُفعل، نستخدمه لتحديث (اختياري) وإلا نستخدم SQL
    if (supabase) {
      const { data, error } = await supabase
        .from('drivers')
        .update(updateObj)
        .eq('driverid', driverid)
        .select();
      if (error) throw error;
      const updated = data && data[0] ? data[0] : null;
      if (updated && updated.password) delete updated.password;
      return res.json({ success: true, message: 'Driver updated successfully', driver: updated });
    } else {
      // بناء جملة UPDATE ديناميكي
      const keys = Object.keys(updateObj);
      const setParts = keys.map((k, idx) => `"${k}" = $${idx + 1}`);
      const values = keys.map(k => updateObj[k]);
      values.push(driverid);
      const q = `UPDATE drivers SET ${setParts.join(', ')}, lastupdated = NOW() WHERE driverid = $${keys.length + 1} RETURNING *;`;
      const updatedRes = await dbQuery(q, values);
      const updated = updatedRes && updatedRes.rows && updatedRes.rows[0] ? updatedRes.rows[0] : null;
      if (updated && updated.password) delete updated.password;
      return res.json({ success: true, message: 'Driver updated successfully', driver: updated });
    }
  } catch (err) {
    console.error('❌ Error updating driver:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// DELETE /api/driver/:driverid
router.delete('/:driverid', async (req, res) => {
  try {
    const { driverid } = req.params;
    if (!driverid) return res.status(400).json({ success: false, error: 'driverid required' });

    const deletedRes = await dbQuery(`DELETE FROM drivers WHERE driverid = $1 RETURNING *;`, [driverid]);
    const deleted = deletedRes && deletedRes.rows && deletedRes.rows[0] ? deletedRes.rows[0] : null;
    if (!deleted) return res.status(404).json({ success: false, error: 'Driver not found' });

    // حذف الصورة من storage إن وُجدت
    try {
      const photourl = deleted.photourl || deleted.PhotoURL || null;
      if (photourl && supabase) await removeObjectByUrl(photourl);
    } catch (remErr) {
      console.warn('⚠️ Warning: failed to remove photo from storage:', remErr.message || remErr);
    }

    if (deleted.password) delete deleted.password;
    res.json({ success: true, message: 'Driver deleted successfully', driver: deleted });
  } catch (err) {
    console.error('❌ Error deleting driver:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});
// AUTO-FIX-APPLIED: Modified by _fix_routes.js


module.exports = router;

// init shim (safe) — يسمح بتمرير مفاتيح supabase عند auto-init من server.js
if (!module.exports.init) {
  module.exports.init = function initRoute(opts = {}) {
    try {
      if (opts.supabaseKey && !supabase && process.env.SUPABASE_URL) {
        try {
          const { createClient } = require('@supabase/supabase-js');
          supabase = createClient(process.env.SUPABASE_URL, opts.supabaseKey);
        } catch (err) { /* ignore */ }
      }
    } catch (err) { /* ignore */ }
    return module.exports;
  };
}
