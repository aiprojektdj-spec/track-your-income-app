-- ================================================================
-- Stackr v1.7 — Supabase SQL Setup
-- ----------------------------------------------------------------
-- Führe dieses Script im Supabase SQL-Editor aus:
-- Dashboard → SQL Editor → New query → Paste → Run
-- ================================================================


-- ================================================================
-- TABELLE 1: user_data
-- Speichert alle App-Daten pro User (Cloud-Sync)
-- Jede Zeile = ein LocalStorage/IDB-Key des Users
-- ================================================================
CREATE TABLE IF NOT EXISTS public.user_data (
    id           bigserial    PRIMARY KEY,
    user_id      uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    store_key    text         NOT NULL,
    store_value  jsonb,
    updated_at   timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT user_data_unique UNIQUE (user_id, store_key)
);

-- Schneller Index für user_id-Lookups
CREATE INDEX IF NOT EXISTS idx_user_data_user_id
    ON public.user_data (user_id);

-- Aktualisiert updated_at automatisch bei UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_data_updated_at
    BEFORE UPDATE ON public.user_data
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Row-Level-Security (RLS) — jeder User sieht nur seine eigenen Daten
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_data: select own"
    ON public.user_data FOR SELECT
    USING (auth.uid() = user_id);

-- ── Row-Count Guard (Red-Team F2/F3 fix) ────────────────────────────────────
-- Prevents direct API abuse: limits user_data rows per user when no active
-- Pro subscription exists. Counts store_key rows; each key = one JSON blob.
-- Pro users (active/trialing/cancelled-but-valid) bypass this limit.
-- NOTE: Free users are blocked from adding more than 100 store-keys via API.
--       The app itself enforces "50 Buchungen" in JS; this is the server-side
--       backstop against raw API access.
CREATE OR REPLACE FUNCTION public.check_user_data_row_limit()
RETURNS TRIGGER AS $$
DECLARE
    has_pro BOOLEAN;
    row_count INTEGER;
BEGIN
    -- Check for active Pro subscription
    SELECT EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.user_id = NEW.user_id
          AND s.status IN ('active', 'trialing', 'cancelled')
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
    ) INTO has_pro;

    -- Pro users: no limit
    IF has_pro THEN
        RETURN NEW;
    END IF;

    -- Free/Trial users: limit to 100 store_key rows per user
    SELECT COUNT(*) INTO row_count
    FROM public.user_data WHERE user_id = NEW.user_id;

    IF row_count >= 100 THEN
        RAISE EXCEPTION 'Row limit exceeded. Upgrade to Pro for unlimited storage.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_user_data_row_limit
    BEFORE INSERT ON public.user_data
    FOR EACH ROW EXECUTE FUNCTION public.check_user_data_row_limit();

CREATE POLICY "user_data: insert own"
    ON public.user_data FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_data: update own"
    ON public.user_data FOR UPDATE
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_data: delete own"
    ON public.user_data FOR DELETE
    USING (auth.uid() = user_id);


-- ================================================================
-- TABELLE 2: subscriptions
-- Pro-Abo-Verwaltung — wird vom Paddle-Webhook beschrieben
-- user-plan.js liest hieraus: status, current_period_end, plan
-- ================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                         bigserial    PRIMARY KEY,
    user_id                    uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Abo-Status (von Paddle)
    plan                       text         NOT NULL DEFAULT 'pro',
    status                     text         NOT NULL DEFAULT 'active',
    -- Mögliche Status-Werte:
    --   active     → Pro-Features aktiv
    --   trialing   → Testphase (wird wie active behandelt)
    --   cancelled  → Läuft bis current_period_end weiter
    --   paused     → Pausiert
    --   past_due   → Zahlung überfällig
    --   expired    → Abgelaufen

    current_period_end         timestamptz,

    -- Paddle-IDs (für Webhook-Matching)
    paddle_subscription_id     text         UNIQUE,
    paddle_customer_id         text,
    variant_id                 text,

    created_at                 timestamptz  NOT NULL DEFAULT now(),
    updated_at                 timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
    ON public.subscriptions (user_id);

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: Users können nur ihr eigenes Abo lesen
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions: select own"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Webhook nutzt service_role-Key → bypasses RLS automatisch
-- Daher keine INSERT/UPDATE-Policy für den Webhook nötig


-- ================================================================
-- MIGRATION: Falls DB bereits mit lemonsqueezy_* Spalten deployt:
-- ALTER TABLE public.subscriptions
--   RENAME COLUMN lemonsqueezy_subscription_id TO paddle_subscription_id;
-- ALTER TABLE public.subscriptions
--   RENAME COLUMN lemonsqueezy_customer_id TO paddle_customer_id;
-- ALTER TABLE public.subscriptions
--   DROP COLUMN IF EXISTS lemonsqueezy_order_id;
-- ================================================================
-- FERTIG
-- Nach dem Ausführen:
-- 1. Edge Function deployen (supabase/functions/paddle-webhook/)
-- 2. In Paddle: Webhook-URL eintragen + Secret kopieren
--    URL: https://<project-ref>.supabase.co/functions/v1/paddle-webhook
-- 3. In Supabase: PADDLE_WEBHOOK_SECRET als Secret setzen
--    (Dashboard → Edge Functions → Secrets)
-- ================================================================
