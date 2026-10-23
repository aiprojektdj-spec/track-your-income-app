-- Stackr — serverführende Datenhaltung, Phase 1 (Schritt R2 aus plan/server-umbau-2026-10-22.md)
-- =============================================================================
-- Erst in stackr-preview ausführen (User), Prüfliste dort; stackr-prod erst zum Livegang (R9).
-- Braucht 20261022000001_shopify.sql (FK und Owner-Prüfung für integrations). Wiederholbar.
--
-- Datenmodell (Plan Abschnitt 1): ein Datensatz des Browsers = eine Zeile in `records`, Inhalt
-- bleibt das heutige JSON-Objekt (`data`). Spalten für Regeln (datum, nummer, quelle,
-- gesperrt_grund) setzt die Schreibfunktion aus ihren Parametern, die api/data.js (Server)
-- bestimmt — nicht der Browser.
--
-- RLS nach Weg E-A (Plan 1, „RLS je Whop-User und Firma“):
--   - Rolle stackr_app: NOLOGIN, NOBYPASSRLS. Eigentümer aller Funktionen dieser Datei.
--   - Datenfunktionen sind SECURITY DEFINER (laufen also als stackr_app) und setzen als Erstes
--     set_config('stackr.user', p_user, true) — transaktionslokal, PostgREST = eine Transaktion.
--   - Datentabellen: RLS an UND force; Policies prüfen company_members gegen stackr.user,
--     Schreiben nur rolle = 'owner'. Damit greift RLS auch, wenn eine Funktion ein
--     `where company_id = …` vergisst.
--   - service_role: nur EXECUTE auf die Datenfunktionen, KEINE Tabellenrechte auf Datentabellen.
--   - Rekursion: Eine Policy, die über Unterabfragen wieder bei ihrer eigenen Tabelle ankommt,
--     bricht in Postgres mit „infinite recursion detected in policy“ ab. Deshalb hat
--     company_members eine Policy ohne Unterabfrage (eigene Zeilen), und companies prüft die
--     Mitgliedschaft über die Funktion ist_mitglied() statt über eine Unterabfrage.
--
-- GoBD (Plan Abschnitt 4):
--   - records: Update/Delete abgelehnt (SQLSTATE SR001), wenn gesperrt_grund gesetzt ist oder
--     `datum` in einer festgeschriebenen Periode liegt (perioden: abgeschlossen oder
--     eingereicht_am). Einzige Ausnahme: der Sperrvermerk selbst (gesperrt_grund null → Wert,
--     sonst nichts geändert) — damit lässt sich ein Datensatz in einer festgeschriebenen Periode
--     noch stornieren. Neuanlage in gesperrter Periode bleibt erlaubt (§153 AO, Hinweis im Browser).
--   - audit_log: nur INSERT. Kein UPDATE/DELETE-Recht für irgendeine App-Rolle, Trigger wirft
--     zusätzlich (SR002), auch bei TRUNCATE. Hash-Kette je Firma im Trigger mit sha256():
--       hash = hex(sha256( prev_hash ‖ company_id ‖ seq ‖ ts (UTC, ISO, µs) ‖ user_id ‖ aktion
--                          ‖ art ‖ entity_id ‖ alt::text ‖ neu::text ‖ details ))
--     ‖ = Zeilenumbruch, null = leerer Text, erster prev_hash = 64 × '0'. ts und user_id setzt
--     der Trigger selbst (Serverzeit, stackr.user), nicht der Aufrufer.
--   - Nummernkreise lückenlos: nummer_ziehen() läuft nur INNERHALB von datensatz_schreiben,
--     in derselben Transaktion wie das Speichern (eine gezogene, nie gespeicherte Nummer gäbe
--     eine Lücke). Für service_role deshalb nicht aufrufbar.
--
-- Änderungsnummer (Mehrgeräte-Abgleich): companies.change_seq wird je Schreibung um 1 erhöht
-- (sperrt dabei die Firmenzeile = Schreibungen einer Firma laufen nacheinander) und landet als
-- `seq` in records/settings. aenderungen_seit(p_seq) liefert alles danach, auch gelöschte.
--
-- Shopify (Plan 1, „Shopify-Tabellen im Modell“), 20261022000001_shopify.sql bleibt unverändert:
--   FK integrations.company_id → companies on delete cascade (not valid, validate wenn keine
--   Waisen), sync_shopify_integration_speichern mit Owner-Prüfung (neu definiert, gleiche
--   Signatur), Spalte shopify_eingang.gebucht, Lese-Funktion shopify_status.
--   WICHTIG: Wird 20261022000001_shopify.sql erneut ausgeführt, ersetzt es
--   sync_shopify_integration_speichern wieder durch die Fassung OHNE Owner-Prüfung. Danach
--   diese Datei erneut ausführen.
--
-- Umzug alter Audit-Ketten (R5): audit_uebernehmen() legt jeden Browser-Eintrag als eigene
-- Zeile (aktion 'browser_audit') an. Der Originaltext steht wortgleich in `details` — die
-- Browser-Prüfsumme hängt an der Schlüsselreihenfolge von JSON.stringify, die jsonb nicht
-- erhält —, `neu` trägt ihn zusätzlich als jsonb zum Abfragen. Die Server-Kette läuft
-- über diese Zeilen hinweg weiter, der Trigger wird also nicht umgangen. Die Browser-Kette
-- (prevHash/checksum) prüft api/data.js vor dem Aufruf.
--
-- Offen für spätere Schritte (bewusst nicht hier): Perioden festschreiben/Wiedereröffnen (R7),
-- StB-Einladung und Mitgliederliste für Owner (R7), Schreibfunktionen für anhaenge/user_prefs.
-- Endpunkte: api/_auth.js, api/data.js (R3).
--
-- Prüfung statisch: test/test-server-datenmodell.js. Prüfliste für stackr-preview: siehe dort
-- im Kopf.
-- =============================================================================

