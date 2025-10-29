// routes/deliveryZones.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ✅ استخدم Service Role Key للخادم
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// دالة مساعدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    res.status(status).json({ success, message, data });
}

// ==========================
// جلب كل مناطق التوصيل مع بحث + Pagination
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 50, search = '' } = req.query;
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 50;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('deliveryzones')
            .select('ZoneID, ZoneName, CityID, Cities!inner(CityName)')
            .range(from, to)
            .orders('ZoneName', { ascending: true });

        if (search) {
            query = query.ilike('ZoneName', `%${search}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        sendResponse(res, true, 'Delivery zones fetched successfully', {
            page,
            limit,
            count: data.length,
            zones: data
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// جلب منطقة توصيل حسب ID
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('deliveryzones')
            .select('ZoneID, ZoneName, CityID, Cities!inner(CityName)')
            .eq('ZoneID', req.params.id)
            .single();

        if (error) return sendResponse(res, false, 'Delivery zone not found', null, 404);

        sendResponse(res, true, 'Delivery zone fetched', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// إضافة منطقة توصيل جديدة
router.post('/', async (req, res) => {
    try {
        const { ZoneName, CityID } = req.body;
        if (!ZoneName || !CityID) return sendResponse(res, false, 'ZoneName and CityID are required', null, 400);

        const { data, error } = await supabase
            .from('deliveryzones')
            .insert({ ZoneName, CityID, CreatedAt: new Date() })
            .select()
            .single();

        if (error) throw error;

        sendResponse(res, true, 'Delivery zone added successfully', data, 201);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// تحديث منطقة توصيل
router.put('/:id', async (req, res) => {
    try {
        const { ZoneName, CityID } = req.body;
        if (!ZoneName && !CityID) return sendResponse(res, false, 'Nothing to update', null, 400);

        const updates = { UpdatedAt: new Date() };
        if (ZoneName) updates.ZoneName = ZoneName;
        if (CityID) updates.CityID = CityID;

        const { data, error } = await supabase
            .from('deliveryzones')
            .update(updates)
            .eq('ZoneID', req.params.id)
            .select()
            .single();

        if (error) return sendResponse(res, false, 'Delivery zone not found', null, 404);

        sendResponse(res, true, 'Delivery zone updated successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// حذف منطقة توصيل
router.delete('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('deliveryzones')
            .delete()
            .eq('ZoneID', req.params.id)
            .select()
            .single();

        if (error) return sendResponse(res, false, 'Delivery zone not found', null, 404);

        sendResponse(res, true, 'Delivery zone deleted successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
