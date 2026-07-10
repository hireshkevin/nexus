-- ============================================================
-- NEXUS · Supabase Schema
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- Required extension for UUID generation
create extension if not exists "uuid-ossp";

-- ── USERS TABLE ──────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- Speed up login lookups by email
create index if not exists idx_users_email on users (lower(email));

-- Only service_role key (server-side) can read/write — blocks public anon key
alter table users enable row level security;

-- ── SIMULATION HISTORY TABLE ─────────────────────────────────
create table if not exists simulation_history (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references users(id) on delete cascade,
  country_code text not null,
  country_name text not null,
  snapshot     jsonb not null,   -- economic data snapshot at time of save
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_sim_history_user on simulation_history (user_id, created_at desc);

-- Only service_role key can access this table
alter table simulation_history enable row level security;

-- ── OTP CODES TABLE (pending registrations) ─────────────────
create table if not exists otp_codes (
  id            uuid primary key default uuid_generate_v4(),
  email         text not null unique,
  name          text not null,
  password_hash text not null,
  otp_code      text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

-- Only service_role key can access this table
alter table otp_codes enable row level security;
