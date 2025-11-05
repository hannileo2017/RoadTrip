// supabaseClient.js
// Singleton safe supabase client wrapper used by routes
// Usage: const { getSupabase } = require('../supabaseClient'); const supabase = getSupabase();

let _supabase = (typeof global !== 'undefined') ? global.__supabase_singleton : null;

function create() {
  if (_supabase) return _supabase;

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || null;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || null;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // لا نرمي هنا — نترك الملفات تستخدم sql / DB fallback إن لم يكن Supabase متوفرًا
    return null;
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    if (typeof global !== 'undefined') global.__supabase_singleton = _supabase;
    return _supabase;
  } catch (e) {
    // لو الحزمة غير منصّبة، نرجع null بدل أن نكسر التشغيل
    return null;
  }
}

function getSupabase() {
  if (!_supabase) _supabase = create();
  return _supabase;
}

module.exports = { getSupabase, create, _supabase };
