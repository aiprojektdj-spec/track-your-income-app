-- ================================================================
-- Migration: LemonSqueezy → Paddle column names
-- ----------------------------------------------------------------
-- Nur ausführen wenn DB bereits mit lemonsqueezy_* Spalten deployt.
-- Supabase Dashboard → SQL Editor → New query → Paste → Run
-- ================================================================

-- 1. Spalten umbenennen
ALTER TABLE public.subscriptions
    RENAME COLUMN lemonsqueezy_subscription_id TO paddle_subscription_id;

ALTER TABLE public.subscriptions
    RENAME COLUMN lemonsqueezy_customer_id TO paddle_customer_id;

-- 2. Nicht mehr benötigte Spalte entfernen
ALTER TABLE public.subscriptions
    DROP COLUMN IF EXISTS lemonsqueezy_order_id;

-- ================================================================
-- Fertig. Prüfung:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'subscriptions';
-- ================================================================
