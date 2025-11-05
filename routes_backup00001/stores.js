// routes/stores.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // PostgreSQL client
const { createClient } = require('@supabase/supabase-js'); // Supabase client

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

const BUCKET = 'RoadTrip';

// ----------------- Helpers -----------------
async function uploadStoreLogo(base64String, storeId) {
  if (!base64String) throw new Error('Invalid image data');
  const buffer = Buffer.from(base64string, 'base64');
  const objectPath = `${storeId}/${storeId}-${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, { upsert: true });
  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return urlData.publicUrl;
}

async function removeObjectByUrl(publicUrl) {
  if (!publicUrl) return;
  try {
    const url = new URL(publicUrl);
    const prefix = `/storage/v1/object/public/${BUCKET}/`;
    const pathname = url.pathname || '';
    if (!pathname.includes(prefix)) return;
    const objectPath = decodeURIComponent(pathname.replace(prefix, ''));
    const { error } = await supabase.storage.from(bucket).remove([objectPath]);
    if (error) console.warn('removeObjectByUrl error:', error.message);
  } catch (err) {
    console.warn('removeObjectByUrl failed:', err.message);
  }
}

// ----------------- Connection test -----------------
(async () => {
  try {
    await sql.query(`SELECT now()`);
    console.log('📡 Stores route connected to DB successfully');
  } catch (err) {
    console.error('❌ Stores route DB connection error:', err.message);
  }
})();

// ----------------- GET /api/stores -----------------
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 20, search = '' } = req.query;
    page = Math.max(1, parseInt(page));
    limit = Math.max(1, Math.min(100, parseInt(limit)));
    const offset = (page - 1) * limit;

    const countRow = await sql.query(
      `SELECT count(*)::int AS total FROM "Stores" WHERE "StoreName" ILIKE $1`,
      [`%${search}%`]
    );
    const total = countRow[0] ? countRow[0].total : 0;

    const stores = await sql.query(
      `SELECT * FROM "Stores"
       WHERE "StoreName" ILIKE $1
       ORDER BY "CreatedAt" DESC
       OFFSET $2 ROWS
       FETCH NEXT $3 ROWS ONLY`,
      [`%${search}%`, offset, limit]
    );

    res.json({ success: true, page, limit, total, count: stores.length, stores });
  } catch (err) {
    console.error('❌ GET /api/stores error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- POST /api/stores -----------------
router.post('/', async (req, res) => {
  try {
    const {
      StoreName, CategoryID, CityID, AreaID, Address, Phone,
      Email, Description, IsActive, LogoBase64, Rating, OTP, OTPExpires,
      PhoneConfirmed, FCMToken
    } = req.body;

    if (!StoreName || !Phone) return res.status(400).json({ success: false, error: 'StoreName and Phone are required' });

    const inserted = await sql.query(
      `INSERT INTO "Stores"
       ("StoreName","CategoryID","CityID","AreaID","Address","Phone","Email","Description",
        "IsActive","CreatedAt","Rating","OTP","OTPExpires","PhoneConfirmed","FCMToken")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,$11,$12,$13,$14)
       RETURNING *`,
      [StoreName, CategoryID, CityID, AreaID, Address, Phone, Email, Description, IsActive, Rating, OTP, OTPExpires, PhoneConfirmed, FCMToken]
    );

    let store = inserted[0];

    if (LogoBase64 && supabase) {
      try {
        const logoUrl = await uploadStoreLogo(LogoBase64, store.StoreID);
        const updated = await sql.query(
          `UPDATE "Stores" SET "LogoURL"=$1, "LastUpdated"=NOW() WHERE "StoreID"=$2 RETURNING *`,
          [logoUrl, store.StoreID]
        );
        store = updated[0];
      } catch (err) {
        console.warn('⚠️ Logo upload failed:', err.message);
      }
    }

    if (store.OTP) delete store.OTP;
    res.status(201).json({ success: true, message: 'Store created successfully', store });
  } catch (err) {
    console.error('❌ POST /api/stores error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- PUT /api/stores/:id -----------------
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    if (!Object.keys(body).length) return res.status(400).json({ success: false, error: 'No fields to update' });

    const allowed = new Set([
      'StoreName','CategoryID','CityID','AreaID','Address','Phone','Email','Description',
      'IsActive','Rating','OTP','OTPExpires','PhoneConfirmed','FCMToken'
    ]);

    const updateObj = {};
    for (const key of Object.keys(body)) if (allowed.has(key)) updateObj[key] = body[key];

    const existingRows = await sql.query(`SELECT * FROM "Stores" WHERE "StoreID"=$1 LIMIT 1`, [id]);
    if (!existingRows.length) return res.status(404).json({ success: false, error: 'Store not found' });
    const existing = existingRows[0];

    if (body.LogoBase64 && supabase) {
      if (existing.LogoURL) await removeObjectByUrl(existing.LogoURL);
      const logoUrl = await uploadStoreLogo(body.LogoBase64, id);
      updateObj.LogoURL = logoUrl;
    }

    const keys = Object.keys(updateObj);
    if (!keys.length) return res.status(400).json({ success: false, error: 'No valid fields to update' });

    const setString = keys.map((k, idx) => `"${k}"=$${idx+1}`).join(', ');
    const values = keys.map(k => updateObj[k]);
    values.push(id);

    const updatedRows = await sql.query(
      `UPDATE "Stores" SET ${setstring}, "LastUpdated"=NOW() WHERE "StoreID"=$${keys.length+1} RETURNING *`,
      values
    );

    let updated = updatedRows[0];
    if (updated && updated.OTP) delete updated.OTP;
    res.json({ success: true, message: 'Store updated successfully', store: updated });
  } catch (err) {
    console.error('❌ PUT /api/stores/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- DELETE /api/stores/:id -----------------
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRows = await sql.query(`DELETE FROM "Stores" WHERE "StoreID"=$1 RETURNING *`, [id]);
    if (!deletedRows.length) return res.status(404).json({ success: false, error: 'Store not found' });

    const logoUrl = deletedRows[0].LogoURL || deletedRows[0].logourl;
    if (logoUrl && supabase) await removeObjectByUrl(logoUrl);

    res.json({ success: true, message: 'Store deleted successfully', store: deletedRows[0] });
  } catch (err) {
    console.error('❌ DELETE /api/stores/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
