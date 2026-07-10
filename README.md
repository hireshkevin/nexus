# NEXUS — Deployment Guide

Deploy on **Vercel** (frontend + API) + **Supabase** (database). Both have generous free tiers.

---

## Architecture

```
User visits Vercel URL
     │
     ▼
effect.html  ──(not logged in)──▶  login.html  ──(register/login)──▶  nexus-mobile-fixed.html
     │                                                                          │
     └──(already logged in)──────────────────────────────────────────────────▶ │
                                                                      saves history to Supabase
```

---

## Step 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → **New Project** (free tier)
2. Wait for project to provision (~2 minutes)
3. Open **SQL Editor** → **New Query** → paste the entire contents of `supabase-schema.sql` → click **Run**
4. From **Project Settings → API**, copy:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **service_role secret key** (not the anon key — the one labeled "secret")

---

## Step 2 — Vercel Setup

1. Push this project to a GitHub repo (or use the Vercel CLI)
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. Vercel auto-detects the `vercel.json` — no framework setting needed
4. **Before deploying**, go to **Project Settings → Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `SUPABASE_URL` | Your Supabase Project URL |
   | `SUPABASE_SERVICE_KEY` | Your Supabase service_role secret key |
   | `JWT_SECRET` | Any long random string (e.g. 64 random chars) |

5. Click **Deploy**

---

## Step 3 — Verify

- Visit your Vercel URL → you should see the NEXUS entry animation
- Click the enter button → you land on the login page
- Register an account → you are taken to the simulator
- Click **💾 Save** in the nav bar to save the current simulation
- Click **🕑 History** to view saved simulations
- Log out → revisiting `/nexus-mobile-fixed.html` directly redirects to login

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.example .env
# Edit .env and fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET

# 3. Start server
npm start
# → http://localhost:3000
```

---

## File Structure

```
nexus/
├── api/
│   ├── _supabase.js       # Supabase client (reads env vars)
│   ├── login.js           # POST /api/login
│   ├── register.js        # POST /api/register
│   └── history.js         # GET/POST/DELETE /api/history  ← NEW
├── public/
│   ├── effect.html        # Entry animation (auth-aware)
│   ├── login.html         # Login + Register form
│   ├── nexus-mobile-fixed.html  # Main simulator (auth-guarded)
│   └── index.html         # Redirect shim
├── supabase-schema.sql    # Run once in Supabase SQL editor
├── vercel.json            # Routing config for Vercel
├── server.js              # Local Express server
├── package.json
└── .env.example
```

---

## Bugs Fixed

| # | Problem | Fix |
|---|---------|-----|
| 1 | `/` returns "Cannot GET /" | `vercel.json` now uses `@vercel/static` build for `/public/**` and routes `/` directly to `effect.html` |
| 2 | Static files unreachable | Added proper static build config in `vercel.json` |
| 3 | Anyone can access `/nexus-mobile-fixed.html` directly | Auth guard script at top of file — redirects to `login.html` if no token |
| 4 | Login page accessible when already logged in | Auto-redirects to app if valid token already in localStorage |
| 5 | Register didn't persist data | Bug was missing RLS policy on Supabase — service_role key bypasses RLS, schema now documents this clearly |
| 6 | No simulation history | New `api/history.js` + `simulation_history` table + Save/History buttons in nav |
| 7 | Back button on login went to app without auth | Button now checks token first |

---

## Supabase Free Tier Limits

- 500 MB database storage
- 2 GB bandwidth/month
- Unlimited API requests
- Project pauses after **7 days of inactivity** on free tier — visit your Supabase dashboard monthly to keep it active, or upgrade to Pro ($25/mo)

---

## Security Notes

- The `SUPABASE_SERVICE_KEY` must **never** appear in frontend code — it only lives in Vercel's environment variables and is used server-side in the `/api` functions
- Passwords are hashed with bcrypt (cost factor 10) before storage — never stored in plain text
- JWT tokens expire after 7 days
- Row Level Security (RLS) is enabled on all tables so even if the anon key leaked, it can't read user data
