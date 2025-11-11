const express = require('express');
const router = express.Router();
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();
require('dotenv').config();

// 🔧 دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({
    success,
    message,
    timestamp: new Date(),
    data
  });
}

// ==========================
// 📜 GET جميع الإشعارات مع Pagination + فلترة
// ==========================
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 50, userid = '', usertype = '' } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('notification')
      .select('*')
      .order('createdat', { ascending: false })
      .range(from, to);

    if (userid) query = query.eq('userid', parseInt(userid));
    if (usertype) query = query.ilike('usertype', `%${usertype}%`);

    const { data, error } = await query;
    if (error) throw error;

    sendResponse(res, true, 'Notifications retrieved successfully', {
      page,
      limit,
      count: data?.length || 0,
      notifications: data
    });
  } catch (err) {
    console.error('Error GET /notification:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📜 GET إشعار واحد حسب ID
// ==========================
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendResponse(res, false, 'Invalid notification ID', null, 400);

    const { data, error } = await supabase
      .from('notification')
      .select('*')
      .eq('notificationid', id)
      .single();

    if (error || !data) return sendResponse(res, false, 'Notification not found', null, 404);
    sendResponse(res, true, 'Notification retrieved successfully', data);
  } catch (err) {
    console.error('Error GET /notification/:id:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📨 POST إنشاء إشعار جديد
// ==========================
router.post('/', async (req, res) => {
  try {
    const { userid, title, message, usertype } = req.body;

    if (!message || !usertype)
      return sendResponse(res, false, 'Message and usertype are required', null, 400);

    const { data, error } = await supabase
      .from('notification')
      .insert({
        userid: userid || null,
        title: title || null,
        message,
        usertype,
        createdat: new Date(),
        isread: false
      })
      .select()
      .single();

    if (error) throw error;
    sendResponse(res, true, 'Notification created successfully', data, 201);
  } catch (err) {
    console.error('Error POST /notification:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// ✏️ PATCH لتحديث إشعار (مثل isread أو العنوان أو الرسالة)
// ==========================
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendResponse(res, false, 'Invalid notification ID', null, 400);

    const updates = { ...req.body };
    if (!Object.keys(updates).length)
      return sendResponse(res, false, 'Nothing to update', null, 400);

    const { data, error } = await supabase
      .from('notification')
      .update(updates)
      .eq('notificationid', id)
      .select()
      .single();

    if (error || !data) return sendResponse(res, false, 'Notification not found', null, 404);
    sendResponse(res, true, 'Notification updated successfully', data);
  } catch (err) {
    console.error('Error PATCH /notification/:id:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 🗑️ DELETE حذف إشعار
// ==========================
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendResponse(res, false, 'Invalid notification ID', null, 400);

    const { data, error } = await supabase
      .from('notification')
      .delete()
      .eq('notificationid', id)
      .select()
      .single();

    if (error || !data) return sendResponse(res, false, 'Notification not found', null, 404);
    sendResponse(res, true, 'Notification deleted successfully', data);
  } catch (err) {
    console.error('Error DELETE /notification/:id:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;

// --- auto-init shim (safe) ---
try {
  if (!module.exports) module.exports = router;
} catch (e) {}
if (!module.exports.init) {
  module.exports.init = function initRoute(opts = {}) {
    try {
      if (opts.supabaseKey && !supabase && process.env.SUPABASE_URL) {
        const { createClient } = require('@supabase/supabase-js');
        supabase = createClient(process.env.SUPABASE_URL, opts.supabaseKey);
      }
    } catch (err) {}
    return module.exports;
  };
}
