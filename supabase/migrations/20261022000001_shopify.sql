-- Stackr — Shopify-Connector: Installationen und Bestell-Eingang
-- (api/shopify-install.js, api/shopify-callback.js, api/shopify-webhook.js, Helfer api/_shopify.js)
-- =============================================================================
-- In BEIDEN Projekten ausführen (erst stackr-preview, dann stackr-prod). Wiederholbar.
--
-- integrations: eine Zeile pro Shop (ein Shop gehört genau einer Stackr-Firma). Der
--   Offline-Token liegt nur als Chiffrat (AES-256-GCM, Schlüssel SHOPIFY_TOKEN_KEY, Shop als AAD,
--   nur in api/_shopify.js) — die Datenbank sieht nie einen Shopify-Token.
--   company_id ist die Stackr-Firmen-ID ("co_…") aus dem Browser; der Server kann sie heute
--   nicht gegen eigene Firmendaten prüfen (die liegen noch im Browser), sie gilt nur innerhalb
--   des Whop-Nutzers user_id.
--   import_cursor: Fortsetzung des Erstimports (GraphQL endCursor), '*' = von vorn,
--   null = fertig.
--
-- shopify_eingang: eine Zeile pro Bestellung (shop + order_id), idempotent per Upsert.
--   payload ist NICHT der Webhook-Inhalt (der trägt Namen, E-Mail, Anschriften), sondern
--   { order, gebuehr } aus ShopifyBuchung.ausGraphQL — nur Buchungsfelder und Lieferland.
--   status: 'neu'        Webhook gemeldet, Bestellung noch nicht geladen (payload evtl. alt/leer)
--           'geladen'    payload aktuell, noch nicht gebucht
--           'verarbeitet' gebucht (Stufe 2, Server-Adapter)
--           'pruefen'    Kern hat Gründe gemeldet (gruende)
--   Löschen: shop/redact → ganze Integration samt Eingang (on delete cascade),
--            customers/redact → die genannten Bestellungen.
--
-- Zugriff ausschließlich api/ mit dem Service-Key: RLS an, keine Policy, anon/authenticated
-- ohne Tabellen- und Funktionsrechte (wie 20261008000001_whop_sessions.sql).
-- =============================================================================

create table if not exists integrations (
    shop             text        primary key,
    user_id          text        not null,
    company_id       text        not null,
    token_chiffrat   text,
    scopes           text        not null default '',
    status           text        not null default 'aktiv' check (status in ('aktiv', 'deinstalliert')),
    installiert_am   timestamptz not null default now(),
    deinstalliert_am timestamptz,
    import_cursor    text
);
create index if not exists integrations_user on integrations (user_id);

create table if not exists shopify_eingang (
    shop           text        not null references integrations (shop) on delete cascade,
    order_id       text        not null,
    payload        jsonb,
    empfangen_am   timestamptz not null default now(),
    verarbeitet_am timestamptz,
    status         text        not null default 'neu' check (status in ('neu', 'geladen', 'verarbeitet', 'pruefen')),
    gruende        jsonb,
    primary key (shop, order_id)
);
create index if not exists shopify_eingang_offen on shopify_eingang (shop, status);

alter table integrations    enable row level security;
alter table shopify_eingang enable row level security;

-- Callback: Installation anlegen oder erneuern. Ein erneut installierter Shop wechselt zum
-- Nutzer, der die Freigabe in Shopify erteilt hat (nur ein Shop-Admin kommt bis hierher).
create or replace function sync_shopify_integration_speichern(
    p_shop text, p_user text, p_company text, p_token text, p_scopes text)
returns void language sql set search_path = public, pg_temp as $$
    insert into integrations (shop, user_id, company_id, token_chiffrat, scopes, status, installiert_am, deinstalliert_am, import_cursor)
    values (p_shop, p_user, p_company, p_token, p_scopes, 'aktiv', now(), null, null)
    on conflict (shop) do update set
        user_id = excluded.user_id, company_id = excluded.company_id,
        token_chiffrat = excluded.token_chiffrat, scopes = excluded.scopes,
        status = 'aktiv', installiert_am = now(), deinstalliert_am = null, import_cursor = null
$$;

-- Token-Chiffrat eines aktiven Shops, sonst null
create or replace function sync_shopify_token(p_shop text)
returns text language sql stable set search_path = public, pg_temp as $$
    select token_chiffrat from integrations where shop = p_shop and status = 'aktiv'
$$;

-- app/uninstalled: Token weg, Eingang bleibt bis shop/redact (Shopify schickt es 48 h später)
create or replace function sync_shopify_integration_beenden(p_shop text)
returns void language sql set search_path = public, pg_temp as $$
    update integrations set token_chiffrat = null, status = 'deinstalliert',
        deinstalliert_am = now(), import_cursor = null
     where shop = p_shop
