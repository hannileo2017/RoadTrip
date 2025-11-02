// supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // أو ANON_KEY حسب الحاجة

if (!supabaseUrl || !supabaseKey) {
  throw new Error('⚠️ Missing SUPABASE env vars.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
