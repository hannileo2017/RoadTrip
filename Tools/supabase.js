// مثال مع @supabase/supabase-js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkTables() {
  const { data, error } = await supabase.from('customers').select('*').limit(5);
  if (error) console.error(error);
  else console.log(data);
}

checkTables();
