const sql = require('../db');
const express = require('express');
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

const router = express.Router();

require('dotenv').config();

// استخدم Service Role Key لجميع العمليات

// دالة موحدة للرد مع طابع زمني
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// ==========================
// جلب كل سجل التاريخ مع Pagination + فلترة OrderID
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 50, orderId = '' } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('orderhistory')
            .select('*')
            .orders('ChangeDate', { ascending: false })
            .range(from, to);

        if (orderId) query = query.ilike('OrderID', `%${orderId}%`);

        const { data, error } = await query;
        if (error) throw error;

        sendResponse(res, true, 'Order history fetched successfully', {
            page,
            limit,
            count: data.length,
            history: data
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// جلب سجل تاريخ حسب HistoryID
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orderhistory')
            .select('*')
            .eq('HistoryID', parseInt(req.params.id))
            .single();

        if (error) return sendResponse(res, false, 'History record not found', null, 404);
        sendResponse(res, true, 'History record fetched successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// إنشاء سجل تاريخ جديد
router.post('/', async (req, res) => {
    try {
        const { OrderID, Status, ChangedBy, DriverID, CouponID, TotalAmount, ChangeDate, Notes } = req.body;
        if (!OrderID || !Status || !ChangeDate)
            return sendResponse(res, false, 'OrderID, Status, and ChangeDate are required', null, 400);

        const { data, error } = await supabase
            .from('orderhistory')
            .insert({
                OrderID,
                Status,
                ChangedBy: ChangedBy || null,
                DriverID: DriverID || null,
                CouponID: CouponID || null,
                TotalAmount: TotalAmount || 0,
                ChangeDate,
                Notes: Notes || null,
                CreatedAt: new Date()
            })
            .select()
            .single();

        if (error) throw error;
        sendResponse(res, true, 'History record created successfully', data, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// تحديث سجل التاريخ
router.put('/:id', async (req, res) => {
    try {
        const updates = { ...req.body };
        if (!Object.keys(updates).length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const { data, error } = await supabase
            .from('orderhistory')
            .update({ ...updates, updatedat: new date() })
            .eq('HistoryID', parseInt(req.params.id))
            .select()
            .single();

        if (error) return sendResponse(res, false, 'History record not found', null, 404);
        sendResponse(res, true, 'History record updated successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// حذف سجل التاريخ
router.delete('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orderhistory')
            .delete()
            .eq('HistoryID', parseInt(req.params.id))
            .select()
            .single();

        if (error) return sendResponse(res, false, 'History record not found', null, 404);
        sendResponse(res, true, 'History record deleted successfully', data);
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
