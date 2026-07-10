const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[supabase] MISSING env vars: SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

module.exports = createClient(supabaseUrl, supabaseKey);
