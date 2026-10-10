-- Stackr — Tabellenrechte für service_role
-- =============================================================================
-- In BEIDEN Projekten ausführen (erst stackr-preview, dann stackr-prod). Wiederholbar:
-- ein zweites GRANT ändert nichts.
--
-- Anlass: Supabase vergibt für neue Tabellen in public keine Data-API-Rechte mehr
-- automatisch, für neue Projekte schon jetzt, für bestehende ab 30.10.2026. Beide
-- Stackr-Projekte sind vom 07.10. und fallen schon darunter. Am 2026-10-10 hatte
-- service_role dort auf keiner der 13 Tabellen SELECT/INSERT/UPDATE/DELETE und auf
-- keiner Sequenz USAGE. Gegenprobe in stackr-preview:
--   set local role service_role; select sync_get('x', 'y');
--   → ERROR 42501: permission denied for table sync_snapshots
--
-- Die sync_*-Funktionen laufen bewusst als SECURITY INVOKER (siehe
-- test/test-migration-rechte.js), also mit den Rechten von service_role. Ohne diese
-- Rechte scheitert jeder Aufruf, sobald SYNC_BACKEND/BLOB_BACKEND auf supabase steht.
--
-- anon und authenticated bleiben gesperrt (revoke in den jeweiligen Migrationen).
-- TRUNCATE, REFERENCES und TRIGGER braucht keine Funktion und bekommt service_role nicht.
-- Neue Tabellen bringen ihr GRANT in derselben Migration mit
-- (test/test-migration-tabellenrechte.js).

grant select, insert, update, delete on table
    sync_snapshots, sync_scopes, sync_anchors, public_keys, grants, rate_limits,
    client_error_counts, client_error_types,
    whop_sessions, whop_session_locks,
    counters, locks,
    ops_alerts
to service_role;

grant usage, select on sequence sync_anchors_seq_seq, ops_alerts_id_seq to service_role;
