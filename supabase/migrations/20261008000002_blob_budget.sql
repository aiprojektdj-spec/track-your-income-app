-- Stackr — Byte-Budget und Commit-Sperre von api/blob-upload.js in Supabase
-- =============================================================================
-- In BEIDEN Projekten ausführen. Unabhängig von 20261008000001_whop_sessions.sql.
--
-- Bisher lagen beide nur in Redis (INCRBY/EXPIRE NX bzw. SET NX EX). Über
-- api/_sync-store.js folgen sie jetzt STORAGE_BACKEND wie das Rate-Limit.
--   counters  Zähler im festen Fenster mit bigint (Byte-Budget, Default 1 GB / 30 Tage;
--             rate_limits.count ist integer und reicht für BLOB_MAX_BYTES > 2 GB nicht)
--   locks     kurzlebige Sperren mit Ablaufzeit (Commit-Sperre, 30 s)
-- Abgelaufene Zeilen räumt jeder Aufruf selbst weg (wie sync_rate_hit), höchstens 200,
-- gesperrte Zeilen werden übersprungen. Schlüssel enthalten nur die Whop-User-ID, keine IP.
-- =============================================================================

create table if not exists counters (
    key      text        primary key,
    value    bigint      not null,
    reset_at timestamptz not null
);
create index if not exists counters_reset_at on counters (reset_at);

create table if not exists locks (
    key   text        primary key,
    until timestamptz not null
);
create index if not exists locks_until on locks (until);

alter table counters enable row level security;
alter table locks    enable row level security;

-- Wie INCRBY + EXPIRE NX: das Fenster setzt nur die erste Buchung, spätere Buchungen
-- (auch die Rücknahme mit negativem p_delta) verlängern es nicht.
create or replace function sync_counter_add(p_key text, p_delta bigint, p_window integer)
returns bigint language plpgsql as $$
declare n bigint;
begin
    delete from counters where key in (
        select key from counters where reset_at <= now()
         limit 200 for update skip locked);

    insert into counters as c (key, value, reset_at)
    values (p_key, p_delta, now() + make_interval(secs => p_window))
    on conflict (key) do update set
        value    = case when c.reset_at <= now() then p_delta else c.value + p_delta end,
        reset_at = case when c.reset_at <= now() then now() + make_interval(secs => p_window) else c.reset_at end
    returning value into n;
    return n;
end $$;

-- Wie SET key 1 NX EX ttl: true, wenn die Sperre jetzt dem Aufrufer gehört.
create or replace function sync_lock_try(p_key text, p_ttl integer)
returns boolean language plpgsql as $$
declare got integer;
begin
    delete from locks where key in (
        select key from locks where until <= now()
         limit 200 for update skip locked);
    delete from locks where key = p_key and until <= now();

    insert into locks (key, until) values (p_key, now() + make_interval(secs => p_ttl))
    on conflict (key) do nothing;
    get diagnostics got = row_count;
    return got = 1;
end $$;

create or replace function sync_lock_release(p_key text)
returns void language sql as $$
    delete from locks where key = p_key
$$;

-- ── Rechte (wie 20261006000001_sync.sql) ─────────────────────────────────────────
revoke all on counters, locks from public, anon, authenticated;
revoke all on function sync_counter_add(text, bigint, integer) from public, anon, authenticated;
revoke all on function sync_lock_try(text, integer)            from public, anon, authenticated;
revoke all on function sync_lock_release(text)                 from public, anon, authenticated;
grant execute on function sync_counter_add(text, bigint, integer) to service_role;
grant execute on function sync_lock_try(text, integer)            to service_role;
grant execute on function sync_lock_release(text)                 to service_role;
