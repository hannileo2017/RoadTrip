const supabase = require('../supabase');
// routes/products.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db');                // اتصال PostgreSQL
const { createClient } = require('../supabase'); // module.exports = supabase
const crypto = require('crypto');

// اسم الـ bucket المستخدم (غيّره إذا لديك bucket مختلف)
const BUCKET = 'RoadTrip';

// ----------------- Helpers -----------------

async function uploadProductImage(base64String, objectPath) {
  if (!base64String || typeof base64String !== 'string') throw new Error('Invalid image data');
  const fileBuffer = Buffer.from(base64String, 'base64');
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
    const objectPath = decodeURIComponent(url.pathname.replace(`/storage/v1/object/public/${BUCKET}/`, ''));
    if (objectPath) {
      await supabase.storage.from(BUCKET).remove([objectPath]);
    }
  } catch (err) {
    console.warn('⚠️ removeObjectByUrl failed:', err.message);
  }
}

// ----------------- Routes -----------------

// GET /api/products -> كل المنتجات مع Pagination + Search
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 20, search = '' } = req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 20;
    const offset = (page - 1) * limit;

    const rows = await sql`
      SELECT *
      FROM "Products"
      WHERE "ProductName" ILIKE ${`%${search}%`}
      ORDER BY "LastUpdated" DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
    `;

    res.json({ success: true, page, limit, count: rows.length, products: rows });
  } catch (err) {
    console.error('❌ Error fetching products:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products/:ProductID -> منتج محدد
router.get('/:ProductID', async (req, res) => {
  try {
    const rows = await sql`
      SELECT *
      FROM "Products"
      WHERE "ProductID" = ${req.params.ProductID};
    `;
    if (!rows.length) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, product: rows[0] });
  } catch (err) {
    console.error('❌ Error fetching product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/products -> إضافة منتج جديد مع رفع صورة (إذا وُجدت)
router.post('/', async (req, res) => {
  try {
    const { StoreID, ProductName, Price, Stock, Description, IsAvailable, ImageBase64 } = req.body;
    if (!StoreID || !ProductName || Price === undefined) {
      return res.status(400).json({ success: false, error: 'StoreID, ProductName, and Price are required' });
    }

    // 1) أدخل السجل أولاً (ProductID يولد أوتوماتيكيًا)
    const inserted = await sql`
      INSERT INTO "Products" 
        ("StoreID","ProductName","Price","Stock","Description","IsAvailable","ImageURL","CreatedAt","LastUpdated")
      VALUES
        (${StoreID}, ${ProductName}, ${Price}, ${Stock || 0}, ${Description || null}, ${IsAvailable !== undefined ? IsAvailable : true}, ${null}, NOW(), NOW())
      RETURNING *;
    `;
    let product = inserted[0];

    // 2) إذا وُجدت صورة: ارفعها داخل مجلد باسم ProductID ثم حدّث السجل
    if (ImageBase64) {
      try {
        const objectPath = `products/${product.ProductID}/${product.ProductID}-${Date.now()}.jpg`;
        const imageUrl = await uploadProductImage(ImageBase64, objectPath);
        const updated = await sql`
          UPDATE "Products" SET "ImageURL" = ${imageUrl}, "LastUpdated" = NOW() WHERE "ProductID" = ${product.ProductID} RETURNING *;
        `;
        product = updated[0];
      } catch (uploadErr) {
        console.warn('⚠️ Image upload failed (continuing without image):', uploadErr.message);
      }
    }

    res.status(201).json({ success: true, message: 'Product created successfully', product });
  } catch (err) {
    console.error('❌ Error adding product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/products/:ProductID -> تحديث منتج + رفع صورة جديدة (يحذف القديمة)
router.put('/:ProductID', async (req, res) => {
  try {
    const productId = req.params.ProductID;
    const body = req.body || {};
    const allowed = new Set(['ProductName','Price','Stock','Description','IsAvailable']);

    // جلب المنتج الحالي (لاحتياج حذف الصورة القديمة إن وُجدت)
    const existingRows = await sql`SELECT * FROM "Products" WHERE "ProductID" = ${productId} LIMIT 1;`;
    if (!existingRows.length) return res.status(404).json({ success: false, error: 'Product not found' });
    const existing = existingRows[0];

    const updateObj = {};
    for (const key of Object.keys(body)) {
      if (allowed.has(key)) updateObj[key] = body[key];
    }

    // إذا هناك صورة جديدة: احذف القديمة ثم ارفع الجديدة
    if (body.ImageBase64) {
      try {
        // حذف الصورة القديمة أولًا (إن وُجدت)
        if (existing.ImageURL) {
          await removeObjectByUrl(existing.ImageURL);
        }
        const objectPath = `products/${productId}/${productId}-${Date.now()}.jpg`;
        const url = await uploadProductImage(body.ImageBase64, objectPath);
        updateObj.ImageURL = url;
      } catch (uploadErr) {
        console.warn('⚠️ Image upload failed on update:', uploadErr.message);
      }
    }

    if (!Object.keys(updateObj).length) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    // نفّذ التحديث عبر supabase (سهولة التعامل مع identifiers) أو عبر SQL
    const { data, error } = await supabase
      .from('Products')
      .update(updateObj)
      .eq('ProductID', productId)
      .select();

    if (error) throw error;

    const updated = (data && data[0]) ? data[0] : null;
    res.json({ success: true, message: 'Product updated successfully', product: updated });
  } catch (err) {
    console.error('❌ Error updating product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/products/:ProductID -> حذف منتج + حذف الصورة
router.delete('/:ProductID', async (req, res) => {
  try {
    const productId = req.params.ProductID;
    const deleted = await sql`DELETE FROM "Products" WHERE "ProductID" = ${productId} RETURNING *;`;
    if (!deleted.length) return res.status(404).json({ success: false, error: 'Product not found' });

    // حذف الصورة من Storage إذا موجودة
    try {
      const imageUrl = deleted[0].ImageURL || deleted[0].imageurl;
      if (imageUrl) await removeObjectByUrl(imageUrl);
    } catch (remErr) {
      console.warn('⚠️ Warning: failed to remove image from storage:', remErr.message);
    }

    res.json({ success: true, message: 'Product deleted successfully', product: deleted[0] });
  } catch (err) {
    console.error('❌ Error deleting product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
