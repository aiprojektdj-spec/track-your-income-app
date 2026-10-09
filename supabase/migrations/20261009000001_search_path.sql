-- Stackr — feste search_path für alle sync_*-Funktionen
-- =============================================================================
-- In BEIDEN Projekten ausführen. Wiederholbar (ALTER setzt nur den Wert neu).
--
-- Anlass: Der Supabase-Security-Advisor meldete am 2026-10-08 für alle 32 sync_*-Funktionen
-- "function_search_path_mutable". Ohne feste search_path löst eine Funktion unqualifizierte
-- Namen (sync_snapshots, …) über den search_path des AUFRUFERS auf — wer ein gleichnamiges
-- Objekt in ein früher durchsuchtes Schema legen kann, schiebt der Funktion seine Tabelle
-- unter. Ausnutzbar ist das hier kaum (nur service_role darf die Funktionen ausführen, keine
-- ist SECURITY DEFINER), aber die Härtung kostet nichts.
--
-- 'public, pg_temp' statt '': die Funktionskörper benutzen unqualifizierte Tabellennamen.
-- pg_temp ausdrücklich ans Ende, sonst stünde es implizit VOR public.
--
-- Bewusst NICHT angefasst: public.rls_auto_enable() — keine Stackr-Funktion, sondern vom
-- Supabase-Dashboard angelegt (RLS automatisch einschalten).
do $$
declare f record;
begin
    for f in select p.oid::regprocedure as sig
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname like 'sync\_%'
    loop
        execute format('alter function %s set search_path = public, pg_temp', f.sig);
    end loop;
end $$;
