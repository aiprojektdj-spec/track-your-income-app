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
-- Pro-Abo-Verwaltung — wird vom LemonSqueezy-Webhook beschrieben
-- user-plan.js liest hieraus: status, current_period_end, plan
-- ================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                             bigserial    PRIMARY KEY,
    user_id                        uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Abo-Status (von LemonSqueezy)
    plan                           text         NOT NULL DEFAULT 'pro',
    status                         text         NOT NULL DEFAULT 'active',
    -- Mögliche Status-Werte:
    --   active     → Pro-Features aktiv
    --   on_trial   → Testphase (wird wie active behandelt)
    --   cancelled  → Läuft bis current_period_end weiter
    --   paused     → Pausiert
    --   past_due   → Zahlung überfällig
    --   expired    → Abgelaufen

    current_period_end             timestamptz,

    -- LemonSqueezy-IDs (für Webhook-Matching)
    lemonsqueezy_subscription_id   text         UNIQUE,
    lemonsqueezy_customer_id       text,
    lemonsqueezy_order_id          text,
    variant_id                     text,

    created_at                     timestamptz  NOT NULL DEFAULT now(),
    updated_at                     timestamptz  NOT NULL DEFAULT now()
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
-- FERTIG
-- Nach dem Ausführen:
-- 1. Edge Function deployen (supabase/functions/lemonsqueezy-webhook/)
-- 2. In LemonSqueezy: Webhook-URL eintragen + Secret kopieren
-- 3. In Supabase: LEMONSQUEEZY_WEBHOOK_SECRET als Secret setzen
-- 4. In user-plan.js: CHECKOUT_URL mit echtem Produkt-Link ersetzen
-- ================================================================
