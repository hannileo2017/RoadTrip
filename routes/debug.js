// routes/debug.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const routesList = req.app.locals.routesList || [];
    // عرض منسق: route, file, methods, authRequired
    res.json({ ok: true, routes: routesList });
  } catch (err) {
    console.error('Debug route error:', err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

module.exports = router;
