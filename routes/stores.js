const supabase = require('../supabase');
// routes/stores.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db'); // postgres client
const { createClient } = require('../supabase'); // service role client

// اسم البكت المستخدم (غيّره هنا إن أردت)
const BUCKET = 'RoadTrip';

// ----------------- helpers -----------------
async function uploadStoreLogo(base64String, storeId) {
  if (!base64String || typeof base64String !== 'string') throw new Error('Invalid image data');
  const fileBuffer = Buffer.from(base64String, 'base64');
  const objectPath = `${storeId}/${storeId}-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage.from(BUCKET).upload(objectPath, fileBuffer, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return urlData.publicUrl;
}

async function removeObjectByUrl(publicUrl) {
  if (!publicUrl) return;
  try {
    const url = new URL(publicUrl);
    // path like: /storage/v1/object/public/<bucket>/<objectPath>
    const prefix = `/storage/v1/object/public/${BUCKET}/`;
    const pathname = url.pathname || '';
    if (!pathname.includes(prefix)) {
      // قد يكون رابط بصيغة مختلفة -> نتجاهل أو نرمي تحذير
      console.warn('removeObjectByUrl: unexpected publicUrl format', publicUrl);
      return;
    }
    const objectPath = decodeURIComponent(pathname.replace(prefix, ''));
    if (objectPath) {
      const { error } = await supabase.storage.from(BUCKET).remove([objectPath]);
      if (error) console.warn('removeObjectByUrl remove error:', error.message || error);
    }
  } catch (err) {
    console.warn('removeObjectByUrl failed:', err.message);
  }
}

// ----------------- connection test -----------------
(async () => {
  try {
    await sql`SELECT NOW()`;
    console.log('📡 Stores route connected to DB successfully');
  } catch (err) {
    console.error('❌ Stores route DB connection error:', err.message);
  }
})();

// ----------------- GET /api/stores -----------------
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 20, search = '' } = req.query;
    page = Math.max(1, parseInt(page) || 1);
    limit = Math.max(1, Math.min(100, parseInt(limit) || 20)); // cap limit to 100
    const offset = (page - 1) * limit;

    // total count (للـ pagination)
    const countRow = await sql`
      SELECT COUNT(*)::int AS total
      FROM "Stores"
      WHERE "StoreName" ILIKE ${`%${search}%`};
    `;
    const total = (countRow && countRow[0] && countRow[0].total) ? countRow[0].total : 0;

    const stores = await sql`
      SELECT *
      FROM "Stores"
      WHERE "StoreName" ILIKE ${`%${search}%`}
      ORDER BY "CreatedAt" DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY;
    `;

    res.json({
      success: true,
      page,
      limit,
      total,
      count: stores.length,
      stores
    });
  } catch (err) {
    console.error('❌ Error fetching stores:', err);
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

    // أدخل السجل أولاً بدون LogoURL للحصول على StoreID (auto-generated)
    const inserted = await sql`
      INSERT INTO "Stores" 
        ("StoreName","CategoryID","CityID","AreaID","Address","Phone","Email","Description",
         "IsActive","CreatedAt","Rating","OTP","OTPExpires","PhoneConfirmed","FCMToken")
      VALUES
        (${StoreName}, ${CategoryID || null}, ${CityID || null}, ${AreaID || null},
         ${Address || null}, ${Phone}, ${Email || null}, ${Description || null},
         ${IsActive !== undefined ? IsActive : true}, NOW(),
         ${Rating || null}, ${OTP || null}, ${OTPExpires || null},
         ${PhoneConfirmed !== undefined ? PhoneConfirmed : false}, ${FCMToken || null})
      RETURNING *;
    `;

    let store = inserted[0];

    // رفع الشعار إن وُجد (ونحدّث السجل)
    if (LogoBase64) {
      try {
        const logoUrl = await uploadStoreLogo(LogoBase64, store.StoreID);
        const updated = await sql`
          UPDATE "Stores" SET "LogoURL" = ${logoUrl}, "LastUpdated" = NOW() WHERE "StoreID" = ${store.StoreID} RETURNING *;
        `;
        store = updated[0];
      } catch (logoErr) {
        console.warn('⚠️ Logo upload failed (continuing without logo):', logoErr.message);
      }
    }

    // لا تُرجع الحقول الحساسة (مثل OTP) إن رغبت
    if (store && store.OTP) delete store.OTP;

    res.status(201).json({ success: true, message: 'Store created successfully', store });
  } catch (err) {
    console.error('❌ Error adding store:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- PUT /api/stores/:id -----------------
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    if (!Object.keys(body).length) return res.status(400).json({ success: false, error: 'No fields to update' });

    // allowed fields (تأكد أنها تطابق أسماء الأعمدة في DB)
    const allowed = new Set([
      'StoreName','CategoryID','CityID','AreaID','Address','Phone','Email','Description',
      'IsActive','Rating','OTP','OTPExpires','PhoneConfirmed','FCMToken'
    ]);

    const updateObj = {};
    for (const key of Object.keys(body)) {
      if (allowed.has(key)) updateObj[key] = body[key];
    }

    // جلب السجل الحالي (لاحتياج حذف الشعار القديم إذا وُجد)
    const existingRows = await sql`SELECT * FROM "Stores" WHERE "StoreID" = ${id} LIMIT 1;`;
    if (!existingRows.length) return res.status(404).json({ success: false, error: 'Store not found' });
    const existing = existingRows[0];

    // معالجة LogoBase64: حذف القديم ثم رفع الجديد
    if (body.LogoBase64) {
      try {
        if (existing.LogoURL) await removeObjectByUrl(existing.LogoURL);
        const logoUrl = await uploadStoreLogo(body.LogoBase64, id);
        updateObj.LogoURL = logoUrl;
      } catch (logoErr) {
        console.warn('⚠️ Logo upload failed on update:', logoErr.message);
      }
    }

    if (!Object.keys(updateObj).length) return res.status(400).json({ success: false, error: 'No valid fields to update' });

    // استخدم Supabase client للتحديث (أسهل مع identifiers)
    const { data, error } = await supabase
      .from('Stores')
      .update(updateObj)
      .eq('StoreID', id)
      .select();

    if (error) throw error;

    const updated = (data && data[0]) ? data[0] : null;
    if (updated && updated.OTP) delete updated.OTP;

    res.json({ success: true, message: 'Store updated successfully', store: updated });
  } catch (err) {
    console.error('❌ Error updating store:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- DELETE /api/stores/:id -----------------
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await sql`DELETE FROM "Stores" WHERE "StoreID" = ${id} RETURNING *;`;
    if (!deleted.length) return res.status(404).json({ success: false, error: 'Store not found' });

    // حذف الشعار من Storage إن وُجد
    try {
      const logoUrl = deleted[0].LogoURL || deleted[0].logourl;
      if (logoUrl) await removeObjectByUrl(logoUrl);
    } catch (remErr) {
      console.warn('⚠️ Failed to remove logo from storage:', remErr.message);
    }

    res.json({ success: true, message: 'Store deleted successfully', store: deleted[0] });
  } catch (err) {
    console.error('❌ Error deleting store:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
