// routes/stores.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { supabase } = require('../supabase');
const crypto = require('crypto');
const { requireSession } = require('../middleware/auth'); // استخدم middleware موجود مسبقاً

const BUCKET = 'Stores';

// ----------------- حماية كل الـ routes بالجلسة -----------------
router.use(requireSession);

// ==============================
// 🟢 جلب جميع المتاجر
// ==============================
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * 
      FROM stores 
      ORDER BY createdat DESC 
      LIMIT 50;
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('❌ Error fetching stores:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 🟢 جلب متجر واحد بالـ storeid
// ==============================
router.get('/:storeid', async (req, res) => {
  try {
    const storeid = req.params.storeid;
    const result = await pool.query('SELECT * FROM stores WHERE storeid=$1 LIMIT 1;', [storeid]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Store not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('❌ Error fetching store by ID:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 🟢 إضافة متجر جديد
// ==============================
router.post('/', async (req, res) => {
  try {
    const {
      storename,
      categoryid,
      cityid,
      areaid,
      address,
      phone,
      email,
      description = '',
      isactive = true,
      fcmtoken = null,
      photoBase64
    } = req.body;

    if (!storename || !phone) return res.status(400).json({ success: false, error: 'storename and phone are required' });

    const otp = generateOTP();

    let logoUrl = null;
    if (photoBase64) logoUrl = await uploadPhoto(BUCKET, `store-${Date.now()}`, photoBase64);

    const q = `
      INSERT INTO stores 
        (storename, categoryid, cityid, areaid, address, phone, email, description, 
         isactive, createdat, logourl, rating, otp, otpexpires, phoneconfirmed, fcmtoken)
      VALUES 
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,0,$11,NOW() + INTERVAL '10 minutes',false,$12)
      RETURNING *;
    `;
    const values = [
      storename, categoryid, cityid, areaid, address, phone, email, description,
      isactive, logoUrl, otp, fcmtoken
    ];

    const result = await pool.query(q, values);
    res.status(201).json({ success: true, message: 'Store created successfully', data: result.rows[0] });
  } catch (err) {
    console.error('❌ Error adding store:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 🟡 تحديث بيانات المتجر
// ==============================
router.put('/:storeid', async (req, res) => {
  try {
    const storeid = req.params.storeid;
    const body = req.body || {};

    const existing = await pool.query('SELECT * FROM stores WHERE storeid=$1 LIMIT 1;', [storeid]);
    if (!existing.rows.length) return res.status(404).json({ success: false, error: 'Store not found' });

    const updates = [];
    const values = [];
    let i = 1;

    const allowed = [
      'storename', 'categoryid', 'cityid', 'areaid', 'address', 'phone', 'email',
      'description', 'isactive', 'rating', 'fcmtoken'
    ];

    for (const key of Object.keys(body)) {
      if (allowed.includes(key)) {
        updates.push(`${key}=$${i}`);
        values.push(body[key]);
        i++;
      }
    }

    if (body.photoBase64) {
      const newUrl = await uploadPhoto(BUCKET, `store-${storeid}-${Date.now()}`, body.photoBase64);
      updates.push(`logourl=$${i}`);
      values.push(newUrl);
      i++;
    }

    if (!updates.length) return res.status(400).json({ success: false, error: 'No valid fields to update' });

    const q = `UPDATE stores SET ${updates.join(', ')} WHERE storeid=$${i} RETURNING *;`;
    values.push(storeid);

    const result = await pool.query(q, values);
    res.json({ success: true, message: 'Store updated successfully', data: result.rows[0] });
  } catch (err) {
    console.error('❌ Error updating store:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 🔴 حذف متجر
// ==============================
router.delete('/:storeid', async (req, res) => {
  try {
    const storeid = req.params.storeid;
    const result = await pool.query('DELETE FROM stores WHERE storeid=$1 RETURNING *;', [storeid]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Store not found' });

    if (result.rows[0].logourl) await removeObjectByUrl(result.rows[0].logourl);

    res.json({ success: true, message: 'Store deleted successfully', data: result.rows[0] });
  } catch (err) {
    console.error('❌ Error deleting store:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 📦 المساعدات
// ==============================
function generateOTP() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

async function uploadPhoto(bucket, name, base64) {
  if (!base64) return null;
  const buf = Buffer.from(base64, 'base64');
  const objPath = `${bucket}/${name}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(objPath, buf, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objPath);
  return urlData.publicUrl;
}

async function removeObjectByUrl(publicUrl) {
  if (!publicUrl) return;
  try {
    const url = new URL(publicUrl);
    const objectPath = decodeURIComponent(url.pathname.replace(`/storage/v1/object/public/${BUCKET}/`, ''));
    await supabase.storage.from(BUCKET).remove([objectPath]);
  } catch (err) {
    console.warn('⚠️ Failed to remove image:', err.message);
  }
}

module.exports = router;