-- ── Rolle ───────────────────────────────────────────────────────────────────────
do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'stackr_app') then
        create role stackr_app nologin nobypassrls;
    end if;
end $$;
-- Der ausführende Nutzer (postgres) muss Funktionen an stackr_app übergeben können; ab PG 16
-- bekommt der Ersteller einer Rolle dafür nicht automatisch SET-Recht.
do $$ begin execute format('grant stackr_app to %I', current_user); end $$;
grant usage  on schema public to stackr_app;
-- ALTER … OWNER verlangt CREATE im Schema beim neuen Eigentümer. stackr_app ist NOLOGIN und
-- nur über die Funktionen dieser Datei erreichbar, die kein dynamisches SQL ausführen.
grant create on schema public to stackr_app;

-- ── Tabellen ────────────────────────────────────────────────────────────────────
create table if not exists companies (
    id          text        primary key check (id ~ '^co_[a-z0-9]{1,40}$'),
    name        text        not null default '',
    rechtsform  text,
    land        text        not null default 'DE',
    created_by  text        not null,
    created_at  timestamptz not null default now(),
    deleted_at  timestamptz,
    change_seq  bigint      not null default 0
);

create table if not exists company_members (
    company_id text        not null references companies (id),
    user_id    text        not null,
    rolle      text        not null check (rolle in ('owner', 'stb_lesen')),
    created_at timestamptz not null default now(),
    revoked_at timestamptz,
    primary key (company_id, user_id)
);
create index if not exists company_members_user on company_members (user_id);

create table if not exists records (
    company_id     text        not null references companies (id),
    art            text        not null check (art ~ '^[a-z0-9_]{1,40}$'),
    id             text        not null check (length(id) between 1 and 100),
    data           jsonb       not null,
    version        integer     not null default 1,
    datum          date,
    nummer         text,
    quelle         text,
    gesperrt_grund text,
    geloescht      boolean     not null default false,
    seq            bigint      not null,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    updated_by     text        not null,
    primary key (company_id, art, id)
);
create unique index if not exists records_quelle on records (company_id, art, quelle) where quelle is not null;
create index if not exists records_datum on records (company_id, art, datum);
create index if not exists records_seq   on records (company_id, seq);

create table if not exists settings (
    company_id text        not null references companies (id),
    key        text        not null check (key ~ '^[a-z0-9_]{1,60}$'),
    data       jsonb       not null,
    version    integer     not null default 1,
    seq        bigint      not null,
    updated_at timestamptz not null default now(),
    updated_by text        not null,
    primary key (company_id, key)
);
create index if not exists settings_seq on settings (company_id, seq);

create table if not exists nummernkreise (
    company_id text   not null references companies (id),
    kreis      text   not null check (kreis ~ '^[a-z0-9_]{1,32}$'),
    naechste   bigint not null default 1 check (naechste >= 1),
    primary key (company_id, kreis)
);

-- Eine Zeile je Jahr (monat und quartal null), Monat oder Quartal. Festgeschrieben, wenn
-- abgeschlossen oder eingereicht_am gesetzt ist. Quartal hier 1–4 (im Browser 0–3).
create table if not exists perioden (
    company_id     text        not null references companies (id),
    jahr           integer     not null check (jahr between 2000 and 2100),
    monat          smallint    check (monat between 1 and 12),
    quartal        smallint    check (quartal between 1 and 4),
    eingereicht_am timestamptz,
    abgeschlossen  boolean     not null default false,
    updated_at     timestamptz not null default now(),
    updated_by     text        not null,
    check (monat is null or quartal is null)
);
create unique index if not exists perioden_eindeutig on perioden (company_id, jahr, coalesce(monat, 0), coalesce(quartal, 0));

create table if not exists audit_log (
    seq        bigserial   primary key,
    company_id text        not null references companies (id),
    ts         timestamptz not null default now(),
    user_id    text        not null,
    aktion     text        not null,
    art        text,
    entity_id  text,
    alt        jsonb,
    neu        jsonb,
    details    text,
    prev_hash  text        not null,
    hash       text        not null
);
create index if not exists audit_log_firma on audit_log (company_id, seq);
create index if not exists audit_log_browser on audit_log (company_id, entity_id) where aktion = 'browser_audit';

create table if not exists anhaenge (
    company_id   text        not null references companies (id),
    id           text        not null,
    record_art   text,
    record_id    text,
    storage_pfad text        not null,
    mime         text,
    bytes        bigint,
    sha256       text,
    created_at   timestamptz not null default now(),
    primary key (company_id, id)
);
create index if not exists anhaenge_record on anhaenge (company_id, record_art, record_id);

