-- Voxa Bank AI - Supabase Database Schema
-- Safe to re-run: all statements are idempotent.
-- Run this in the Supabase SQL Editor.

-- ── Users table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name     TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 80),
    email         TEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
    password_hash TEXT NOT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    is_verified   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row-Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe re-run)
DROP POLICY IF EXISTS "No direct access" ON public.users;

-- RLS: deny all direct PostgREST access (server uses service_role which bypasses RLS)
CREATE POLICY "No direct access" ON public.users
    FOR ALL
    USING (false);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users (created_at DESC);

-- ── Auto-update updated_at trigger ───────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Audit log table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL,
    ip_address  TEXT,
    user_agent  TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access" ON public.audit_log;
CREATE POLICY "No direct access" ON public.audit_log
    FOR ALL
    USING (false);

CREATE INDEX IF NOT EXISTS idx_audit_user_id ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_log (created_at DESC);
