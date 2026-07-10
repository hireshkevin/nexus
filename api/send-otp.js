const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
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

// Generate a random 6-digit OTP
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Create SMTP transporter from env vars
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_SENDER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.error('[send-otp] MISSING env vars: SMTP_HOST, SMTP_SENDER, or SMTP_PASS');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: 587,
    secure: false,
    auth: { user, pass }
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const { name, email, password } = await parseBody(req);

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if email already registered
    const { data: existing, error: lookupErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (lookupErr) {
      console.error('[send-otp] lookup error:', lookupErr);
      return res.status(500).json({ error: 'Server error checking existing account.' });
    }
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Generate OTP and hash password
    const otpCode = generateOTP();
    const passwordHash = await bcrypt.hash(String(password), 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Upsert into otp_codes (if user re-requests OTP, overwrite the previous one)
    const { error: upsertErr } = await supabase
      .from('otp_codes')
      .upsert(
        {
          email: normalizedEmail,
          name: String(name).trim(),
          password_hash: passwordHash,
          otp_code: otpCode,
          expires_at: expiresAt
        },
        { onConflict: 'email' }
      );

    if (upsertErr) {
      console.error('[send-otp] upsert error:', upsertErr);
      return res.status(500).json({ error: 'Server error storing OTP.' });
    }

    // Send OTP email
    const transporter = createTransporter();
    if (!transporter) {
      return res.status(500).json({ error: 'SMTP not configured on server.' });
    }

    await transporter.sendMail({
      from: `"NEXUS System" <${process.env.SMTP_SENDER}>`,
      to: normalizedEmail,
      subject: `NEXUS — Your Verification Code: ${otpCode}`,
      text: `Your NEXUS verification code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: 'Courier New', monospace; background: #090014; color: #E0E0E0; padding: 40px; text-align: center;">
          <h1 style="color: #00FFFF; font-size: 28px; letter-spacing: 8px; margin-bottom: 8px;">NEXUS</h1>
          <p style="color: #FF00FF; font-size: 12px; letter-spacing: 4px; margin-bottom: 32px;">VERIFICATION CODE</p>
          <div style="background: #1a103c; border: 2px solid #00FFFF; padding: 24px; display: inline-block; margin-bottom: 24px;">
            <span style="font-size: 36px; letter-spacing: 12px; color: #00FFFF; font-weight: bold;">${otpCode}</span>
          </div>
          <p style="color: #E0E0E0; font-size: 14px; margin-bottom: 8px;">Enter this code to complete your registration.</p>
          <p style="color: #FF00FF; font-size: 12px; opacity: 0.7;">This code expires in 10 minutes.</p>
          <hr style="border: 1px solid #2D1B4E; margin: 24px 0;" />
          <p style="color: #666; font-size: 11px;">If you didn't request this code, you can safely ignore this email.</p>
        </div>
      `
    });

    return res.status(200).json({ message: 'OTP sent to your email.' });
  } catch (err) {
    console.error('[send-otp] unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
};
