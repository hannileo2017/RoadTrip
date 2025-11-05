const sql = require('../db');
const { getSupabase } = require('../supabaseClient');
let supabase = getSupabase();

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || null;
const SUPABASE_URL = process.env.SUPABASE_URL || null;

try {
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
} catch(e) { /* @supabase/supabase-js may be missing locally — ignore */ }

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');

// كل روت داخل هذا الملف يستخدم التحقق
router.get('/', verifyToken, async (req, res) => {
  // هنا كود جلب الطلبات
  res.json({ message: 'Orders fetched successfully' });
});

module.exports = router;

// --- auto-added init shim (safe) ---
try {
  if (!module.exports) module.exports = router;
} catch(e) {}

if (!module.exports.init) {
  module.exports.init = function initRoute(opts = {}) {
    try {
      if (opts.supabaseKey && !supabase && SUPABASE_URL) {
        try {
          
          supabase = createClient(SUPABASE_URL, opts.supabaseKey);
        } catch(err) { /* ignore */ }
      }
    } catch(err) { /* ignore */ }
    return module.exports;
  };
}
