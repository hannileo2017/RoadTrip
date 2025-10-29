const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ✅ استخدم Service Role Key
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// ==========================
// جلب كل المواقع مع Pagination + فلترة بالـ DriverID
router.get('/', async (req, res) => {
    try {
        let { page = 1, limit = 50, driverId = '' } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase.from('driver_location').select('*').orders('Timestamp', { ascending: false }).range(from, to);

        if (driverId) query = query.ilike('DriverID', `%${driverId}%`);

        const { data, error } = await query;
        if (error) throw error;

        sendResponse(res, true, 'Driver locations fetched successfully', {
            page,
            limit,
            count: data.length,
            locations: data
        });
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// جلب موقع واحد حسب LocationID
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('driver_location')
            .select('*')
            .eq('LocationID', parseInt(req.params.id))
            .single();

        if (error) return sendResponse(res, false, 'Location not found', null, 404);
        sendResponse(res, true, 'Location fetched successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// إضافة موقع جديد
router.post('/', async (req, res) => {
    try {
        const { DriverID, Latitude, Longitude, Status } = req.body;
        if (!DriverID || Latitude === undefined || Longitude === undefined) {
            return sendResponse(res, false, 'DriverID, Latitude and Longitude are required', null, 400);
        }

        const { data, error } = await supabase
            .from('driver_location')
            .insert({
                DriverID,
                Latitude,
                Longitude,
                Status: Status || 'Active',
                Timestamp: new Date(),
                UpdatedAt: new Date()
            })
            .select()
            .single();

        if (error) throw error;

        sendResponse(res, true, 'Location added successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// تحديث موقع
router.put('/:id', async (req, res) => {
    try {
        const updates = { ...req.body, UpdatedAt: new Date() };
        if (!Object.keys(req.body).length) return sendResponse(res, false, 'Nothing to update', null, 400);

        const { data, error } = await supabase
            .from('driver_location')
            .update(updates)
            .eq('LocationID', parseInt(req.params.id))
            .select()
            .single();

        if (error) return sendResponse(res, false, 'Location not found', null, 404);
        sendResponse(res, true, 'Location updated successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// ==========================
// حذف موقع
router.delete('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('driver_location')
            .delete()
            .eq('LocationID', parseInt(req.params.id))
            .select()
            .single();

        if (error) return sendResponse(res, false, 'Location not found', null, 404);
        sendResponse(res, true, 'Location deleted successfully', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
