// routes/orders.js
const express = require('express');
const router = express.Router();
const sql = require('../db');
const fetch = require('node-fetch');
require('dotenv').config();

// ==========================
// دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({ success, message, timestamp: new Date(), data });
}

// ==========================
// دالة لحساب المسافة التقريبية بين نقطتين (Haversine)
function getDistance(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // km
}

// ==========================
// 📍 جلب كل الطلبات مع تفاصيل السائق، التكلفة، المسار، الوقت المتوقع
router.get('/', async (req, res) => {
  try {
    const { status, driverid, customerid, limit = 50, page = 1 } = req.query;
    let query = `SELECT * FROM orders WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); query += ` AND status=$${params.length}`; }
    if (driverid) { params.push(driverid); query += ` AND driverid=$${params.length}`; }
    if (customerid) { params.push(customerid); query += ` AND customerid=$${params.length}`; }

    const offset = (page - 1) * limit;
    query += ` ORDER BY createdat DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const ordersRes = await sql.query(query, params);
    const orders = ordersRes.rows;

    // جلب بيانات السائقين
    const driverIds = [...new Set(orders.map(o => o.driverid).filter(Boolean))];
    let driversMap = {};
    if (driverIds.length) {
      const drvRes = await sql.query(`SELECT driverid, fullname, latitude, longitude, available FROM drivers WHERE driverid=ANY($1)`, [driverIds]);
      driversMap = Object.fromEntries(drvRes.rows.map(d => [d.driverid, d]));
    }

    // حساب المسار لكل طلب إن وجد
    for (const order of orders) {
      if (order.driverid && driversMap[order.driverid] && order.deliverylatitude && order.deliverylongitude) {
        try {
          const drv = driversMap[order.driverid];
          const apiKey = process.env.GRAPH_HOPPER_KEY;
          const url = `https://graphhopper.com/api/1/route?point=${drv.latitude},${drv.longitude}&point=${order.deliverylatitude},${order.deliverylongitude}&vehicle=car&points_encoded=false&key=${apiKey}`;
          const ghRes = await fetch(url);
          const ghData = await ghRes.json();
          if (ghData.paths && ghData.paths.length > 0) {
            const path = ghData.paths[0];
            const timeSec = path.time / 1000;
            const hours = Math.floor(timeSec / 3600);
            const minutes = Math.floor((timeSec % 3600) / 60);
            order.route = {
              distance_m: path.distance,
              time_s: timeSec,
              estimatedTime: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
              points: path.points.coordinates
            };
          }
        } catch(e){ console.error('GraphHopper error:', e.message); }
      }
      order.driver = order.driverid ? driversMap[order.driverid] || null : null;
    }

    sendResponse(res, true, 'Orders fetched successfully', { page, limit, orders });
  } catch (err) {
    console.error('GET /orders error:', err.message);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 تعيين أقرب سائق للطلبات الجديدة
router.get('/assign/nearest', async (req, res) => {
  try {
    const { cityid, areaid } = req.query;
    let orderQuery = `SELECT * FROM orders WHERE status='new'`;
    const orderParams = [];
    if (cityid) { orderQuery += ` AND cityid=$1`; orderParams.push(cityid); }
    if (areaid) { orderQuery += cityid ? ` AND areaid=$2` : ` AND areaid=$1`; if (!cityid) orderParams.push(areaid); }

    const orders = (await sql.query(orderQuery, orderParams)).rows;
    if (!orders.length) return sendResponse(res, true, 'No new orders to assign', []);

    const drivers = (await sql.query(`SELECT driverid, fullname, latitude, longitude, available FROM drivers WHERE available=true`)).rows;
    if (!drivers.length) return sendResponse(res, false, 'No available drivers', []);

    const assignments = [];
    for (const order of orders) {
      let closestDriver = null;
      let minDist = Infinity;
      for (const drv of drivers) {
        if (!drv.latitude || !drv.longitude) continue;
        const dist = getDistance(drv.latitude, drv.longitude, order.deliverylatitude, order.deliverylongitude);
        if (dist < minDist) { minDist = dist; closestDriver = drv; }
      }
      if (!closestDriver) continue;

      await sql.query(`UPDATE orders SET driverid=$1, status='assigned', updatedat=NOW() WHERE orderid=$2`, [closestDriver.driverid, order.orderid]);

      let routeData = null;
      let estimatedTimeStr = null;
      try {
        const apiKey = process.env.GRAPH_HOPPER_KEY;
        const url = `https://graphhopper.com/api/1/route?point=${closestDriver.latitude},${closestDriver.longitude}&point=${order.deliverylatitude},${order.deliverylongitude}&vehicle=car&points_encoded=false&key=${apiKey}`;
        const ghRes = await fetch(url);
        const ghData = await ghRes.json();
        if (ghData.paths && ghData.paths.length > 0) {
          const route = ghData.paths[0];
          const timeSec = route.time / 1000;
          const hours = Math.floor(timeSec / 3600);
          const minutes = Math.floor((timeSec % 3600) / 60);
          estimatedTimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          routeData = {
            distance_m: route.distance,
            time_s: timeSec,
            estimatedTime: estimatedTimeStr,
            points: route.points.coordinates
          };
        }
      } catch(e){ console.error('GraphHopper error:', e.message); }

      assignments.push({
        orderId: order.orderid,
        driver: closestDriver,
        estimatedDistance_km: minDist,
        route: routeData
      });
    }

    sendResponse(res, true, 'Orders assigned successfully', assignments);
  } catch (err) {
    console.error('GET /orders/assign/nearest error:', err.message);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 السائق يحدد تكلفة التوصيل
router.post('/driver-set-fee/:orderid', async (req, res) => {
  try {
    const { driverid, deliveryfee } = req.body;
    const { orderid } = req.params;
    if (!driverid || deliveryfee === undefined) return sendResponse(res, false, 'driverid and deliveryfee are required', null, 400);

    const orderRes = await sql.query('SELECT driverid, status FROM orders WHERE orderid=$1', [orderid]);
    if (!orderRes.rows.length) return sendResponse(res, false, 'Order not found', null, 404);
    const order = orderRes.rows[0];
    if (order.driverid !== driverid) return sendResponse(res, false, 'You are not assigned to this order', null, 403);
    if (order.status !== 'assigned') return sendResponse(res, false, 'Order is not ready for fee update', null, 400);

    const updateRes = await sql.query(
      `UPDATE orders SET deliveryfee=$1, status='cost_confirmed', updatedat=NOW() WHERE orderid=$2 RETURNING *`,
      [deliveryfee, orderid]
    );

    sendResponse(res, true, 'Delivery fee updated successfully', updateRes.rows[0]);
  } catch (err) {
    console.error('POST /orders/driver-set-fee error:', err.message);
    sendResponse(res, false, err.message, null, 500);
  }
});

// ==========================
// 📍 العميل يوافق على التكلفة
router.post('/customer-approve/:orderid', async (req, res) => {
  try {
    const { customerid } = req.body;
    const { orderid } = req.params;
    if (!customerid) return sendResponse(res, false, 'customerid is required', null, 400);

    const orderRes = await sql.query('SELECT customerid, status FROM orders WHERE orderid=$1', [orderid]);
    if (!orderRes.rows.length) return sendResponse(res, false, 'Order not found', null, 404);
    const order = orderRes.rows[0];
    if (order.customerid !== parseInt(customerid)) return sendResponse(res, false, 'You are not the owner of this order', null, 403);
    if (order.status !== 'cost_confirmed') return sendResponse(res, false, 'Order is not ready for approval', null, 400);

    const updateRes = await sql.query(
      `UPDATE orders SET status='in_progress', updatedat=NOW() WHERE orderid=$1 RETURNING *`,
      [orderid]
    );

    sendResponse(res, true, 'Order approved by customer', updateRes.rows[0]);
  } catch (err) {
    console.error('POST /orders/customer-approve error:', err.message);
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
