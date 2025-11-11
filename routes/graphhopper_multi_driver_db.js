const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
require('dotenv').config();

// --------------------
// دالة موحدة للرد
function sendResponse(res, success, message, data = null, status = 200) {
  return res.status(status).json({ success, message, timestamp: new Date().toISOString(), data });
}

// --------------------
// Nearest Neighbor + 2-Opt helpers
function nearestNeighborOrder(distMatrix, startIndex = 0, endIndex = null) {
  const n = distMatrix.length;
  const visited = Array(n).fill(false);
  const order = [];
  let current = startIndex;
  order.push(current);
  visited[current] = true;

  const fixedEnd = (endIndex !== null && endIndex !== startIndex) ? endIndex : null;

  while (order.length < n) {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      if (i === fixedEnd && order.length < n - 1) continue;
      const d = distMatrix[current][i];
      if (d < bestDist) { bestDist = d; best = i; }
    }
    if (best === -1 && fixedEnd !== null && !visited[fixedEnd]) best = fixedEnd;
    if (best === -1) break;
    visited[best] = true;
    order.push(best);
    current = best;
  }
  return order;
}

function twoOptImprove(distMatrix, order, maxIter = 2000) {
  const n = order.length;
  if (n < 4) return order;

  const totalDist = ord => ord.reduce((sum, val, i) => i > 0 ? sum + distMatrix[ord[i-1]][ord[i]] : 0, 0);

  let bestOrder = order.slice();
  let bestDist = totalDist(bestOrder);
  let improved = true;
  let iter = 0;

  while (improved && iter++ < maxIter) {
    improved = false;
    for (let i = 1; i < n - 2; i++) {
      for (let j = i + 1; j < n - 1; j++) {
        const newOrder = bestOrder.slice(0, i)
          .concat(bestOrder.slice(i, j + 1).reverse(), bestOrder.slice(j + 1));
        const newDist = totalDist(newOrder);
        if (newDist + 1e-6 < bestDist) {
          bestOrder = newOrder;
          bestDist = newDist;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return bestOrder;
}

// --------------------
// تحويل نقاط من param
function parsePointsParam(pointsParam) {
  if (!pointsParam) return [];
  const arr = Array.isArray(pointsParam) ? pointsParam : pointsParam.split('|');
  const points = arr.map(item => {
    const [lat, lng] = item.split(',').map(s => Number(s.trim()));
    if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error(`Invalid point: ${item}`);
    return { lat, lng, raw: item };
  });
  return points;
}

// --------------------
// Route رئيسي للعديد من السائقين
router.post('/multi-route', async (req, res) => {
  try {
    const { drivers, vehicle = 'car', optimize = true } = req.body;
    if (!drivers || !Array.isArray(drivers) || drivers.length === 0) 
      return sendResponse(res, false, 'drivers array is required', null, 400);

    const apiKey = process.env.GRAPH_HOPPER_KEY || 'd841807e-41fc-430b-b846-dfde985f2868';
    const allResults = [];

    for (const drv of drivers) {
      const { driverId, points, startIndex = 0, endIndex = null } = drv;
      if (!points || points.length < 2) continue;

      const pts = parsePointsParam(points);

      // --------------------
      // Matrix API
      const matrixResp = await fetch('https://graphhopper.com/api/1/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: pts.map(p => [p.lat, p.lng]), vehicle, out_array: ['times'], key: apiKey })
      });
      const matrixData = await matrixResp.json();
      if (!matrixData.times) throw new Error('Matrix API failed');

      const distMatrix = matrixData.times;
      let order = pts.map((_, i) => i);
      if (optimize) {
        const nn = nearestNeighborOrder(distMatrix, startIndex, endIndex);
        order = twoOptImprove(distMatrix, nn);
      }

      const orderedPoints = order.map(i => pts[i]);
      const pointParams = orderedPoints.map(p => `point=${p.lat},${p.lng}`).join('&');
      const ghRouteUrl = `https://graphhopper.com/api/1/route?${pointParams}&vehicle=${vehicle}&locale=ar&key=${apiKey}&points_encoded=false`;

      const routeResp = await fetch(ghRouteUrl);
      const routeData = await routeResp.json();
      if (!routeData.paths || routeData.paths.length === 0) continue;

      const route = routeData.paths[0];
      const routePoints = route.points?.coordinates.map(([lng, lat]) => ({ lat, lng })) || [];

      const optimizedOrder = order.map(i => ({
        index: i,
        point: pts[i].raw,
        lat: pts[i].lat,
        lng: pts[i].lng
      }));

      allResults.push({
        driverId,
        originalCount: pts.length,
        optimizedOrder,
        routeSummary: { distance: route.distance, time: Math.round(route.time/1000), ascend: route.ascend || null },
        points: routePoints,
        rawGraphHopper: routeData
      });
    }

    sendResponse(res, true, 'Multi-driver routes calculated successfully', { drivers: allResults });

  } catch (err) {
    console.error('Multi-driver route error:', err);
    sendResponse(res, false, err.message, null, 500);
  }
});

module.exports = router;