$$;

-- shop/redact: alles zum Shop löschen (Eingang per cascade). Rückgabe: gelöschte Eingangszeilen.
create or replace function sync_shopify_shop_loeschen(p_shop text)
returns integer language plpgsql set search_path = public, pg_temp as $$
declare n integer;
begin
    delete from shopify_eingang where shop = p_shop; get diagnostics n = row_count;
    delete from integrations    where shop = p_shop;
    return n;
end $$;

-- customers/redact: die genannten Bestellungen löschen. Rückgabe: Zahl der gelöschten Zeilen.
create or replace function sync_shopify_bestellungen_loeschen(p_shop text, p_order_ids text[])
returns integer language plpgsql set search_path = public, pg_temp as $$
declare n integer;
begin
    delete from shopify_eingang where shop = p_shop and order_id = any (p_order_ids);
    get diagnostics n = row_count;
    return n;
end $$;

-- Webhook: Bestellung als 'neu' vormerken (nur für aktive Shops). true = vorgemerkt.
create or replace function sync_shopify_eingang_melden(p_shop text, p_order_id text)
returns boolean language plpgsql set search_path = public, pg_temp as $$
declare n integer;
begin
    insert into shopify_eingang (shop, order_id, status, empfangen_am)
    select p_shop, p_order_id, 'neu', now()
      from integrations where shop = p_shop and status = 'aktiv'
    on conflict (shop, order_id) do update set status = 'neu', empfangen_am = now();
    get diagnostics n = row_count;
    return n = 1;
end $$;

-- Geladene Bestellungen speichern: p_eintraege = [{ "order_id": "…", "payload": {…} }, …].
-- Nur für aktive Shops. Eine schon gebuchte Bestellung, die sich geändert hat (z. B. Erstattung),
-- geht zurück auf 'geladen'; den Doppelimport verhindert der Adapter über Verkauf.quelle.
-- Rückgabe: Zahl der gespeicherten Zeilen.
create or replace function sync_shopify_eingang_speichern(p_shop text, p_eintraege jsonb)
returns integer language plpgsql set search_path = public, pg_temp as $$
declare n integer;
begin
    if not exists (select 1 from integrations where shop = p_shop and status = 'aktiv') then
        return 0;
    end if;
    insert into shopify_eingang (shop, order_id, payload, status, empfangen_am, gruende)
    select p_shop, e->>'order_id', e->'payload', 'geladen', now(), null
      from jsonb_array_elements(p_eintraege) e
     where coalesce(e->>'order_id', '') <> ''
    on conflict (shop, order_id) do update set
        payload = excluded.payload, status = 'geladen', empfangen_am = now(), gruende = null;
    get diagnostics n = row_count;
    return n;
end $$;

-- Erstimport: Cursor der nächsten Seite merken (null = fertig)
create or replace function sync_shopify_import_cursor(p_shop text, p_cursor text)
returns void language sql set search_path = public, pg_temp as $$
    update integrations set import_cursor = p_cursor where shop = p_shop and status = 'aktiv'
$$;

-- ── Rechte (wie 20261008000001_whop_sessions.sql) ────────────────────────────────
grant select, insert, update, delete on table integrations, shopify_eingang to service_role;
revoke all on integrations, shopify_eingang from public, anon, authenticated;
revoke all on function sync_shopify_integration_speichern(text, text, text, text, text) from public, anon, authenticated;
revoke all on function sync_shopify_token(text)                                         from public, anon, authenticated;
revoke all on function sync_shopify_integration_beenden(text)                           from public, anon, authenticated;
revoke all on function sync_shopify_shop_loeschen(text)                                 from public, anon, authenticated;
revoke all on function sync_shopify_bestellungen_loeschen(text, text[])                 from public, anon, authenticated;
revoke all on function sync_shopify_eingang_melden(text, text)                          from public, anon, authenticated;
revoke all on function sync_shopify_eingang_speichern(text, jsonb)                      from public, anon, authenticated;
revoke all on function sync_shopify_import_cursor(text, text)                           from public, anon, authenticated;
grant execute on function sync_shopify_integration_speichern(text, text, text, text, text) to service_role;
grant execute on function sync_shopify_token(text)                                         to service_role;
grant execute on function sync_shopify_integration_beenden(text)                           to service_role;
grant execute on function sync_shopify_shop_loeschen(text)                                 to service_role;
grant execute on function sync_shopify_bestellungen_loeschen(text, text[])                 to service_role;
grant execute on function sync_shopify_eingang_melden(text, text)                          to service_role;
grant execute on function sync_shopify_eingang_speichern(text, jsonb)                      to service_role;
grant execute on function sync_shopify_import_cursor(text, text)                           to service_role;
