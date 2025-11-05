const sql = require('../db');
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

// routes/deviceTokens.js
const express = require('express');
const router = express.Router();

require('dotenv').config();

// ✅ استخدم Service Role Key للخادم

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// جلب كل Device Tokens مع فلترة اختيارية
router.get('/', async (req, res) => {
    try {
        const { UserType, UserID } = req.query;
        let query = supabase.from('devicetokens').select('*').orders('TokenID', { ascending: false });

        if (UserType) query = query.eq('UserType', UserType);
        if (UserID) query = query.eq('UserID', parseInt(UserID));

        const { data, error } = await query;
        if (error) throw error;

        sendResponse(res, true, 'Device tokens fetched successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// جلب Device Token حسب ID
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('devicetokens')
            .select('*')
            .eq('TokenID', parseInt(req.params.id))
            .single();

        if (error) return sendResponse(res, false, 'Device token not found', null, 404);

        sendResponse(res, true, 'Device token fetched', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// إنشاء Device Token جديد
router.post('/', async (req, res) => {
    try {
        const { UserID, DriverID, StoreID, Token, UserType } = req.body;
        if (!Token || !UserType) return sendResponse(res, false, 'Token and UserType are required', null, 400);

        const { data, error } = await supabase
            .from('devicetokens')
            .insert({
                UserID: UserID || null,
                DriverID: DriverID || null,
                StoreID: StoreID || null,
                Token,
                UserType,
                CreatedAt: new Date()
            })
            .select()
            .single();

        if (error) throw error;

        sendResponse(res, true, 'Device token created successfully', data, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// تحديث Device Token
router.put('/:id', async (req, res) => {
    try {
        const { UserID, DriverID, StoreID, Token, UserType } = req.body;
        const updates = {};
        if (UserID !== undefined) updates.UserID = UserID;
        if (DriverID !== undefined) updates.DriverID = DriverID;
        if (StoreID !== undefined) updates.StoreID = StoreID;
        if (Token !== undefined) updates.Token = Token;
        if (UserType !== undefined) updates.UserType = UserType;
        updates.UpdatedAt = new Date();

        if (!Object.keys(updates).length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const { data, error } = await supabase
            .from('devicetokens')
            .update(updates)
            .eq('TokenID', parseInt(req.params.id))
            .select()
            .single();

        if (error) return sendResponse(res, false, 'Device token not found', null, 404);

        sendResponse(res, true, 'Device token updated successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// حذف Device Token
router.delete('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('devicetokens')
            .delete()
            .eq('TokenID', parseInt(req.params.id))
            .select()
            .single();

        if (error) return sendResponse(res, false, 'Device token not found', null, 404);

        sendResponse(res, true, 'Device token deleted successfully', data);
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
