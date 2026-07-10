const jwt = require('jsonwebtoken');
const supabase = require('./_supabase');

// Helper: parse JSON body for Vercel serverless
async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function verifyToken(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized. Please log in.' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('simulation_history')
      .select('id, country_code, country_name, snapshot, notes, created_at')
      .eq('user_id', user.sub)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[history GET]', error);
      return res.status(500).json({ error: 'Could not fetch history.' });
    }
    return res.status(200).json({ history: data });
  }

  if (req.method === 'POST') {
    const { country_code, country_name, snapshot, notes } = await parseBody(req);
    if (!country_code || !snapshot) {
      return res.status(400).json({ error: 'country_code and snapshot are required.' });
    }

    const { data, error } = await supabase
      .from('simulation_history')
      .insert([{
        user_id: user.sub,
        country_code: String(country_code).toUpperCase(),
        country_name: String(country_name || country_code),
        snapshot,
        notes: notes ? String(notes).slice(0, 500) : null
      }])
      .select('id, created_at')
      .single();

    if (error) {
      console.error('[history POST]', error);
      return res.status(500).json({ error: 'Could not save simulation.' });
    }
    return res.status(201).json({ message: 'Simulation saved.', id: data.id, created_at: data.created_at });
  }

  if (req.method === 'DELETE') {
    const id = (req.query || new URLSearchParams(req.url.split('?')[1] || '')).get('id');
    if (!id) return res.status(400).json({ error: 'id query param required.' });

    const { error } = await supabase
      .from('simulation_history')
      .delete()
      .eq('id', id)
      .eq('user_id', user.sub);

    if (error) {
      console.error('[history DELETE]', error);
      return res.status(500).json({ error: 'Could not delete entry.' });
    }
    return res.status(200).json({ message: 'Deleted.' });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};
