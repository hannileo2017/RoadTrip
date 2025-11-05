const sql = require('../db');
const express = require('express');
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

const router = express.Router();

require('dotenv').config();

// استخدم Service Role Key لضمان عمل جميع العمليات

// دالة موحدة للرد مع طابع زمني
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// ==========================
// جلب كل الإشعارات مع Pagination + فلترة UserType و UserID
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 50, userType = '', userId = '' } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('notifications')
            .select('*')
            .orders('CreatedAt', { ascending: false })
            .range(from, to);

        if (userType) query = query.ilike('UserType', `%${userType}%`);
        if (userId) query = query.eq('UserID', parseInt(userId));

        const { data, error } = await query;
        if (error) throw error;

        sendResponse(res, true, 'Notifications fetched successfully', {
            page,
            limit,
            count: data.length,
            notifications: data
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// جلب إشعار حسب NotificationID
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('NotificationID', parseInt(req.params.id))
            .single();

        if (error) return sendResponse(res, false, 'Notification not found', null, 404);
        sendResponse(res, true, 'Notification fetched successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// إنشاء إشعار جديد
router.post('/', async (req, res) => {
    const { UserType, UserID, Message, Title, NotificationType } = req.body;
    if (!UserType || !Message) return sendResponse(res, false, 'UserType and Message are required', null, 400);

    try {
        const { data, error } = await supabase
            .from('notifications')
            .insert({
                UserType,
                UserID: UserID || null,
                Message,
                IsRead: false,
                Title: Title || null,
                NotificationType: NotificationType || null,
                CreatedAt: new Date()
            })
            .select()
            .single();

        if (error) throw error;
        sendResponse(res, true, 'Notification created successfully', data, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// تحديث إشعار
router.put('/:id', async (req, res) => {
    const updates = { ...req.body };
    if (!Object.keys(updates).length) return sendResponse(res, false, 'Nothing to update', null, 400);

    try {
        const { data, error } = await supabase
            .from('notifications')
            .update(updates)
            .eq('NotificationID', parseInt(req.params.id))
            .select()
            .single();

        if (error) return sendResponse(res, false, 'Notification not found', null, 404);
        sendResponse(res, true, 'Notification updated successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// حذف إشعار
router.delete('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .delete()
            .eq('NotificationID', parseInt(req.params.id))
            .select()
            .single();

        if (error) return sendResponse(res, false, 'Notification not found', null, 404);
        sendResponse(res, true, 'Notification deleted successfully', data);
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
