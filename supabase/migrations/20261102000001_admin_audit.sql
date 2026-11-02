-- Stackr Admin-Panel — Phase a: Audit-Log (append-only) und Idle-Sessions
-- =============================================================================
-- Gilt nur fuer das Admin-Panel (admin/). Tabellen heissen admin_*, liegen in public
-- und sind per RLS + revoke fuer anon/authenticated gesperrt; Zugriff ausschliesslich
-- ueber die Funktionen unten mit dem Service-Key (wie 20261008000003_ops_alerts.sql).
-- Bewusst KEIN eigenes Schema: PostgREST muesste es erst im Dashboard freigeben.
--
-- Audit-Log: kein UPDATE, kein DELETE, kein TRUNCATE — auch nicht fuer service_role,
-- weil Trigger fuer jede Rolle gelten. Aufbewahrung unbegrenzt (Nachweiszweck).
-- Inhalt: Aktion, Ziel, Vorher/Nachher als JSON, IP und User-Agent des Admins.
-- =============================================================================

create table if not exists admin_audit_log (
    id          bigserial   primary key,
    ts          timestamptz not null default now(),
    admin_email text        not null,
    action      text        not null,
    target_type text        not null default '',
    target_id   text        not null default '',
    before      jsonb,
    after       jsonb,
    ip          text        not null default '',
    user_agent  text        not null default ''
);
create index if not exists admin_audit_ts     on admin_audit_log (ts desc);
create index if not exists admin_audit_action on admin_audit_log (action, id desc);
create index if not exists admin_audit_target on admin_audit_log (target_type, target_id, id desc);
create index if not exists admin_audit_admin  on admin_audit_log (admin_email, id desc);

alter table admin_audit_log enable row level security;

create or replace function sync_admin_audit_gesperrt() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
    raise exception 'admin_audit_log ist append-only';
end $$;

drop trigger if exists admin_audit_kein_update on admin_audit_log;
create trigger admin_audit_kein_update before update or delete on admin_audit_log
    for each row execute function sync_admin_audit_gesperrt();
drop trigger if exists admin_audit_kein_truncate on admin_audit_log;
create trigger admin_audit_kein_truncate before truncate on admin_audit_log
    for each statement execute function sync_admin_audit_gesperrt();

create or replace function sync_admin_audit_add(
    p_admin text, p_action text, p_target_type text, p_target_id text,
    p_before jsonb, p_after jsonb, p_ip text, p_ua text)
returns bigint language sql set search_path = public, pg_temp as $$
    insert into admin_audit_log (admin_email, action, target_type, target_id, before, after, ip, user_agent)
    values (left(p_admin, 200), left(p_action, 80), left(coalesce(p_target_type, ''), 60),
            left(coalesce(p_target_id, ''), 200), p_before, p_after,
            left(coalesce(p_ip, ''), 64), left(coalesce(p_ua, ''), 300))
    returning id;
$$;

-- Keyset-Paginierung: p_before_id = kleinste id der letzten Seite (null = erste Seite).
create or replace function sync_admin_audit_search(
    p_admin text, p_action text, p_target_type text, p_target_id text,
    p_from timestamptz, p_to timestamptz, p_limit int, p_before_id bigint)
returns setof admin_audit_log language sql stable set search_path = public, pg_temp as $$
    select * from admin_audit_log
     where (p_admin       is null or admin_email = p_admin)
       and (p_action      is null or action = p_action)
       and (p_target_type is null or target_type = p_target_type)
       and (p_target_id   is null or target_id = p_target_id)
       and (p_from        is null or ts >= p_from)
       and (p_to          is null or ts <  p_to)
       and (p_before_id   is null or id < p_before_id)
     order by id desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- ── Idle-Timeout ────────────────────────────────────────────────────────────────
-- Eine Zeile je Supabase-Session (Claim session_id). Liegt der letzte Zugriff laenger
-- als p_idle_secs zurueck, wird die Zeile geloescht und false geliefert: der Client
-- muss neu anmelden (neue Session, neue Zeile).
create table if not exists admin_sessions (
    session_id  text        primary key,
    admin_email text        not null,
    created_at  timestamptz not null default now(),
    last_seen   timestamptz not null default now()
);
alter table admin_sessions enable row level security;

create or replace function sync_admin_session_touch(p_sid text, p_email text, p_idle_secs int)
returns boolean language plpgsql set search_path = public, pg_temp as $$
declare v_last timestamptz;
begin
    delete from admin_sessions where last_seen < now() - interval '7 days';
    select last_seen into v_last from admin_sessions where session_id = p_sid for update;
    if not found then
        insert into admin_sessions (session_id, admin_email) values (p_sid, p_email);
        return true;
    end if;
    if v_last < now() - make_interval(secs => p_idle_secs) then
        delete from admin_sessions where session_id = p_sid;
        return false;
    end if;
    update admin_sessions set last_seen = now() where session_id = p_sid;
    return true;
end $$;

-- ── Rechte ──────────────────────────────────────────────────────────────────────
revoke all on admin_audit_log, admin_sessions from public, anon, authenticated;
revoke all on sequence admin_audit_log_id_seq from public, anon, authenticated;
revoke all on function sync_admin_audit_add(text, text, text, text, jsonb, jsonb, text, text) from public, anon, authenticated;
revoke all on function sync_admin_audit_search(text, text, text, text, timestamptz, timestamptz, int, bigint) from public, anon, authenticated;
revoke all on function sync_admin_session_touch(text, text, int) from public, anon, authenticated;
revoke all on function sync_admin_audit_gesperrt() from public, anon, authenticated;
-- Alle vier Rechte, weil test-migration-tabellenrechte.js sie je Tabelle verlangt; UPDATE/DELETE
-- scheitern am Trigger oben, nicht am Recht.
grant select, insert, update, delete on admin_audit_log to service_role;
grant usage on sequence admin_audit_log_id_seq to service_role;
grant select, insert, update, delete on admin_sessions to service_role;
grant execute on function sync_admin_audit_add(text, text, text, text, jsonb, jsonb, text, text) to service_role;
grant execute on function sync_admin_audit_search(text, text, text, text, timestamptz, timestamptz, int, bigint) to service_role;
grant execute on function sync_admin_session_touch(text, text, int) to service_role;
grant execute on function sync_admin_audit_gesperrt() to service_role;
