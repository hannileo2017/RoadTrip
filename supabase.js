// supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or Service Key is missing in environment variables!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
