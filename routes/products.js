// routes/products.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env. Products routes will fail without them.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BUCKET = 'Products'; // تأكد أن ال-bucket موجود في Supabase Storage

// ---------------- Helpers ----------------
async function uploadProductImage(base64String, objectPath) {
  if (!base64String) return null;
  try {
    const fileBuffer = Buffer.from(base64String, 'base64');
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, fileBuffer, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.warn('⚠️ uploadProductImage failed:', err.message || err);
    throw new Error('Image upload failed: ' + (err.message || String(err)));
  }
}

async function removeObjectByUrl(publicUrl) {
  if (!publicUrl) return;
  try {
    const url = new URL(publicUrl);
    // pathname example: /storage/v1/object/public/Products/path/to/file.jpg
    const prefix = `/storage/v1/object/public/${BUCKET}/`;
    const pathname = url.pathname || '';
    if (!pathname.includes(prefix)) return;
    const objectPath = decodeURIComponent(pathname.replace(prefix, ''));
    if (objectPath) {
      const { error } = await supabase.storage.from(BUCKET).remove([objectPath]);
      if (error) console.warn('⚠️ removeObjectByUrl supabase remove error:', error.message || error);
    }
  } catch (err) {
    console.warn('⚠️ removeObjectByUrl failed:', err.message || err);
  }
}

// helper: try selecting with alias; if fails fallback to simple select and manual category join
async function fetchProducts({ productId, from = 0, to = 19, search, filterCategoryId }) {
  // Attempt 1: use supabase select join alias: store_category:categoryid(categoryname)
  try {
    if (productId !== undefined) {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categoryid(categoryname)')
        .eq('productid', productId)
        .single();
      if (error) throw error;
      return { data, usedJoin: true };
    } else {
      let q = supabase.from('products').select('*, category:categoryid(categoryname)').order('updatedat', { ascending: false }).range(from, to);
      if (search) q = q.ilike('productname', `%${search}%`);
      if (filterCategoryId) q = q.eq('categoryid', filterCategoryId);
      const { data, error } = await q;
      if (error) throw error;
      return { data, usedJoin: true };
    }
  } catch (err) {
    // Fallback: plain select + manual category fetch
    console.warn('⚠️ fetchProducts: join select failed, falling back to manual category mapping. Error:', err.message || err);
    if (productId !== undefined) {
      const { data, error } = await supabase.from('products').select('*').eq('productid', productId).single();
      if (error) throw error;
      // fetch category name if any
      const category = data?.categoryid ? (await supabase.from('store_category').select('categoryid,categoryname').eq('categoryid', data.categoryid).single()).data : null;
      if (category) data.category = { categoryid: category.categoryid, categoryname: category.categoryname };
      return { data, usedJoin: false };
    } else {
      let q = supabase.from('products').select('*').order('updatedat', { ascending: false }).range(from, to);
      if (search) q = q.ilike('productname', `%${search}%`);
      if (filterCategoryId) q = q.eq('categoryid', filterCategoryId);
      const { data, error } = await q;
      if (error) throw error;
      // load categories for mapping
      const categoryIds = Array.from(new Set((data || []).map(p => p.categoryid).filter(Boolean)));
      let categories = [];
      if (categoryIds.length) {
        const { data: cats } = await supabase.from('store_category').select('categoryid,categoryname').in('categoryid', categoryIds);
        categories = cats || [];
      }
      const catMap = Object.fromEntries((categories || []).map(c => [c.categoryid, c.categoryname]));
      const mapped = (data || []).map(p => ({ ...p, category: p.categoryid ? { categoryid: p.categoryid, categoryname: catMap[p.categoryid] || null } : null }));
      return { data: mapped, usedJoin: false };
    }
  }
}

// ---------------- Routes ----------------

