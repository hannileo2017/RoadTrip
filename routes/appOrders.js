// routes/appOrders.js
const express = require('express');
const router = express.Router();
const sql = require('../db');
require('dotenv').config();

// Helper للردود
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// Helper لجلب مسار بين نقطتين باستخدام GraphHopper
async function getRoute(lat1, lon1, lat2, lon2) {
  try {
    const apiKey = process.env.GRAPH_HOPPER_KEY;
    if (!apiKey) {
      console.warn('⚠️ GRAPH_HOPPER_KEY not set in .env');
      return null;
    }

    const url = `https://graphhopper.com/api/1/route?point=${lat1},${lon1}&point=${lat2},${lon2}&vehicle=car&points_encoded=false&key=${apiKey}`;

    // Node 18+ fetch مدمج
    const resFetch = await fetch(url);
    const data = await resFetch.json();

    if (data.paths && data.paths.length > 0) {
      const path = data.paths[0];
      return {
        distance_m: path.distance,
        time_s: path.time / 1000,
        points: path.points.coordinates
      };
    }
    return null;
  } catch(e){
    console.error('GraphHopper error:', e.message);
    return null;
  }
}

// ==========================
// 📍 واجهة السائق: الطلبات الموكلة إليه
router.get('/driver/:driverid', async (req, res) => {
  try {
    const { driverid } = req.params;
    const ordersRes = await sql.query(
      `SELECT * FROM orders WHERE driverid=$1 ORDER BY createdat DESC`,
      [driverid]
    );
    const orders = ordersRes.rows;

    for (const o of orders) {
      if (o.deliverylatitude && o.deliverylongitude && o.pickuplatitude && o.pickuplongitude) {
        o.route = await getRoute(o.pickuplatitude, o.pickuplongitude, o.deliverylatitude, o.deliverylongitude);
      }
    }

    sendResponse(res, true, 'Driver orders fetched', orders);
  } catch(err){
    console.error(err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 واجهة العميل: الطلبات الخاصة به
router.get('/customer/:customerid', async (req, res) => {
  try {
    const { customerid } = req.params;
    const ordersRes = await sql.query(
      `SELECT o.*, d.fullname AS driver_name, d.latitude AS driver_lat, d.longitude AS driver_lng
       FROM orders o
       LEFT JOIN drivers d ON o.driverid=d.driverid
       WHERE o.customerid=$1 ORDER BY o.createdat DESC`,
      [customerid]
    );
    const orders = ordersRes.rows;

    for (const o of orders) {
      if (o.driver_lat && o.driver_lng && o.deliverylatitude && o.deliverylongitude) {
        o.route = await getRoute(o.driver_lat, o.driver_lng, o.deliverylatitude, o.deliverylongitude);
      }
    }

    sendResponse(res, true, 'Customer orders fetched', orders);
  } catch(err){
    console.error(err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 السائق يحدث حالة الطلب
router.post('/driver/update-status/:orderid', async (req, res) => {
  try {
    const { status } = req.body;
    const { orderid } = req.params;
    if(!status) return sendResponse(res, false, 'status is required', null, 400);

    const result = await sql.query(
      `UPDATE orders SET status=$1, updatedat=NOW() WHERE orderid=$2 RETURNING *`,
      [status, orderid]
    );
    if(!result.rows.length) return sendResponse(res, false, 'Order not found', null, 404);

    sendResponse(res, true, 'Order status updated', result.rows[0]);
  } catch(err){
    console.error(err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 العميل يوافق على التكلفة
router.post('/customer/approve/:orderid', async (req, res) => {
  try {
    const { customerid } = req.body;
    const { orderid } = req.params;
    if (!customerid) return sendResponse(res, false, 'customerid required', null, 400);

    const orderRes = await sql.query('SELECT customerid, status FROM orders WHERE orderid=$1', [orderid]);
    if (!orderRes.rows.length) return sendResponse(res, false, 'Order not found', null, 404);

    const order = orderRes.rows[0];
    if (order.customerid !== parseInt(customerid)) return sendResponse(res, false, 'Not your order', null, 403);
    if (order.status !== 'cost_confirmed') return sendResponse(res, false, 'Order not ready for approval', null, 400);

    const updateRes = await sql.query(
      `UPDATE orders SET status='in_progress', updatedat=NOW() WHERE orderid=$1 RETURNING *`,
      [orderid]
    );

    sendResponse(res, true, 'Order approved', updateRes.rows[0]);
  } catch(err){
    console.error(err);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ✅ تصدير الروتر
module.exports = router;
