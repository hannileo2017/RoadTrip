const express = require('express');
const router = express.Router();
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, data });
}

// دالة مساعدة لتسجيل التغييرات
async function logDeviceTokenAction(devicetokenid, action, changes = {}) {
    try {
        await supabase.from('devicetokens_log').insert({
            devicetokenid,
            action,
            timestamp: new Date().toISOString(),
            changes: JSON.stringify(changes)
        });
    } catch (err) {
        console.warn('⚠️ Failed to log device token action:', err.message);
    }
}

// GET كل Device Tokens مع فلترة اختيارية
router.get('/', async (req, res) => {
    try {
        const { userid, platform } = req.query;
        let query = supabase.from('devicetokens').select('*').order('devicetokenid', { ascending: false });

        if (userid) query = query.eq('userid', parseInt(userid));
        if (platform) query = query.eq('platform', platform);

        const { data, error } = await query;
        if (error) throw error;

        sendResponse(res, true, 'Device tokens fetched successfully', data);
    } catch (err) {
        console.error('Error GET /deviceTokens:', err);
        sendResponse(res, false, err.message || 'Failed to fetch device tokens', null, 500);
    }
});

// GET Device Token حسب devicetokenid
router.get('/:id', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        if (isNaN(tokenId)) return sendResponse(res, false, 'Invalid devicetokenid', null, 400);

        const { data, error } = await supabase
            .from('devicetokens')
            .select('*')
            .eq('devicetokenid', tokenId)
            .single();

        if (error || !data) return sendResponse(res, false, 'Device token not found', null, 404);

        sendResponse(res, true, 'Device token fetched successfully', data);
    } catch (err) {
        console.error('Error GET /deviceTokens/:id:', err);
        sendResponse(res, false, err.message || 'Failed to fetch device token', null, 500);
    }
});

// POST إنشاء Device Token جديد
router.post('/', async (req, res) => {
    try {
        const { userid, token, platform } = req.body;
        if (!token || !platform) return sendResponse(res, false, 'Token and Platform are required', null, 400);

        const { data, error } = await supabase
            .from('devicetokens')
            .insert({
                userid: userid || null,
                token,
                platform,
                createdat: new Date().toISOString()
            })
            .select()
            .single();

        if (error || !data) throw error || new Error('Insertion failed');

        await logDeviceTokenAction(data.devicetokenid, 'CREATE', { userid, token, platform });

        sendResponse(res, true, 'Device token created successfully', data, 201);
    } catch (err) {
        console.error('Error POST /deviceTokens:', err);
        sendResponse(res, false, err.message || 'Failed to create device token', null, 500);
    }
});

// PUT تحديث Device Token
router.put('/:id', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        if (isNaN(tokenId)) return sendResponse(res, false, 'Invalid devicetokenid', null, 400);

        const { userid, token, platform } = req.body;
        const updates = {};
        if (userid !== undefined) updates.userid = userid;
        if (token !== undefined) updates.token = token;
        if (platform !== undefined) updates.platform = platform;

        if (!Object.keys(updates).length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const { data, error } = await supabase
            .from('devicetokens')
            .update(updates)
            .eq('devicetokenid', tokenId)
            .select()
            .single();

        if (error || !data) return sendResponse(res, false, 'Device token not found', null, 404);

        await logDeviceTokenAction(tokenId, 'UPDATE', updates);

        sendResponse(res, true, 'Device token updated successfully', data);
    } catch (err) {
        console.error('Error PUT /deviceTokens/:id:', err);
        sendResponse(res, false, err.message || 'Failed to update device token', null, 500);
    }
});

// DELETE حذف Device Token
router.delete('/:id', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        if (isNaN(tokenId)) return sendResponse(res, false, 'Invalid devicetokenid', null, 400);

        const { data, error } = await supabase
            .from('devicetokens')
            .delete()
            .eq('devicetokenid', tokenId)
            .select()
            .single();

        if (error || !data) return sendResponse(res, false, 'Device token not found', null, 404);

        await logDeviceTokenAction(tokenId, 'DELETE', data);

        sendResponse(res, true, 'Device token deleted successfully', data);
    } catch (err) {
        console.error('Error DELETE /deviceTokens/:id:', err);
        sendResponse(res, false, err.message || 'Failed to delete device token', null, 500);
    }
});

module.exports = router;
