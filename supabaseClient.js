// supabaseClient.js
// Singleton safe Supabase client wrapper used by routes
// Usage:
// const { getSupabase } = require('../supabaseClient');
// const supabase = getSupabase();

let _supabase = (typeof global !== 'undefined') ? global.__supabase_singleton : null;

function create() {
  if (_supabase) return _supabase;

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || null;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || null;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_KEY — returning null');
    return null;
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    if (typeof global !== 'undefined') global.__supabase_singleton = _supabase;
    console.log('[Supabase] Client initialized successfully');
    return _supabase;
  } catch (e) {
    console.error('[Supabase] Failed to initialize client:', e.message);
    return null;
  }
}

function getSupabase() {
  if (!_supabase) _supabase = create();
  return _supabase;
}

module.exports = { getSupabase, create };
