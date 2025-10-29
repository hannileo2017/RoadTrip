// test-supabase.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

(async () => {
  const { data, error } = await supabase
    .from('Stores')  // غيّر الاسم لأي جدول فعلي عندك
    .select('*')
    .limit(1);

  console.log('data:', data);
  console.log('error:', error);
})();
