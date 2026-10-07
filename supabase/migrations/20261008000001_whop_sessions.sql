-- Stackr — Whop-Refresh-Sitzungen auf Supabase (ersetzt die whoprt:*-Keys aus
-- api/whop-token.js und api/whop-refresh.js, Adapter: api/_whop-sessions.js)
-- =============================================================================
-- In BEIDEN Projekten ausführen, nach 20261006000001_sync.sql (braucht rate_limits /
-- sync_rate_hit für den IP-Deckel von whop-refresh).
--
-- Abbildung der Redis-Keys:
--   whoprt:<sid>        JSON { rt, at, exp }, EX 30 Tage   → whop_sessions (sid, data, expires_at)
--   whoprt:lock:<sid>   '1', SET NX EX 10                  → whop_session_locks (sid, until)
--   whoprefresh:rl:*                                       → rate_limits über sync_rate_hit
--
-- TTL wie in Redis: jede Schreibung setzt expires_at neu (SET … EX). Abgelaufene Zeilen
-- sind für sync_whop_session_get sofort unsichtbar; physisch räumt sie jeder hundertste
-- Schreibaufruf weg (wie sync_rate_hit).
--
-- Inhalt: `data` ist Chiffrat { v, iv, ct, tag } (AES-256-GCM, Schlüssel WHOP_SESSION_KEY,
-- nur in api/_whop-sessions.js) des Objekts { rt, at, exp }, das in Redis im Klartext liegt.
-- Entscheidung User 2026-10-08 zu E1. Die Datenbank sieht nie einen Refresh-Token.
-- Zugriff trotzdem ausschließlich api/ mit dem Service-Key: RLS an, keine Policy,
-- anon/authenticated ohne Tabellen- und Funktionsrechte.
-- =============================================================================

create table if not exists whop_sessions (
    sid        text        primary key,
    data       jsonb       not null,
    expires_at timestamptz not null
);
create index if not exists whop_sessions_expires on whop_sessions (expires_at);

create table if not exists whop_session_locks (
    sid   text        primary key,
    until timestamptz not null
);

alter table whop_sessions      enable row level security;
alter table whop_session_locks enable row level security;

-- GET whoprt:<sid> — abgelaufene Sitzung = keine Sitzung
create or replace function sync_whop_session_get(p_sid text)
returns jsonb language sql stable as $$
    select data from whop_sessions where sid = p_sid and expires_at > now()
$$;

-- SET whoprt:<sid> <json> EX <p_ttl>
create or replace function sync_whop_session_put(p_sid text, p_data jsonb, p_ttl integer)
returns void language plpgsql as $$
begin
    insert into whop_sessions (sid, data, expires_at)
    values (p_sid, p_data, now() + make_interval(secs => p_ttl))
    on conflict (sid) do update set data = excluded.data, expires_at = excluded.expires_at;
    if random() < 0.01 then
        delete from whop_sessions      where expires_at <= now();
        delete from whop_session_locks where until      <= now();
    end if;
end $$;

-- DEL whoprt:<sid>
create or replace function sync_whop_session_delete(p_sid text)
returns void language sql as $$
    delete from whop_sessions where sid = p_sid
$$;

-- SET whoprt:lock:<sid> 1 NX EX <p_secs> — true = Sperre erhalten.
-- Atomar: ON CONFLICT sperrt die bestehende Zeile und prüft die WHERE-Bedingung gegen
-- ihren neuesten Stand. Von zwei gleichzeitigen Aufrufen bekommt genau einer row_count 1.
-- Eine abgelaufene Sperre zählt wie ein abgelaufener Redis-Key als nicht vorhanden.
create or replace function sync_whop_lock(p_sid text, p_secs integer)
returns boolean language plpgsql as $$
declare n integer;
begin
    insert into whop_session_locks as l (sid, until)
    values (p_sid, now() + make_interval(secs => p_secs))
    on conflict (sid) do update set until = excluded.until where l.until <= now();
    get diagnostics n = row_count;
    return n = 1;
end $$;

-- DEL whoprt:lock:<sid> — wie in Redis unbedingt, auch wenn die Sperre schon abgelaufen ist
create or replace function sync_whop_unlock(p_sid text)
returns void language sql as $$
    delete from whop_session_locks where sid = p_sid
$$;

-- ── Rechte (wie 20261006000001_sync.sql) ─────────────────────────────────────────
revoke all on whop_sessions, whop_session_locks from public, anon, authenticated;
revoke all on function sync_whop_session_get(text)                 from public, anon, authenticated;
revoke all on function sync_whop_session_put(text, jsonb, integer) from public, anon, authenticated;
revoke all on function sync_whop_session_delete(text)              from public, anon, authenticated;
revoke all on function sync_whop_lock(text, integer)               from public, anon, authenticated;
revoke all on function sync_whop_unlock(text)                      from public, anon, authenticated;
grant execute on function sync_whop_session_get(text)                 to service_role;
grant execute on function sync_whop_session_put(text, jsonb, integer) to service_role;
grant execute on function sync_whop_session_delete(text)              to service_role;
grant execute on function sync_whop_lock(text, integer)               to service_role;
grant execute on function sync_whop_unlock(text)                      to service_role;
