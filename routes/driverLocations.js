// routes/driverLocations.js
const express = require('express');
const router = express.Router();
const { getSupabase } = require('../supabaseClient');
const supabase = getSupabase();
const { requireSession } = require('../middleware/auth'); // إذا لديك JWT/session
const API_KEYS = process.env.DRIVER_LOCATION_API_KEYS ? process.env.DRIVER_LOCATION_API_KEYS.split(',') : [];

// دالة رد موحدة
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({
    success,
    message,
    timestamp: new Date().toISOString(),
    data
  });
}

// ---------------- Helper Functions ----------------
async function logRejectedAccess(identifier, route, reason) {
  try {
    await supabase.from('access_rejections').insert({
      identifier: identifier || null,
      route,
      reason,
      createdat: new Date().toISOString()
    });
  } catch (err) {
    console.warn('⚠️ Failed to log rejected access:', err.message || err);
  }
}

function isValidLatitude(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

function isValidLongitude(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

// ---------------- Routes ----------------

// POST /update-location
// يدعم إما Session أو API Key للتحقق
router.post('/update-location', async (req, res) => {
  try {
    const { DriverID, Latitude, Longitude, APIKey } = req.body;
    const caller = (req.user && req.user.userid) || null;

    // تحقق من API Key أو Session
    if (!(APIKey && API_KEYS.includes(APIKey)) && !req.user) {
      await logRejectedAccess(DriverID || caller, '/driverLocations/update-location', 'Unauthorized access');
      return sendResponse(res, false, 'Unauthorized', null, 401);
    }

    if (!DriverID || Latitude === undefined || Longitude === undefined) {
      await logRejectedAccess(DriverID || caller, '/driverLocations/update-location', 'Missing required fields');
      return sendResponse(res, false, 'DriverID, Latitude, Longitude are required', null, 400);
    }

    if (!isValidLatitude(Latitude) || !isValidLongitude(Longitude)) {
      await logRejectedAccess(DriverID, '/driverLocations/update-location', 'Invalid lat/lng range');
      return sendResponse(res, false, 'Latitude or Longitude out of range', null, 400);
    }

    // تأكد أن السائق نفسه فقط يمكنه التحديث إذا session موجود
    if (req.user && req.user.role === 'driver' && req.user.userid != DriverID) {
      await logRejectedAccess(DriverID, '/driverLocations/update-location', 'Driver tried to update another driver');
      return sendResponse(res, false, 'Forbidden: cannot update other driver location', null, 403);
    }

    // تحقق rate-limit: آخر تحديث لكل سائق
    const { data: existing, error: getErr } = await supabase
      .from('driver_location')
      .select('*')
      .eq('driverid', String(DriverID))
      .single();

    if (existing && existing.lastupdated) {
      const delta = Date.now() - new Date(existing.lastupdated).getTime();
      if (delta < 1000) { // 1 ثانية
        await logRejectedAccess(DriverID, '/driverLocations/update-location', `Rate-limit: ${delta}ms`);
        return sendResponse(res, false, 'Too many updates. Wait a moment.', null, 429);
      }
    }

    const payload = {
      driverid: String(DriverID),
      latitude: Number(Latitude),
      longitude: Number(Longitude),
      lastupdated: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('driver_location')
      .upsert(payload, { onConflict: ['driverid'] })
      .select()
      .single();

    if (error) throw error;

    // WebSocket emit
    if (req.app && req.app.locals && req.app.locals.io) {
      req.app.locals.io.emit('driver-location-update', payload);
    }

    sendResponse(res, true, 'Driver location updated', data, 200);
  } catch (err) {
    console.error('POST /driverLocations/update-location error:', err);
    await logRejectedAccess(req.body.DriverID, '/driverLocations/update-location', 'Unhandled error');
    sendResponse(res, false, 'Internal server error', null, 500);
  }
});

// GET /:driverid
// يمكن للـ driver نفسه أو الـ admin/dispatcher قراءته
router.get('/:driverid', requireSession, async (req, res) => {
  try {
    const driverid = req.params.driverid;
    if (!driverid) {
      await logRejectedAccess(null, '/driverLocations/:driverid', 'Missing driverid');
      return sendResponse(res, false, 'DriverID is required', null, 400);
    }

    // حماية: إذا session موجود والـ driver فقط يمكنه قراءة موقعه
    if (req.user.role === 'driver' && req.user.userid != driverid) {
      await logRejectedAccess(driverid, '/driverLocations/:driverid', 'Driver tried to read another driver');
      return sendResponse(res, false, 'Forbidden', null, 403);
    }

    const { data, error } = await supabase
      .from('driver_location')
      .select('*')
      .eq('driverid', String(driverid))
      .single();

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
        await logRejectedAccess(driverid, '/driverLocations/:driverid', 'Driver location not found');
        return sendResponse(res, false, 'Driver not found', null, 404);
      }
      throw error;
    }

    sendResponse(res, true, 'Driver location fetched', data, 200);
  } catch (err) {
    console.error('GET /driverLocations/:driverid error:', err);
    sendResponse(res, false, 'Internal server error', null, 500);
  }
});

module.exports = router;