// GET list with pagination, search, category filter
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 20, search = '', categoryid } = req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, usedJoin } = await fetchProducts({ from, to, search, filterCategoryId: categoryid });
    res.json({
      success: true,
      page,
      limit,
      usedCategoryJoin: usedJoin,
      count: Array.isArray(data) ? data.length : (data ? 1 : 0),
      products: data || []
    });
  } catch (err) {
    console.error('❌ GET /api/products error:', err.message || err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// GET item
router.get('/:productid', async (req, res) => {
  try {
    const productid = parseInt(req.params.productid);
    if (Number.isNaN(productid)) return res.status(400).json({ success: false, error: 'Invalid productid' });

    const { data } = await fetchProducts({ productId: productid });
    if (!data) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, product: data });
  } catch (err) {
    console.error('❌ GET /api/products/:id error:', err.message || err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// POST create product
router.post('/', async (req, res) => {
  try {
    const {
      storeid,
      productname,
      price,
      stock = 0,
      description = '',
      isavailable = true,
      categoryid = null,
      imagebase64
    } = req.body;

    if (!storeid || !productname || price === undefined) {
      return res.status(400).json({ success: false, error: 'storeid, productname and price are required' });
    }

    // handle image (optional)
    let imageurl = null;
    if (imagebase64) {
      const objectPath = `products/${storeid}/${Date.now()}-${crypto.randomUUID()}.jpg`;
      imageurl = await uploadProductImage(imagebase64, objectPath);
    }

    const insertBody = {
      storeid,
      productname,
      description,
      price,
      stock,
      imageurl,
      isavailable,
      categoryid: categoryid || null,
      createdat: new Date(),
      updatedat: new Date()
    };

    const { data, error } = await supabase.from('products').insert([insertBody]).select();
    if (error) {
      console.error('❌ supabase insert error:', error);
      // if image uploaded, consider removing it on failure
      if (imageurl) await removeObjectByUrl(imageurl);
      throw error;
    }

    res.status(201).json({ success: true, message: 'Product created successfully', product: data[0] });
  } catch (err) {
    console.error('❌ POST /api/products error:', err.message || err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// PUT update product
router.put('/:productid', async (req, res) => {
  try {
    const productid = parseInt(req.params.productid);
    if (Number.isNaN(productid)) return res.status(400).json({ success: false, error: 'Invalid productid' });

    const { imagebase64, ...fields } = req.body;

    // fetch existing
    const { data: existing, error: exErr } = await supabase.from('products').select('*').eq('productid', productid).single();
    if (exErr || !existing) return res.status(404).json({ success: false, error: 'Product not found' });

    const updateObj = { ...fields, updatedat: new Date() };

    if (imagebase64) {
      // remove old image if exists
      if (existing.imageurl) await removeObjectByUrl(existing.imageurl);
      const objectPath = `products/${existing.storeid}/${productid}-${Date.now()}.jpg`;
      const newUrl = await uploadProductImage(imagebase64, objectPath);
      updateObj.imageurl = newUrl;
    }

    const { data, error } = await supabase.from('products').update(updateObj).eq('productid', productid).select();
    if (error) throw error;

    res.json({ success: true, message: 'Product updated successfully', product: data[0] });
  } catch (err) {
    console.error('❌ PUT /api/products/:id error:', err.message || err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// DELETE product
router.delete('/:productid', async (req, res) => {
  try {
    const productid = parseInt(req.params.productid);
    if (Number.isNaN(productid)) return res.status(400).json({ success: false, error: 'Invalid productid' });

    const { data: existing, error: exErr } = await supabase.from('products').select('*').eq('productid', productid).single();
    if (exErr || !existing) return res.status(404).json({ success: false, error: 'Product not found' });

    if (existing.imageurl) await removeObjectByUrl(existing.imageurl);

    const { data, error } = await supabase.from('products').delete().eq('productid', productid).select();
    if (error) throw error;

    res.json({ success: true, message: 'Product deleted successfully', product: data[0] });
  } catch (err) {
    console.error('❌ DELETE /api/products/:id error:', err.message || err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

module.exports = router;
