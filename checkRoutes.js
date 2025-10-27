// checkRoutes.js
const path = require('path');

const routes = [
  'appSettings','areas','auditTrail','cities','coupons','couponsAdvanced','customers',
  'deliveryZones','deviceTokens','driverLocations','driverRatings','driver','notifications',
  'orderDisputes','orderHistory','orderHistoryDetailed','orderItems','orders','orderTracking',
  'payments','products','rolePermissions','roles','sessions','storeCategories','storeRatings',
  'stores','supportTickets','systemSettings','transactions','units','users'
];

routes.forEach(r => {
  const p = path.join(__dirname, 'routes', r);
  try {
    const mod = require(p);
    const t = typeof mod;
    const isRouterLike = (t === 'function') || (mod && typeof mod === 'object' && (typeof mod.use === 'function' || typeof mod.handle === 'function'));
    console.log(`${r.padEnd(25)} -> typeof: ${t.padEnd(10)} | router-like: ${isRouterLike}`);
  } catch (err) {
    console.log(`${r.padEnd(25)} -> ERROR require: ${err.message}`);
  }
});
