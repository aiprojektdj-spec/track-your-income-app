-- Stackr — Löschfrist für den Shopify-Bestelleingang (plan/rechtsaudit-2026-10-24.md, B5)
-- =============================================================================
-- Nach 20261022000001_shopify.sql ausführen. Wiederholbar.
--
-- shopify_eingang hatte keine Frist: Zeilen blieben nach der Buchung für immer stehen, gelöscht
-- wurde nur auf customers/redact, shop/redact und bei Deinstallation. Nach der Buchung liegt der
-- Verkauf in records (Doppelimport-Schutz dort über quelle), der Eingang ist dann nur noch Verweis.
--
-- Frist: 90 Tage nach verarbeitet_am, nur Zeilen im Status 'verarbeitet'. 'neu', 'geladen' und
-- 'pruefen' bleiben, bis sie gebucht oder vom Nutzer geklärt sind — sonst ginge eine Bestellung
-- verloren, die noch nicht in den Büchern steht.
-- Annahme: 90 Tage (User-Freigabe 2026-10-26, Vorschlag aus dem Audit).
--
-- Aufrufer: täglicher Lauf in api/blob-cleanup.js, nur wenn Shopify konfiguriert ist.
-- =============================================================================

create or replace function sync_shopify_aufraeumen()
returns integer language plpgsql set search_path = public, pg_temp as $$
declare n integer;
begin
    delete from shopify_eingang
     where status = 'verarbeitet'
       and verarbeitet_am < now() - interval '90 days';
    get diagnostics n = row_count;
    return n;
end $$;

revoke all on function sync_shopify_aufraeumen() from public, anon, authenticated;
grant execute on function sync_shopify_aufraeumen() to service_role;
