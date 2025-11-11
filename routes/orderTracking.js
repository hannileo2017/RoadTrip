const express = require('express');
const router = express.Router();
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

// دالة رد موحدة
function sendResponse(res, success, message, data = null, status = 200) {
    return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// تسجيل نقطة الطلب
router.post('/track-order', async (req, res) => {
    try {
        const { OrderID, DriverID, Latitude, Longitude, Type, ClearPrevious = false } = req.body;
        if (!OrderID || !DriverID || Latitude === undefined || Longitude === undefined || !Type)
            return sendResponse(res, false, 'OrderID, DriverID, Latitude, Longitude, Type required', null, 400);

        if (ClearPrevious)
            await supabase.from('order_tracking').delete().eq('orderid', OrderID);

        const { data, error } = await supabase.from('order_tracking')
            .insert({ orderid: OrderID, driverid: DriverID, latitude: Latitude, longitude: Longitude, type: Type, timestamp: new Date() })
            .select()
            .single();

        if (error) throw error;

        if (req.app.locals.io)
            req.app.locals.io.emit('order-tracking-update', { orderid: OrderID, driverid: DriverID, latitude: Latitude, longitude: Longitude, type: Type });

        sendResponse(res, true, 'Order tracking point added', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

// جلب مسار الطلب
router.get('/:orderid', async (req, res) => {
    try {
        const { data, error } = await supabase.from('order_tracking')
            .select('*')
            .eq('orderid', req.params.orderid)
            .order('timestamp', { ascending: true });

        if (error) throw error;
        sendResponse(res, true, 'Order path fetched', data);
    } catch (err) {
        sendResponse(res, false, err.message, null, 500);
    }
});

module.exports = router;
