const sql = require('../db');
const express = require('express');
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

const router = express.Router();

require('dotenv').config();

// استخدم Service Role Key لضمان عمل جميع العمليات CRUD

// دالة موحدة للرد مع طابع زمني
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// ==========================
// جلب كل الشكاوى مع Pagination + فلترة Status
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 50, status = '' } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('orderdisputes')
            .select('*')
            .orders('CreatedAt', { ascending: false })
            .range(from, to);

        if (status) query = query.eq('Status', status);

        const { data, error } = await query;
        if (error) throw error;

        sendResponse(res, true, 'Order disputes fetched successfully', {
            page,
            limit,
            count: data.length,
            disputes: data
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// جلب شكوى حسب DisputeID
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orderdisputes')
            .select('*')
            .eq('DisputeID', parseInt(req.params.id))
            .single();

        if (error) return sendResponse(res, false, 'Dispute not found', null, 404);
        sendResponse(res, true, 'Dispute fetched successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// إنشاء شكوى جديدة
router.post('/', async (req, res) => {
    const { OrderID, CustomerID, Description, Status } = req.body;
    if (!OrderID || !CustomerID || !Description) 
        return sendResponse(res, false, 'OrderID, CustomerID, and Description are required', null, 400);

    try {
        const { data, error } = await supabase
            .from('orderdisputes')
            .insert({
                OrderID,
                CustomerID,
                Description,
                Status: Status || 'Pending',
                CreatedAt: new Date(),
                ResolvedAt: null
            })
            .select()
            .single();

        if (error) throw error;
        sendResponse(res, true, 'Dispute created successfully', data, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// تحديث شكوى
router.put('/:id', async (req, res) => {
    const updates = { ...req.body };
    if (!Object.keys(updates).length) return sendResponse(res, false, 'Nothing to update', null, 400);

    try {
        const { data, error } = await supabase
            .from('orderdisputes')
            .update({ ...updates, updatedat: new date() })
            .eq('DisputeID', parseInt(req.params.id))
            .select()
            .single();

        if (error) return sendResponse(res, false, 'Dispute not found', null, 404);
        sendResponse(res, true, 'Dispute updated successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// حذف شكوى
router.delete('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orderdisputes')
            .delete()
            .eq('DisputeID', parseInt(req.params.id))
            .select()
            .single();

        if (error) return sendResponse(res, false, 'Dispute not found', null, 404);
        sendResponse(res, true, 'Dispute deleted successfully', data);
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