create table if not exists user_prefs (
    user_id    text        primary key,
    data       jsonb       not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

-- Whop-Identität für 5 Minuten (api/_auth.js, R3). token_hash = hex SHA-256 des Tokens, nie
-- der Token selbst. Kein Nutzerbezug beim Lesen (der Nutzer steht ja erst danach fest) —
-- deshalb wie die bisherigen Hilfstabellen: RLS ohne Policy, nur service_role über sync_*.
create table if not exists auth_cache (
    token_hash text        primary key check (token_hash ~ '^[0-9a-f]{64}$'),
    user_id    text        not null,
    pro        boolean     not null,
    expires_at timestamptz not null
);
create index if not exists auth_cache_expires on auth_cache (expires_at);

alter table companies       enable row level security;
alter table company_members enable row level security;
alter table records         enable row level security;
alter table settings        enable row level security;
alter table nummernkreise   enable row level security;
alter table perioden        enable row level security;
alter table audit_log       enable row level security;
alter table anhaenge        enable row level security;
alter table user_prefs      enable row level security;
alter table auth_cache      enable row level security;

alter table companies       force row level security;
alter table company_members force row level security;
alter table records         force row level security;
alter table settings        force row level security;
alter table nummernkreise   force row level security;
alter table perioden        force row level security;
alter table audit_log       force row level security;
alter table anhaenge        force row level security;
alter table user_prefs      force row level security;

-- ── Hilfsfunktionen für Policies und Trigger (SECURITY INVOKER, nur stackr_app) ──
-- Mitglied (nicht widerrufen) der Firma? Liest company_members unter deren eigener Policy.
create or replace function ist_mitglied(p_company text)
returns boolean language sql stable set search_path = public, pg_temp as $$
    select exists (select 1 from company_members m
                    where m.company_id = p_company
                      and m.user_id = current_setting('stackr.user', true)
                      and m.revoked_at is null)
$$;

create or replace function ist_owner(p_company text)
returns boolean language sql stable set search_path = public, pg_temp as $$
    select exists (select 1 from company_members m
                    where m.company_id = p_company
                      and m.user_id = current_setting('stackr.user', true)
                      and m.rolle = 'owner'
                      and m.revoked_at is null)
$$;

-- Liegt p_datum in einer festgeschriebenen Periode der Firma?
create or replace function periode_festgeschrieben(p_company text, p_datum date)
returns boolean language sql stable set search_path = public, pg_temp as $$
    select p_datum is not null and exists (
        select 1 from perioden p
         where p.company_id = p_company
           and p.jahr = extract(year from p_datum)::integer
           and (p.abgeschlossen or p.eingereicht_am is not null)
           and ((p.monat is null and p.quartal is null)
                or p.monat   = extract(month   from p_datum)::integer
                or p.quartal = extract(quarter from p_datum)::integer))
$$;

-- Nächste Nummer eines Kreises, lückenlos (Zeilensperre über ON CONFLICT). Nur aus
-- datensatz_schreiben heraus, in derselben Transaktion wie das Speichern.
create or replace function nummer_ziehen(p_company text, p_kreis text)
returns bigint language sql set search_path = public, pg_temp as $$
    insert into nummernkreise as n (company_id, kreis, naechste)
    values (p_company, p_kreis, 2)
    on conflict (company_id, kreis) do update set naechste = n.naechste + 1
    returning naechste - 1
$$;

-- ── Trigger ─────────────────────────────────────────────────────────────────────
create or replace function audit_log_verketten()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_prev text;
begin
    new.user_id := nullif(current_setting('stackr.user', true), '');
    if new.user_id is null then
        raise exception using errcode = 'SR002', message = 'audit_log: kein Nutzer gesetzt';
    end if;
    new.ts := now();
    -- Gleichzeitige Einträge derselben Firma nacheinander, sonst zwei mit demselben prev_hash
    perform pg_advisory_xact_lock(hashtext('stackr-audit:' || new.company_id));
    select a.hash into v_prev from audit_log a
     where a.company_id = new.company_id order by a.seq desc limit 1;
    new.prev_hash := coalesce(v_prev, repeat('0', 64));
    new.hash := encode(sha256(convert_to(concat_ws(E'\n',
        new.prev_hash, new.company_id, new.seq::text,
        to_char(new.ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        new.user_id, new.aktion, coalesce(new.art, ''), coalesce(new.entity_id, ''),
        coalesce(new.alt::text, ''), coalesce(new.neu::text, ''), coalesce(new.details, '')),
        'UTF8')), 'hex');
    return new;
end $$;

create or replace function audit_log_unveraenderlich()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
    raise exception using errcode = 'SR002', message = 'audit_log ist unveraenderlich (' || tg_op || ')';
end $$;

create or replace function records_gobd_sperre()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
    if old.gesperrt_grund is null and not periode_festgeschrieben(old.company_id, old.datum) then
        if tg_op = 'DELETE' then return old; end if;
        return new;
    end if;
    -- Ausnahme: nur der Sperrvermerk kommt hinzu (Storno in festgeschriebener Periode)
    if tg_op = 'UPDATE' and old.gesperrt_grund is null and new.gesperrt_grund is not null
       and new.company_id = old.company_id and new.art = old.art and new.id = old.id
       and new.data = old.data and new.geloescht = old.geloescht
       and new.datum  is not distinct from old.datum
       and new.nummer is not distinct from old.nummer
       and new.quelle is not distinct from old.quelle then
        return new;
    end if;
    raise exception using errcode = 'SR001',
        message = 'GoBD: Datensatz gesperrt (' || coalesce(old.gesperrt_grund, 'festgeschriebene Periode') || ')';
end $$;

drop trigger if exists audit_log_verketten on audit_log;
create trigger audit_log_verketten before insert on audit_log
    for each row execute function audit_log_verketten();
drop trigger if exists audit_log_unveraenderlich on audit_log;
create trigger audit_log_unveraenderlich before update or delete on audit_log
    for each row execute function audit_log_unveraenderlich();
drop trigger if exists audit_log_kein_truncate on audit_log;
create trigger audit_log_kein_truncate before truncate on audit_log
    for each statement execute function audit_log_unveraenderlich();
drop trigger if exists records_gobd_sperre on records;
create trigger records_gobd_sperre before update or delete on records
    for each row execute function records_gobd_sperre();

-- ── Policies ────────────────────────────────────────────────────────────────────
-- Lesen: Mitglied. Schreiben: Owner. Mehrere permissive Policies werden ODER-verknüpft.
drop policy if exists companies_lesen    on companies;
drop policy if exists companies_anlegen  on companies;
drop policy if exists companies_aendern  on companies;
create policy companies_lesen   on companies for select to stackr_app
    using (ist_mitglied(id) or created_by = current_setting('stackr.user', true));
create policy companies_anlegen on companies for insert to stackr_app
    with check (created_by = current_setting('stackr.user', true));
create policy companies_aendern on companies for update to stackr_app
    using (ist_owner(id)) with check (ist_owner(id));

-- Eigene Mitgliedschaften. Anlegen nur als Owner einer selbst angelegten Firma (firma_anlegen);
-- Einladen (StB) kommt mit R7.
drop policy if exists company_members_lesen   on company_members;
drop policy if exists company_members_anlegen on company_members;
create policy company_members_lesen   on company_members for select to stackr_app
    using (user_id = current_setting('stackr.user', true));
create policy company_members_anlegen on company_members for insert to stackr_app
    with check (user_id = current_setting('stackr.user', true) and rolle = 'owner'
                and exists (select 1 from companies c
                             where c.id = company_members.company_id
                               and c.created_by = current_setting('stackr.user', true)));

drop policy if exists records_lesen    on records;
drop policy if exists records_schreiben on records;
create policy records_lesen     on records for select to stackr_app
    using (exists (select 1 from company_members m where m.company_id = records.company_id
                     and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null));
create policy records_schreiben on records for all to stackr_app
    using      (exists (select 1 from company_members m where m.company_id = records.company_id
                          and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null and m.rolle = 'owner'))
    with check (exists (select 1 from company_members m where m.company_id = records.company_id
                          and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null and m.rolle = 'owner'));

drop policy if exists settings_lesen     on settings;
drop policy if exists settings_schreiben on settings;
create policy settings_lesen     on settings for select to stackr_app
    using (exists (select 1 from company_members m where m.company_id = settings.company_id
                     and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null));
create policy settings_schreiben on settings for all to stackr_app
    using      (exists (select 1 from company_members m where m.company_id = settings.company_id
                          and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null and m.rolle = 'owner'))
    with check (exists (select 1 from company_members m where m.company_id = settings.company_id
                          and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null and m.rolle = 'owner'));

drop policy if exists nummernkreise_lesen     on nummernkreise;
drop policy if exists nummernkreise_schreiben on nummernkreise;
create policy nummernkreise_lesen     on nummernkreise for select to stackr_app
    using (exists (select 1 from company_members m where m.company_id = nummernkreise.company_id
                     and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null));
create policy nummernkreise_schreiben on nummernkreise for all to stackr_app
    using      (exists (select 1 from company_members m where m.company_id = nummernkreise.company_id
                          and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null and m.rolle = 'owner'))
    with check (exists (select 1 from company_members m where m.company_id = nummernkreise.company_id
                          and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null and m.rolle = 'owner'));

drop policy if exists perioden_lesen     on perioden;
drop policy if exists perioden_schreiben on perioden;
create policy perioden_lesen     on perioden for select to stackr_app
    using (exists (select 1 from company_members m where m.company_id = perioden.company_id
                     and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null));
create policy perioden_schreiben on perioden for all to stackr_app
    using      (exists (select 1 from company_members m where m.company_id = perioden.company_id
                          and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null and m.rolle = 'owner'))
    with check (exists (select 1 from company_members m where m.company_id = perioden.company_id
                          and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null and m.rolle = 'owner'));

-- audit_log: lesen als Mitglied, anhängen als Owner. Keine Update-/Delete-Policy.
drop policy if exists audit_log_lesen    on audit_log;
drop policy if exists audit_log_anhaengen on audit_log;
create policy audit_log_lesen     on audit_log for select to stackr_app
    using (exists (select 1 from company_members m where m.company_id = audit_log.company_id
                     and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null));
create policy audit_log_anhaengen on audit_log for insert to stackr_app
    with check (exists (select 1 from company_members m where m.company_id = audit_log.company_id
                          and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null and m.rolle = 'owner'));

drop policy if exists anhaenge_lesen     on anhaenge;
drop policy if exists anhaenge_schreiben on anhaenge;
create policy anhaenge_lesen     on anhaenge for select to stackr_app
    using (exists (select 1 from company_members m where m.company_id = anhaenge.company_id
                     and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null));
create policy anhaenge_schreiben on anhaenge for all to stackr_app
    using      (exists (select 1 from company_members m where m.company_id = anhaenge.company_id
                          and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null and m.rolle = 'owner'))
    with check (exists (select 1 from company_members m where m.company_id = anhaenge.company_id
                          and m.user_id = current_setting('stackr.user', true) and m.revoked_at is null and m.rolle = 'owner'));

drop policy if exists user_prefs_eigene on user_prefs;
create policy user_prefs_eigene on user_prefs for all to stackr_app
    using (user_id = current_setting('stackr.user', true))
    with check (user_id = current_setting('stackr.user', true));

-- ── Datenfunktionen (SECURITY DEFINER, Eigentümer stackr_app, Aufrufer service_role) ──
-- Rolle des Nutzers in der Firma: 'owner' | 'stb_lesen' | null. Auch für api/shopify-install.js.
create or replace function firma_rolle(p_user text, p_company text)
returns text language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_rolle text;
begin
    perform set_config('stackr.user', p_user, true);
    select m.rolle into v_rolle from company_members m
     where m.company_id = p_company and m.user_id = p_user and m.revoked_at is null;
    return v_rolle;
end $$;

-- Firmen des Nutzers mit Rolle und aktueller Änderungsnummer.
create or replace function firmen_lesen(p_user text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v jsonb;
begin
    perform set_config('stackr.user', p_user, true);
    select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'rechtsform', c.rechtsform, 'land', c.land,
               'rolle', m.rolle, 'seq', c.change_seq, 'created_at', c.created_at) order by c.created_at), '[]'::jsonb)
      into v
      from companies c join company_members m on m.company_id = c.id
     where m.user_id = p_user and m.revoked_at is null and c.deleted_at is null;
    return v;
