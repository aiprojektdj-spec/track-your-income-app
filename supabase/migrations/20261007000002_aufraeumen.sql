-- Stackr — Speicherfristen in Supabase verlässlich einhalten
-- =============================================================================
-- In BEIDEN Projekten ausführen, nach 20261007000001_client_errors.sql.
--
-- Warum: In Redis verfallen Rate-Limit-Zähler (Schlüssel enthält die IP) per EXPIRE nach
-- 60 s, Fehlerzähler nach 30 Tagen. Die ersten Migrationen räumten in Supabase nur bei
-- jedem hundertsten Aufruf auf, Rate-Limits zudem erst 1 h nach Ablauf — bei wenig
-- Verkehr hätte eine IP-Adresse so tagelang in rate_limits stehen können. Das passt nicht
-- zur Datenschutzerklärung (plan/rechtstexte-supabase-entwurf.md, F6).
--
-- Jetzt:
--   - sync_rate_hit löscht bei JEDEM Aufruf abgelaufene Zähler (höchstens 200 je Aufruf,
--     gesperrte Zeilen werden übersprungen, damit parallele Aufrufe nicht aufeinander warten).
--   - sync_aufraeumen() räumt beides vollständig; api/blob-cleanup.js ruft es täglich auf.
--     Damit gilt: IP-Zähler spätestens nach 24 h weg, Fehlerzähler nach 30 Tagen (+1 Tag).
-- =============================================================================

create index if not exists rate_limits_reset_at        on rate_limits (reset_at);
create index if not exists client_error_counts_day     on client_error_counts (day);
create index if not exists client_error_types_first_day on client_error_types (first_day);

create or replace function sync_rate_hit(p_key text, p_window integer)
returns integer language plpgsql as $$
declare n integer;
begin
    delete from rate_limits where key in (
        select key from rate_limits where reset_at <= now()
         limit 200 for update skip locked);

    insert into rate_limits as r (key, count, reset_at)
    values (p_key, 1, now() + make_interval(secs => p_window))
    on conflict (key) do update set
        count    = case when r.reset_at <= now() then 1 else r.count + 1 end,
        reset_at = case when r.reset_at <= now() then now() + make_interval(secs => p_window) else r.reset_at end
    returning count into n;
    return n;
end $$;

-- Täglicher Lauf (api/blob-cleanup.js). Rückgabe: Zahl der gelöschten Zeilen je Tabelle.
create or replace function sync_aufraeumen()
returns jsonb language plpgsql as $$
declare rl integer; cc integer; ct integer;
begin
    delete from rate_limits         where reset_at  <= now();             get diagnostics rl = row_count;
    delete from client_error_counts where day       <= current_date - 30; get diagnostics cc = row_count;
    delete from client_error_types  where first_day <= current_date - 30; get diagnostics ct = row_count;
    return jsonb_build_object('rate_limits', rl, 'clerr_counts', cc, 'clerr_types', ct);
end $$;

-- ── Rechte (wie 20261006000001_sync.sql) ─────────────────────────────────────────
-- create or replace behält die Rechte von sync_rate_hit; die neue Funktion braucht sie.
revoke all on function sync_aufraeumen() from public, anon, authenticated;
grant execute on function sync_aufraeumen() to service_role;
