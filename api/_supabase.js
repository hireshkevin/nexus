const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let client;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[supabase] MISSING env vars: SUPABASE_URL or SUPABASE_SERVICE_KEY — API calls will return a clear error instead of crashing the server.');

  // Stub client: lets the server boot even without credentials configured.
  // Any actual query resolves with a descriptive error instead of throwing
  // at require-time and taking down the whole process.
  const notConfigured = async () => ({
    data: null,
    error: { message: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file.' }
  });
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: notConfigured,
    single: notConfigured,
    insert: () => chain,
    upsert: notConfigured,
    delete: () => chain,
    then: (resolve) => resolve(notConfigured())
  };
  client = { from: () => chain };
} else {
  client = createClient(supabaseUrl, supabaseKey);
}

module.exports = client;