end $$;

-- Firma anlegen, Aufrufer wird owner. Erneuter Aufruf durch denselben Owner: 'vorhanden'
-- (Wiederholung nach Netzfehler). Gehört die ID schon jemand anderem: Fehler 42501.
create or replace function firma_anlegen(p_user text, p_company text, p_name text, p_rechtsform text, p_land text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
    perform set_config('stackr.user', p_user, true);
    if coalesce(p_user, '') = '' then
        raise exception using errcode = '22023', message = 'p_user fehlt';
    end if;
    begin
        insert into companies (id, name, rechtsform, land, created_by)
        values (p_company, coalesce(p_name, ''), p_rechtsform, coalesce(nullif(p_land, ''), 'DE'), p_user);
    exception when unique_violation then
        if ist_owner(p_company) then
            return jsonb_build_object('status', 'vorhanden');
        end if;
        raise exception using errcode = '42501', message = 'Firma gehoert einem anderen Nutzer';
    end;
    insert into company_members (company_id, user_id, rolle) values (p_company, p_user, 'owner');
    insert into audit_log (company_id, aktion, art, entity_id, neu)
    values (p_company, 'firma_anlegen', 'company', p_company,
            jsonb_build_object('name', coalesce(p_name, ''), 'rechtsform', p_rechtsform, 'land', coalesce(nullif(p_land, ''), 'DE')));
    return jsonb_build_object('status', 'angelegt');
end $$;

-- Datensatz anlegen, ändern oder als gelöscht markieren.
--   p_version  erwartete Version; null = Datensatz darf noch nicht existieren
--   p_kreis    Nummernkreis: bei Neuanlage ohne p_nummer wird dort lückenlos gezogen
-- Rückgabe { status: 'ok', version, seq, nummer }
--        | { status: 'konflikt', version, data }   (Version passt nicht → 409, Server-Stand)
--        | { status: 'doppelt', id }               (quelle schon vergeben, z. B. Shopify-Bestellung)
--        | { status: 'gesperrt', grund }           (GoBD-Trigger)
-- Kein Schreibrecht (kein owner, Firma gelöscht): Fehler 42501.
create or replace function datensatz_schreiben(
    p_user text, p_company text, p_art text, p_id text, p_data jsonb, p_version integer,
    p_datum date, p_nummer text, p_quelle text, p_gesperrt_grund text, p_geloescht boolean, p_kreis text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
    v_alt    records%rowtype;
    v_da     boolean;
    v_seq    bigint;
    v_nummer text := p_nummer;
    v_aktion text;
    v_dup    text;
begin
    perform set_config('stackr.user', p_user, true);
    if coalesce(p_user, '') = '' or p_data is null then
        raise exception using errcode = '22023', message = 'p_user/p_data fehlt';
    end if;
    -- Änderungsnummer ziehen; sperrt die Firmenzeile. Nicht-Owner sehen die Zeile für UPDATE nicht.
    update companies set change_seq = change_seq + 1
     where id = p_company and deleted_at is null
     returning change_seq into v_seq;
    if v_seq is null then
        raise exception using errcode = '42501', message = 'kein Schreibrecht';
    end if;

    select * into v_alt from records r
     where r.company_id = p_company and r.art = p_art and r.id = p_id for update;
    v_da := found;
    if (v_da and p_version is distinct from v_alt.version) or (not v_da and p_version is not null) then
        return jsonb_build_object('status', 'konflikt',
            'version', case when v_da then v_alt.version end,
            'data',    case when v_da then v_alt.data end);
    end if;

    begin
        if not v_da then
            if v_nummer is null and p_kreis is not null then
                v_nummer := nummer_ziehen(p_company, p_kreis)::text;
            end if;
            insert into records (company_id, art, id, data, version, datum, nummer, quelle,
                                 gesperrt_grund, geloescht, seq, updated_by)
            values (p_company, p_art, p_id, p_data, 1, p_datum, v_nummer, p_quelle,
                    p_gesperrt_grund, coalesce(p_geloescht, false), v_seq, p_user);
            v_aktion := 'anlegen';
        else
            -- nummer und quelle bleiben, wenn einmal gesetzt
            v_nummer := coalesce(v_alt.nummer, v_nummer);
            update records set data = p_data, version = v_alt.version + 1, datum = p_datum,
                   nummer = v_nummer, quelle = coalesce(v_alt.quelle, p_quelle),
                   gesperrt_grund = coalesce(v_alt.gesperrt_grund, p_gesperrt_grund),
                   geloescht = coalesce(p_geloescht, false), seq = v_seq,
                   updated_at = now(), updated_by = p_user
             where company_id = p_company and art = p_art and id = p_id;
            v_aktion := case
                when coalesce(p_geloescht, false) and not v_alt.geloescht then 'loeschen'
                when v_alt.gesperrt_grund is null and p_gesperrt_grund is not null then 'sperren'
                else 'aendern' end;
        end if;
        insert into audit_log (company_id, aktion, art, entity_id, alt, neu, details)
        values (p_company, v_aktion, p_art, p_id,
                case when v_da then v_alt.data end, p_data,
                case when v_aktion = 'sperren' then p_gesperrt_grund end);
    exception
        when unique_violation then
            select r.id into v_dup from records r
             where r.company_id = p_company and r.art = p_art and r.quelle = p_quelle;
            return jsonb_build_object('status', 'doppelt', 'id', v_dup);
        when sqlstate 'SR001' then
            return jsonb_build_object('status', 'gesperrt', 'grund', sqlerrm);
    end;
    return jsonb_build_object('status', 'ok', 'version', case when v_da then v_alt.version + 1 else 1 end,
                              'seq', v_seq, 'nummer', v_nummer);
end $$;

-- Einstellung / Einzelobjekt schreiben (settings). Versionsprüfung wie datensatz_schreiben.
create or replace function einstellung_schreiben(p_user text, p_company text, p_key text, p_data jsonb, p_version integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
    v_alt settings%rowtype;
    v_da  boolean;
    v_seq bigint;
begin
    perform set_config('stackr.user', p_user, true);
    if coalesce(p_user, '') = '' or p_data is null then
        raise exception using errcode = '22023', message = 'p_user/p_data fehlt';
    end if;
    update companies set change_seq = change_seq + 1
     where id = p_company and deleted_at is null
     returning change_seq into v_seq;
    if v_seq is null then
        raise exception using errcode = '42501', message = 'kein Schreibrecht';
    end if;
    select * into v_alt from settings s where s.company_id = p_company and s.key = p_key for update;
    v_da := found;
    if (v_da and p_version is distinct from v_alt.version) or (not v_da and p_version is not null) then
        return jsonb_build_object('status', 'konflikt',
            'version', case when v_da then v_alt.version end,
            'data',    case when v_da then v_alt.data end);
    end if;
    insert into settings (company_id, key, data, version, seq, updated_by)
    values (p_company, p_key, p_data, 1, v_seq, p_user)
    on conflict (company_id, key) do update set
        data = excluded.data, version = settings.version + 1, seq = excluded.seq,
        updated_at = now(), updated_by = excluded.updated_by;
    insert into audit_log (company_id, aktion, art, entity_id, alt, neu)
    values (p_company, case when v_da then 'aendern' else 'anlegen' end, 'settings', p_key,
            case when v_da then v_alt.data end, p_data);
    return jsonb_build_object('status', 'ok', 'version', case when v_da then v_alt.version + 1 else 1 end, 'seq', v_seq);
end $$;

-- Ein Datensatz (auch gelöschte), oder null. Kein Mitglied: null (RLS).
create or replace function datensatz_lesen(p_user text, p_company text, p_art text, p_id text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v jsonb;
begin
    perform set_config('stackr.user', p_user, true);
    select jsonb_build_object('art', r.art, 'id', r.id, 'data', r.data, 'version', r.version,
               'datum', r.datum, 'nummer', r.nummer, 'quelle', r.quelle,
               'gesperrt_grund', r.gesperrt_grund, 'geloescht', r.geloescht, 'seq', r.seq)
      into v
      from records r where r.company_id = p_company and r.art = p_art and r.id = p_id;
    return v;
end $$;

-- Alles mit seq > p_seq aus records und settings, aufsteigend, höchstens p_limit (1–1000).
-- p_seq = 0 ist der Voll-Abzug. Jede Schreibung hat ihre eigene seq, Blättern über `bis` ist
-- deshalb lückenlos. Kein Mitglied: Fehler 42501.
-- Rückgabe { seq: aktueller Stand der Firma, bis: letzte gelieferte seq, mehr: bool, rows: [...] }
create or replace function aenderungen_seit(p_user text, p_company text, p_seq bigint, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
    v_stand bigint;
    v_lim   integer := least(greatest(coalesce(p_limit, 500), 1), 1000);
    v_rows  jsonb;
    v_bis   bigint;
    v_n     integer;
begin
    perform set_config('stackr.user', p_user, true);
    select c.change_seq into v_stand from companies c where c.id = p_company and ist_mitglied(c.id);
    if v_stand is null then
        raise exception using errcode = '42501', message = 'kein Zugriff';
    end if;
    with alle as (
        select r.seq, jsonb_build_object('t', 'r', 'art', r.art, 'id', r.id, 'data', r.data,
                   'version', r.version, 'datum', r.datum, 'nummer', r.nummer, 'quelle', r.quelle,
                   'gesperrt_grund', r.gesperrt_grund, 'geloescht', r.geloescht, 'seq', r.seq) as z
          from records r where r.company_id = p_company and r.seq > coalesce(p_seq, 0)
        union all
        select s.seq, jsonb_build_object('t', 's', 'key', s.key, 'data', s.data,
                   'version', s.version, 'seq', s.seq)
          from settings s where s.company_id = p_company and s.seq > coalesce(p_seq, 0)
    ), seite as (
        select * from alle order by seq limit v_lim + 1
    )
    select coalesce(jsonb_agg(z order by seq) filter (where rn <= v_lim), '[]'::jsonb),
           max(seq) filter (where rn <= v_lim), count(*)
      into v_rows, v_bis, v_n
      from (select seite.*, row_number() over (order by seq) as rn from seite) x;
    return jsonb_build_object('seq', v_stand, 'bis', coalesce(v_bis, p_seq, 0),
                              'mehr', v_n > v_lim, 'rows', v_rows);
end $$;

-- Umzug (R5): Audit-Einträge aus dem Browser übernehmen, in Stücken und wiederholbar.
-- p_eintraege = Originaltexte der Einträge (JSON-Strings, wie im Browser-Log gespeichert),
-- in Browser-Reihenfolge. Schon übernommene IDs werden übersprungen. Nur Owner.
-- Rückgabe: Zahl neu übernommener Einträge.
create or replace function audit_uebernehmen(p_user text, p_company text, p_eintraege text[])
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
    v_roh text;
    v_e   jsonb;
    v_n   integer := 0;
begin
    perform set_config('stackr.user', p_user, true);
    if not ist_owner(p_company) then
        raise exception using errcode = '42501', message = 'kein Schreibrecht';
    end if;
    foreach v_roh in array coalesce(p_eintraege, '{}'::text[]) loop
        v_e := v_roh::jsonb;
        if jsonb_typeof(v_e) <> 'object' or coalesce(v_e->>'id', '') = '' then
            raise exception using errcode = '22023', message = 'Audit-Eintrag ohne id';
        end if;
        if exists (select 1 from audit_log a where a.company_id = p_company
                      and a.aktion = 'browser_audit' and a.entity_id = v_e->>'id') then
            continue;
        end if;
        insert into audit_log (company_id, aktion, art, entity_id, neu, details)
        values (p_company, 'browser_audit', v_e->>'entityType', v_e->>'id', v_e, v_roh);
        v_n := v_n + 1;
    end loop;
    return v_n;
end $$;

-- Shopify-Integrationen der Firma für die Oberfläche (Stufe 3). Nie der Token.
create or replace function shopify_status(p_user text, p_company text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v jsonb;
begin
    perform set_config('stackr.user', p_user, true);
    if not ist_mitglied(p_company) then
        raise exception using errcode = '42501', message = 'kein Zugriff';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
               'shop', i.shop, 'status', i.status, 'installiert_am', i.installiert_am,
               'deinstalliert_am', i.deinstalliert_am, 'import_laeuft', i.import_cursor is not null,
               'eingang', (select coalesce(jsonb_object_agg(x.status, x.n), '{}'::jsonb)
                             from (select e.status, count(e.shop) as n from shopify_eingang e
                                    where e.shop = i.shop group by e.status) x)
           ) order by i.installiert_am), '[]'::jsonb)
      into v
      from integrations i where i.company_id = p_company;
    return v;
end $$;

-- ── Whop-Identitäts-Cache (api/_auth.js, R3) — wie die bisherigen sync_*-Funktionen ──
create or replace function sync_auth_cache_get(p_hash text)
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select jsonb_build_object('user_id', user_id, 'pro', pro)
      from auth_cache where token_hash = p_hash and expires_at > now()
$$;

create or replace function sync_auth_cache_put(p_hash text, p_user text, p_pro boolean, p_ttl integer)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
    insert into auth_cache (token_hash, user_id, pro, expires_at)
    values (p_hash, p_user, p_pro, now() + make_interval(secs => p_ttl))
    on conflict (token_hash) do update set user_id = excluded.user_id, pro = excluded.pro,
        expires_at = excluded.expires_at;
    if random() < 0.01 then
        delete from auth_cache where expires_at <= now();
    end if;
end $$;

-- ── Shopify einhängen (20261022000001_shopify.sql bleibt unverändert) ──────────
alter table shopify_eingang add column if not exists gebucht jsonb;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'integrations_company_fk') then
        alter table integrations add constraint integrations_company_fk
            foreign key (company_id) references companies (id) on delete cascade not valid;
    end if;
    -- validate erst, wenn jede Integration eine Firma hat (Backfill der Firmen, R5)
    if exists (select 1 from pg_constraint where conname = 'integrations_company_fk' and not convalidated) then
        if not exists (select 1 from integrations i where not exists (select 1 from companies c where c.id = i.company_id)) then
            alter table integrations validate constraint integrations_company_fk;
        else
            raise notice 'integrations_company_fk noch nicht validiert: Integrationen ohne Firma. Nach dem Backfill: alter table integrations validate constraint integrations_company_fk;';
        end if;
    end if;
end $$;

-- Gleiche Signatur wie in 20261022000001_shopify.sql, zusätzlich Owner-Prüfung.
create or replace function sync_shopify_integration_speichern(
    p_shop text, p_user text, p_company text, p_token text, p_scopes text)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
    if firma_rolle(p_user, p_company) is distinct from 'owner' then
        raise exception using errcode = '42501', message = 'Shopify: Nutzer ist nicht Owner der Firma';
    end if;
    insert into integrations (shop, user_id, company_id, token_chiffrat, scopes, status, installiert_am, deinstalliert_am, import_cursor)
    values (p_shop, p_user, p_company, p_token, p_scopes, 'aktiv', now(), null, null)
    on conflict (shop) do update set
        user_id = excluded.user_id, company_id = excluded.company_id,
        token_chiffrat = excluded.token_chiffrat, scopes = excluded.scopes,
        status = 'aktiv', installiert_am = now(), deinstalliert_am = null, import_cursor = null;
end $$;

-- shopify_status liest als stackr_app: nur Lesen, nur Spalten ohne Token, nur eigene Firmen.
-- Webhook und Adapter laufen weiter als service_role über die sync_shopify_*-Funktionen.
drop policy if exists integrations_status    on integrations;
drop policy if exists shopify_eingang_status on shopify_eingang;
create policy integrations_status    on integrations    for select to stackr_app
    using (ist_mitglied(company_id));
create policy shopify_eingang_status on shopify_eingang for select to stackr_app
    using (exists (select 1 from integrations i where i.shop = shopify_eingang.shop));

-- ── Eigentümer ──────────────────────────────────────────────────────────────────
alter function ist_mitglied(text)                     owner to stackr_app;
alter function ist_owner(text)                        owner to stackr_app;
alter function periode_festgeschrieben(text, date)    owner to stackr_app;
alter function nummer_ziehen(text, text)              owner to stackr_app;
alter function audit_log_verketten()                  owner to stackr_app;
alter function audit_log_unveraenderlich()            owner to stackr_app;
alter function records_gobd_sperre()                  owner to stackr_app;
alter function firma_rolle(text, text)                owner to stackr_app;
alter function firmen_lesen(text)                     owner to stackr_app;
alter function firma_anlegen(text, text, text, text, text) owner to stackr_app;
alter function datensatz_schreiben(text, text, text, text, jsonb, integer, date, text, text, text, boolean, text) owner to stackr_app;
alter function einstellung_schreiben(text, text, text, jsonb, integer) owner to stackr_app;
alter function datensatz_lesen(text, text, text, text) owner to stackr_app;
alter function aenderungen_seit(text, text, bigint, integer) owner to stackr_app;
alter function shopify_status(text, text)             owner to stackr_app;
alter function audit_uebernehmen(text, text, text[])  owner to stackr_app;

-- ── Rechte ──────────────────────────────────────────────────────────────────────
-- Datentabellen: niemand außer stackr_app, auch service_role nicht.
revoke all on companies, company_members, records, settings, nummernkreise, perioden,
              audit_log, anhaenge, user_prefs
  from public, anon, authenticated, service_role;
revoke all on sequence audit_log_seq_seq from public, anon, authenticated, service_role;

grant select, insert, update         on table companies       to stackr_app;
grant select, insert                 on table company_members to stackr_app;
grant select, insert, update, delete on table records         to stackr_app;
grant select, insert, update, delete on table settings        to stackr_app;
grant select, insert, update         on table nummernkreise   to stackr_app;
grant select, insert, update         on table perioden        to stackr_app;
grant select, insert                 on table audit_log       to stackr_app;
grant select, insert, update, delete on table anhaenge        to stackr_app;
grant select, insert, update, delete on table user_prefs      to stackr_app;
grant usage on sequence audit_log_seq_seq to stackr_app;
grant select (shop, company_id, status, installiert_am, deinstalliert_am, import_cursor) on integrations to stackr_app;
grant select (shop, status) on shopify_eingang to stackr_app;

-- auth_cache: Hilfstabelle wie whop_sessions (service_role über sync_auth_cache_*)
revoke all on auth_cache from public, anon, authenticated;
grant select, insert, update, delete on table auth_cache to service_role;

-- Funktionen: Supabase gibt neuen Funktionen in public per Default EXECUTE für alle Rollen.
revoke all on function ist_mitglied(text)                  from public, anon, authenticated, service_role;
revoke all on function ist_owner(text)                     from public, anon, authenticated, service_role;
revoke all on function periode_festgeschrieben(text, date) from public, anon, authenticated, service_role;
revoke all on function nummer_ziehen(text, text)           from public, anon, authenticated, service_role;
revoke all on function audit_log_verketten()               from public, anon, authenticated, service_role;
revoke all on function audit_log_unveraenderlich()         from public, anon, authenticated, service_role;
revoke all on function records_gobd_sperre()               from public, anon, authenticated, service_role;
revoke all on function firma_rolle(text, text)             from public, anon, authenticated;
revoke all on function firmen_lesen(text)                  from public, anon, authenticated;
revoke all on function firma_anlegen(text, text, text, text, text) from public, anon, authenticated;
revoke all on function datensatz_schreiben(text, text, text, text, jsonb, integer, date, text, text, text, boolean, text) from public, anon, authenticated;
revoke all on function einstellung_schreiben(text, text, text, jsonb, integer) from public, anon, authenticated;
revoke all on function datensatz_lesen(text, text, text, text) from public, anon, authenticated;
revoke all on function aenderungen_seit(text, text, bigint, integer) from public, anon, authenticated;
revoke all on function shopify_status(text, text)          from public, anon, authenticated;
revoke all on function audit_uebernehmen(text, text, text[]) from public, anon, authenticated;
revoke all on function sync_auth_cache_get(text)           from public, anon, authenticated;
revoke all on function sync_auth_cache_put(text, text, boolean, integer) from public, anon, authenticated;

-- intern (Policies, Trigger, nummer_ziehen aus datensatz_schreiben): nur stackr_app
grant execute on function ist_mitglied(text)                  to stackr_app;
grant execute on function ist_owner(text)                     to stackr_app;
grant execute on function periode_festgeschrieben(text, date) to stackr_app;
grant execute on function nummer_ziehen(text, text)           to stackr_app;
grant execute on function audit_log_verketten()               to stackr_app;
grant execute on function audit_log_unveraenderlich()         to stackr_app;
grant execute on function records_gobd_sperre()               to stackr_app;
-- extern (api/ mit Service-Key)
grant execute on function firma_rolle(text, text)             to service_role;
grant execute on function firmen_lesen(text)                  to service_role;
grant execute on function firma_anlegen(text, text, text, text, text) to service_role;
grant execute on function datensatz_schreiben(text, text, text, text, jsonb, integer, date, text, text, text, boolean, text) to service_role;
grant execute on function einstellung_schreiben(text, text, text, jsonb, integer) to service_role;
grant execute on function datensatz_lesen(text, text, text, text) to service_role;
grant execute on function aenderungen_seit(text, text, bigint, integer) to service_role;
grant execute on function shopify_status(text, text)          to service_role;
grant execute on function audit_uebernehmen(text, text, text[]) to service_role;
grant execute on function sync_auth_cache_get(text)           to service_role;
grant execute on function sync_auth_cache_put(text, text, boolean, integer) to service_role;
