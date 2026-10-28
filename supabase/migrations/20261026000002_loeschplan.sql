-- Stackr — Löschung der Cloud-Daten 30 Tage nach Abo-Ende (api/_loeschung.js)
-- =============================================================================
-- In BEIDEN Projekten ausführen (erst stackr-preview, dann stackr-prod). Wiederholbar.
--
-- Entscheidung User 2026-10-26 (plan/02-ENTSCHEIDUNGEN.md): Serverdaten eines Nutzers werden
-- 30 Tage nach Ende der Bezahlzeit gelöscht; Vorwarnung per Mail bei Abo-Ende und 7 Tage vor der
-- Löschung; die GoBD-Prüfliste (sync_anchors) bleibt.
--
-- loeschplan: eine Zeile je Nutzer MIT Cloud-Daten, dessen Whop-Mitgliedschaft nicht mehr gültig
--   ist. inaktiv_seit = erster Tageslauf, der das bemerkt (≤ 1 Tag nach Periodenende). Wird der
--   Nutzer wieder aktiv, verschwindet die Zeile. Nach der Löschung ebenfalls — kein Protokoll mit
--   Personenbezug, die Zahl steht im Tagesbericht (ops_alerts).
--   Keine E-Mail-Adresse hier: die holt der Lauf jedes Mal frisch von Whop.
--
-- sync_list_users: alle Nutzer mit Sync-Daten (Snapshot oder Scope) — der Lauf prüft nur sie.
-- sync_delete_pubkey: öffentlicher Schlüssel eines gelöschten Nutzers (nur wenn er nicht selbst
--   Steuerberater mit Freigabe ist; das prüft api/_loeschung.js).
--
-- Zugriff ausschließlich api/ mit dem Service-Key: RLS an, keine Policy, anon/authenticated
-- ohne Tabellen- und Funktionsrechte (wie 20261024000001_kuendigungen.sql).
-- =============================================================================

create table if not exists loeschplan (
    user_id      text        primary key,
    inaktiv_seit timestamptz not null default now(),
    mail1_am     timestamptz,
    mail2_am     timestamptz
);

alter table loeschplan enable row level security;

create or replace function sync_loeschplan_liste()
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', user_id, 'inaktiv_seit', inaktiv_seit, 'mail1_am', mail1_am, 'mail2_am', mail2_am)
        order by inaktiv_seit), '[]'::jsonb)
      from loeschplan
$$;

create or replace function sync_loeschplan_vormerken(p_users text[])
returns integer language plpgsql set search_path = public, pg_temp as $$
declare n integer;
begin
    insert into loeschplan (user_id) select unnest(p_users) on conflict (user_id) do nothing;
    get diagnostics n = row_count;
    return n;
end $$;

create or replace function sync_loeschplan_mail(p_user text, p_nr integer)
returns void language sql set search_path = public, pg_temp as $$
    update loeschplan
       set mail1_am = case when p_nr = 1 then now() else mail1_am end,
           mail2_am = case when p_nr = 2 then now() else mail2_am end
     where user_id = p_user
$$;

create or replace function sync_loeschplan_entfernen(p_user text)
returns void language sql set search_path = public, pg_temp as $$
    delete from loeschplan where user_id = p_user
$$;

create or replace function sync_list_users()
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select coalesce(jsonb_agg(u order by u), '[]'::jsonb)
      from (select user_id as u from sync_snapshots union select user_id from sync_scopes) x
$$;

create or replace function sync_delete_pubkey(p_user text)
returns void language sql set search_path = public, pg_temp as $$
    delete from public_keys where user_id = p_user
$$;

-- ── Rechte (wie 20261024000001_kuendigungen.sql) ─────────────────────────────────
revoke all on loeschplan from public, anon, authenticated;
revoke all on function sync_loeschplan_liste()                   from public, anon, authenticated;
revoke all on function sync_loeschplan_vormerken(text[])         from public, anon, authenticated;
revoke all on function sync_loeschplan_mail(text, integer)       from public, anon, authenticated;
revoke all on function sync_loeschplan_entfernen(text)           from public, anon, authenticated;
revoke all on function sync_list_users()                         from public, anon, authenticated;
revoke all on function sync_delete_pubkey(text)                  from public, anon, authenticated;
grant select, insert, update, delete on table loeschplan to service_role;
grant execute on function sync_loeschplan_liste()                to service_role;
grant execute on function sync_loeschplan_vormerken(text[])      to service_role;
grant execute on function sync_loeschplan_mail(text, integer)    to service_role;
grant execute on function sync_loeschplan_entfernen(text)        to service_role;
grant execute on function sync_list_users()                      to service_role;
grant execute on function sync_delete_pubkey(text)               to service_role;
