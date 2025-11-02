const supabase = require('../supabase');
// routes/driver.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db');                // اتصال PostgreSQL (postgres lib)
const { createClient } = require('../supabase'); // module.exports = supabase
const crypto = require('crypto');

const BUCKET = 'RoadTrip'; // تأكد من اسم الـ bucket هنا

// ----------------- Helpers -----------------

async function removeObjectByUrl(publicUrl) {
  if (!publicUrl) return;
  try {
    const url = new URL(publicUrl);
    const objectPath = decodeURIComponent(url.pathname.replace(`/storage/v1/object/public/${BUCKET}/`, ''));
    if (objectPath) {
      await supabase.storage.from(BUCKET).remove([objectPath]);
    }
  } catch (err) {
    console.warn('⚠️ removeObjectByUrl failed:', err.message);
  }
}

// رفع صورة إلى Supabase Storage
async function uploadDriverPhoto(base64String, objectPath) {
  if (!base64String || typeof base64String !== 'string') throw new Error('Invalid image data');
  const fileBuffer = Buffer.from(base64String, 'base64');

  const { data, error } = await supabase.storage.from(BUCKET).upload(objectPath, fileBuffer, { upsert: true });
  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return urlData.publicUrl;
}

// توليد DriverID بنفس فكرة VB: RTD-0000001 ...
async function generateDriverID() {
  const row = await sql`SELECT COALESCE(MAX(CAST(SUBSTRING("DriverID", 5) AS INTEGER)), 0) AS maxnum FROM "Drivers";`;
  const maxnum = row && row[0] ? Number(row[0].maxnum || 0) : 0;
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
    const rows = await sql`SELECT * FROM "Drivers" ORDER BY "CreatedAt" DESC LIMIT 20;`;
    const safe = rows.map(r => {
      const obj = { ...r };
      if (obj.Password) delete obj.Password;
      if (obj.password) delete obj.password;
      return obj;
    });
    res.json(safe);
  } catch (err) {
    console.error('❌ Error fetching drivers:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/driver  -> إنشاء سائق جديد (توليد DriverID, password, otp, رفع صورة)
router.post('/', async (req, res) => {
  try {
    const {
      fullname, phone, vehicletype, vehiclenumber,
      password: providedPassword,
      photoBase64 // optional (without data:image/... prefix)
    } = req.body;

    if (!fullname || !phone) return res.status(400).json({ error: 'fullname and phone are required' });

    // 1) DriverID
    const driverid = await generateDriverID();

    // 2) password
    const plainPassword = providedPassword && providedPassword.trim() ? providedPassword : generateRandomPassword(8);
    const passwordToSave = makeStoredPassword(plainPassword);

    // 3) OTP
    const otp = generateOTP();

    // 4) photo upload
    let photoUrl = null;
    if (photoBase64) {
      const objectPath = `${driverid}/${driverid}-${Date.now()}.jpg`;
      try {
        photoUrl = await uploadDriverPhoto(photoBase64, objectPath);
      } catch (uploadErr) {
        console.warn('⚠️ Photo upload failed (continuing without photo):', uploadErr.message);
      }
    }

    // 5) Insert into DB
    const inserted = await sql`
      INSERT INTO "Drivers" (
        "DriverID","FullName","Phone","VehicleType","VehicleNumber",
        "Password","OTP","PhotoURL","CreatedAt","Available"
      ) VALUES (
        ${driverid}, ${fullname}, ${phone}, ${vehicletype || null}, ${vehiclenumber || null},
        ${passwordToSave}, ${otp}, ${photoUrl}, NOW(), true
      ) RETURNING *;
    `;

    const driver = inserted[0];
    if (driver && driver.Password) delete driver.Password;
    if (driver && driver.password) delete driver.password;

    // NOTE: plainPassword is returned for testing convenience. In production, send via SMS/email then remove.
    res.status(201).json({
      message: 'Driver created successfully',
      driver,
      plainPassword
    });
  } catch (err) {
    console.error('❌ Error adding driver:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/driver/:driverid  -> تحديث
router.put('/:driverid', async (req, res) => {
  try {
    const { driverid } = req.params;
    const body = req.body || {};
    if (!driverid) return res.status(400).json({ error: 'driverid required' });

    // get existing row (needed to delete old photo if replaced)
    const existingRows = await sql`SELECT * FROM "Drivers" WHERE "DriverID" = ${driverid} LIMIT 1;`;
    if (!existingRows.length) return res.status(404).json({ error: 'Driver not found' });
    const existing = existingRows[0];

    // whitelist للحقول المسموح تعديلها
    const allowed = new Set([
      'FullName','Phone','VehicleType','VehicleNumber','Available',
      'Email','Notes','Model','MaxLoad','CityID','AreaID'
    ]);

    const updateObj = {};
    for (const key of Object.keys(body)) {
      if (allowed.has(key)) updateObj[key] = body[key];
    }

    // password
    if (body.password && String(body.password).trim() && body.password !== 'Hidden For Protection') {
      updateObj.Password = makeStoredPassword(body.password);
    }

    // photoBase64: إزالة القديمة ثم رفع الجديدة
    if (body.photoBase64) {
      try {
        if (existing.PhotoURL || existing.photourl) {
          await removeObjectByUrl(existing.PhotoURL || existing.photourl);
        }
        const objectPath = `${driverid}/${driverid}-${Date.now()}.jpg`;
        const url = await uploadDriverPhoto(body.photoBase64, objectPath);
        updateObj.PhotoURL = url;
      } catch (uploadErr) {
        console.warn('⚠️ Photo upload failed on update:', uploadErr.message);
      }
    }

    if (Object.keys(updateObj).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('Drivers')
      .update(updateObj)
      .eq('DriverID', driverid)
      .select();

    if (error) throw error;

    const updated = (data && data[0]) ? data[0] : null;
    if (updated && updated.Password) delete updated.Password;
    if (updated && updated.password) delete updated.password;

    res.json({ message: 'Driver updated successfully', driver: updated });
  } catch (err) {
    console.error('❌ Error updating driver:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// DELETE /api/driver/:driverid
router.delete('/:driverid', async (req, res) => {
  try {
    const { driverid } = req.params;
    if (!driverid) return res.status(400).json({ error: 'driverid required' });

    const deleted = await sql`DELETE FROM "Drivers" WHERE "DriverID" = ${driverid} RETURNING *;`;
    if (!deleted.length) return res.status(404).json({ error: 'Driver not found' });

    // حذف الصورة من storage إن وُجدت
    try {
      const photourl = deleted[0].PhotoURL || deleted[0].photourl;
      if (photourl) await removeObjectByUrl(photourl);
    } catch (remErr) {
      console.warn('⚠️ Warning: failed to remove photo from storage:', remErr.message);
    }

    const { Password, password, ...driverSafe } = deleted[0];
    res.json({ message: 'Driver deleted successfully', driver: driverSafe });
  } catch (err) {
    console.error('❌ Error deleting driver:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
