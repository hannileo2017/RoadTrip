const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || null;
const SUPABASE_URL = process.env.SUPABASE_URL || null;

try {
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const { createClient } = require('../supabase');
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
} catch(e) { /* ignore */ }

require('dotenv').config();
const express = require('express');
const router = express.Router();
const sql = require('../db');  // PostgreSQL client
const crypto = require('crypto');

// اسم الـ bucket
const BUCKET = 'RoadTrip';

// ----------------- Helpers -----------------

async function uploadProductImage(base64String, objectPath) {
  if (!base64String || typeof base64String !== 'string') throw new Error('Invalid image data');
  const fileBuffer = Buffer.from(base64string, 'base64');
  const { data, error } = await supabase.storage.from(bucket).upload(objectPath, fileBuffer, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return urlData.publicUrl;
}

async function removeObjectByUrl(publicUrl) {
  if (!publicUrl) return;
  try {
    const url = new URL(publicUrl);
    const objectPath = decodeURIComponent(url.pathname.replace(`/storage/v1/object/public/${BUCKET}/`, ''));
    if (objectPath) await supabase.storage.from(bucket).remove([objectPath]);
  } catch (err) {
    console.warn('⚠️ removeObjectByUrl failed:', err.message);
  }
}

// ----------------- Routes -----------------

// GET /api/products
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 20, search = '' } = req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 20;
    const offset = (page - 1) * limit;

    const rows = await sql.query(`
      SELECT *
      FROM "products"
      WHERE "productname" ILIKE $1
      ORDER BY "LastUpdated" DESC
      OFFSET $2 ROWS FETCH NEXT $3 ROWS ONLY;
    `, [`%${search}%`, offset, limit]);

    res.json({ success: true, page, limit, count: rows.length, products: rows });
  } catch (err) {
    console.error('❌ Error fetching products:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products/:ProductID
router.get('/:ProductID', async (req, res) => {
  try {
    const productId = req.params.ProductID;
    const rows = await sql.query(`SELECT * FROM "products" WHERE "ProductID" = $1;`, [productId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, product: rows[0] });
  } catch (err) {
    console.error('❌ Error fetching product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const { StoreID, productname, Price, Stock = 0, Description = '', IsAvailable = true, ImageBase64 } = req.body;
    if (!StoreID || !productname || Price === undefined) {
      return res.status(400).json({ success: false, error: 'StoreID, productname, and Price are required' });
    }

    const inserted = await sql.query(`
      INSERT INTO "products" 
        ("StoreID","productname","Price","Stock","Description","IsAvailable","ImageURL","CreatedAt","LastUpdated")
      VALUES ($1,$2,$3,$4,$5,$6,NULL,NOW(),NOW())
      RETURNING *;
    `, [StoreID, productname, Price, Stock, Description, IsAvailable]);

    let product = inserted[0];

    if (ImageBase64) {
      try {
        const objectPath = `products/${product.ProductID}/${product.ProductID}-${Date.now()}.jpg`;
        const imageUrl = await uploadProductImage(ImageBase64, objectPath);
        const updated = await sql.query(`UPDATE "products" SET "ImageURL" = $1, "LastUpdated" = NOW() WHERE "ProductID" = $2 RETURNING *;`, [imageUrl, product.ProductID]);
        product = updated[0];
      } catch (uploadErr) {
        console.warn('⚠️ Image upload failed:', uploadErr.message);
      }
    }

    res.status(201).json({ success: true, message: 'Product created successfully', product });
  } catch (err) {
    console.error('❌ Error adding product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/products/:ProductID
router.put('/:ProductID', async (req, res) => {
  try {
    const productId = req.params.ProductID;
    const body = req.body || {};
    const allowed = new Set(['productname','Price','Stock','Description','IsAvailable']);

    const existingRows = await sql.query(`SELECT * FROM "products" WHERE "ProductID" = $1 LIMIT 1;`, [productId]);
    if (!existingRows.length) return res.status(404).json({ success: false, error: 'Product not found' });
    const existing = existingRows[0];

    const updateObj = {};
    for (const key of Object.keys(body)) {
      if (allowed.has(key)) updateObj[key] = body[key];
    }

    if (body.ImageBase64) {
      try {
        if (existing.ImageURL) await removeObjectByUrl(existing.ImageURL);
        const objectPath = `products/${productId}/${productId}-${Date.now()}.jpg`;
        const url = await uploadProductImage(body.ImageBase64, objectPath);
        updateObj.ImageURL = url;
      } catch (uploadErr) {
        console.warn('⚠️ Image upload failed on update:', uploadErr.message);
      }
    }

    if (!Object.keys(updateObj).length) return res.status(400).json({ success: false, error: 'No valid fields to update' });

    const { data, error } = await supabase
      .from('products')
      .update(updateobj)
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

// DELETE /api/products/:productID
router.delete('/:productID', async (req, res) => {
  try {
    const productId = req.params.ProductID;
    const deleted = await sql.query(`DELETE FROM "products" WHERE "ProductID" = $1 RETURNING *;`, [productId]);
    if (!deleted.length) return res.status(404).json({ success: false, error: 'Product not found' });

    try {
      if (deleted[0].ImageURL) await removeObjectByUrl(deleted[0].ImageURL);
    } catch (remErr) {
      console.warn('⚠️ Failed to remove image from storage:', remErr.message);
    }

    res.json({ success: true, message: 'Product deleted successfully', product: deleted[0] });
  } catch (err) {
    console.error('❌ Error deleting product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
