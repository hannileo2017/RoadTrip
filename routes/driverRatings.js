const sql = require('../db');
const express = require('express');
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

const router = express.Router();

require('dotenv').config();

// ✅ استخدام Service Role Key بدل الـ ANON

// دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// ==========================
// جلب كل التقييمات مع Pagination + فلترة بالـ DriverID
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 50, driverId = '' } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('driver_rating')
            .select('*')
            .orders('CreatedAt', { ascending: false })
            .range(from, to);

        if (driverId) query = query.ilike('DriverID', `%${driverId}%`);

        const { data, error } = await query;
        if (error) throw error;

        sendResponse(res, true, 'Driver ratings fetched successfully', {
            page,
            limit,
            count: data.length,
            ratings: data
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// جلب تقييم واحد حسب RatingID
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('driver_rating')
            .select('*')
            .eq('RatingID', parseInt(req.params.id))
            .single();

        if (error) return sendResponse(res, false, 'Rating not found', null, 404);
        sendResponse(res, true, 'Rating fetched successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// إضافة تقييم جديد
router.post('/', async (req, res) => {
    const { DriverID, CustomerID, Rating, Comment } = req.body;
    if (!DriverID || !CustomerID || Rating === undefined)
        return sendResponse(res, false, 'DriverID, CustomerID and Rating are required', null, 400);

    try {
        const { data, error } = await supabase
            .from('driver_rating')
            .insert({
                DriverID,
                CustomerID,
                Rating,
                Comment: Comment || null,
                CreatedAt: new Date()
            })
            .select()
            .single();

        if (error) throw error;
        sendResponse(res, true, 'Rating added successfully', data, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// تحديث تقييم
router.put('/:id', async (req, res) => {
    const updates = { ...req.body };
    if (!Object.keys(updates).length) return sendResponse(res, false, 'Nothing to update', null, 400);

    try {
        const { data, error } = await supabase
            .from('driver_rating')
            .update(updates)
            .eq('RatingID', parseInt(req.params.id))
            .select()
            .single();

        if (error) return sendResponse(res, false, 'Rating not found', null, 404);
        sendResponse(res, true, 'Rating updated successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// حذف تقييم
router.delete('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('driver_rating')
            .delete()
            .eq('RatingID', parseInt(req.params.id))
            .select()
            .single();

        if (error) return sendResponse(res, false, 'Rating not found', null, 404);
        sendResponse(res, true, 'Rating deleted successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;

// --- auto-added init shim (safe) ---
try {
  if (!module.exports) module.exports = router;
} catch(e) {}

if (!module.exports.init) {
  module.exports.init = function initRoute(opts = {}) {
    try {
      if (opts.supabaseKey && !supabase && SUPABASE_URL) {
        try {
          
          supabase = createClient(SUPABASE_URL, opts.supabaseKey);
        } catch(err) { /* ignore */ }
      }
    } catch(err) { /* ignore */ }
    return module.exports;
  };
}
