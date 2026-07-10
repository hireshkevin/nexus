const supabase = require('./_supabase');

// Helper: parse JSON body for Vercel serverless (req.body may be undefined)
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const { email, otp } = await parseBody(req);

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const otpStr = String(otp).trim();

    // Look up the OTP record
    const { data: otpRecord, error: lookupErr } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (lookupErr) {
      console.error('[register] otp lookup error:', lookupErr);
      return res.status(500).json({ error: 'Server error verifying OTP.' });
    }
    if (!otpRecord) {
      return res.status(400).json({ error: 'No OTP found for this email. Please request a new one.' });
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      // Clean up expired OTP
      await supabase.from('otp_codes').delete().eq('email', normalizedEmail);
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Check code matches
    if (otpRecord.otp_code !== otpStr) {
      return res.status(400).json({ error: 'Invalid OTP code.' });
    }

    // Check if email already registered (race condition guard)
    const { data: existing, error: existErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existErr) {
      console.error('[register] user lookup error:', existErr);
      return res.status(500).json({ error: 'Server error checking existing account.' });
    }
    if (existing) {
      await supabase.from('otp_codes').delete().eq('email', normalizedEmail);
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Create user with the pre-hashed password stored during send-otp
    const { data: created, error: insertErr } = await supabase
      .from('users')
      .insert([{
        name: otpRecord.name,
        email: normalizedEmail,
        password_hash: otpRecord.password_hash
      }])
      .select('id, name, email')
      .single();

    if (insertErr) {
      console.error('[register] insert error:', insertErr);
      return res.status(500).json({ error: 'Server error creating account.' });
    }

    // Clean up used OTP
    await supabase.from('otp_codes').delete().eq('email', normalizedEmail);

    return res.status(201).json({
      message: 'Account created successfully.',
      user: { id: created.id, name: created.name, email: created.email }
    });
  } catch (err) {
    console.error('[register] unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
};
