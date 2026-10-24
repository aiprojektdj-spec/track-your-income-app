-- Stackr — Kündigungsschaltfläche nach § 312k BGB (api/kuendigung.js, kuendigen.html)
-- =============================================================================
-- In BEIDEN Projekten ausführen (erst stackr-preview, dann stackr-prod). Wiederholbar.
--
-- kuendigungen: eine Zeile pro abgeschickter Kündigungserklärung. Dient als Nachweis, dass
--   und wann die Erklärung eingegangen ist (§ 312k Abs. 4 BGB), und als Arbeitsliste für
--   Kündigungen, die nicht automatisch bei Whop ausgeführt werden konnten.
--   whop_status: 'offen'          eingegangen, Whop noch nicht versucht
--                'gekuendigt'     Mitgliedschaft(en) bei Whop zum Periodenende gekündigt
--                'nicht_gefunden' keine laufende Mitgliedschaft zu dieser E-Mail
--                'manuell'        bewusst nicht automatisch (außerordentlich, Wunschdatum)
--                'fehler'         Whop-Aufruf gescheitert (Key fehlt, Rechte fehlen, Ausfall)
--
-- Aufbewahrung: 3 Jahre ab Jahresende des Eingangs (regelmäßige Verjährung §§ 195, 199 BGB).
-- Aufgeräumt wird beim Schreiben (höchstens 200 Zeilen je Aufruf), wie in ops_alerts.
--
-- Zugriff ausschließlich api/ mit dem Service-Key: RLS an, keine Policy, anon/authenticated
-- ohne Tabellen- und Funktionsrechte (wie 20261008000003_ops_alerts.sql).
-- =============================================================================

create table if not exists kuendigungen (
    id           bigserial   primary key,
    eingang      timestamptz not null default now(),
    name         text        not null,
    email        text        not null,
    art          text        not null check (art in ('ordentlich', 'ausserordentlich')),
    grund        text        not null default '',
    zeitpunkt    text        not null default '',
    vertrag      text        not null default '',
    kennung      text        not null default '',
    whop_status  text        not null default 'offen'
                 check (whop_status in ('offen', 'gekuendigt', 'nicht_gefunden', 'manuell', 'fehler')),
    whop_detail  text        not null default '',
    wirksam_zum  timestamptz
);
create index if not exists kuendigungen_eingang on kuendigungen (eingang);
create index if not exists kuendigungen_offen   on kuendigungen (whop_status);

alter table kuendigungen enable row level security;

create or replace function sync_kuendigung_add(
    p_name text, p_email text, p_art text, p_grund text, p_zeitpunkt text, p_vertrag text, p_kennung text)
returns json language plpgsql set search_path = public, pg_temp as $$
declare r kuendigungen;
begin
    delete from kuendigungen where id in (
        select id from kuendigungen
         where eingang < date_trunc('year', now()) - interval '3 years'
         limit 200 for update skip locked);

    insert into kuendigungen (name, email, art, grund, zeitpunkt, vertrag, kennung)
    values (left(coalesce(p_name, ''), 200), left(lower(coalesce(p_email, '')), 254),
            p_art, left(coalesce(p_grund, ''), 2000), left(coalesce(p_zeitpunkt, ''), 40),
            left(coalesce(p_vertrag, ''), 40), left(coalesce(p_kennung, ''), 200))
    returning * into r;
    return json_build_object('id', r.id, 'eingang', r.eingang);
end $$;

create or replace function sync_kuendigung_status(
    p_id bigint, p_status text, p_detail text, p_wirksam timestamptz)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
    update kuendigungen
       set whop_status = p_status, whop_detail = left(coalesce(p_detail, ''), 500), wirksam_zum = p_wirksam
     where id = p_id;
end $$;

-- ── Rechte (wie 20261006000001_sync.sql) ─────────────────────────────────────────
revoke all on kuendigungen from public, anon, authenticated;
revoke all on sequence kuendigungen_id_seq from public, anon, authenticated;
revoke all on function sync_kuendigung_add(text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function sync_kuendigung_status(bigint, text, text, timestamptz) from public, anon, authenticated;
grant select, insert, update, delete on table kuendigungen to service_role;
grant usage on sequence kuendigungen_id_seq to service_role;
grant execute on function sync_kuendigung_add(text, text, text, text, text, text, text) to service_role;
grant execute on function sync_kuendigung_status(bigint, text, text, timestamptz) to service_role;
