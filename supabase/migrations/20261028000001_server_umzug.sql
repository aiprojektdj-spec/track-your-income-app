-- Stackr — Umzug in die Stackr-Cloud (Schritt R5 aus plan/server-umbau-2026-10-22.md, Abschnitt 3)
-- =============================================================================
-- Braucht 20261022000002_server_datenmodell.sql (Rolle stackr_app, audit_log, ist_owner).
-- Erst in einem Testprojekt ausführen (User), prod erst zum Livegang (R9). Wiederholbar.
--
-- Zwei Datenfunktionen nach RLS-Weg E-A (SECURITY DEFINER, Eigentümer stackr_app, erste
-- Anweisung set_config('stackr.user', p_user, true), Aufrufer nur service_role):
--   umzug_stand(p_user, p_company, p_mit_audit)
--       { umgezogen_am, audit: [Originaltexte der übernommenen Browser-Einträge] }
--       api/data.js prüft damit die Browser-Kette über ALLE Stücke hinweg aus der Datenbank,
--       nicht nur das zuletzt geschickte Stück.
--   umzug_abschliessen(p_user, p_company, p_details)
--       Audit-Eintrag „Datenübernahme aus Browser …“ (aktion 'datenuebernahme'), genau einmal je
--       Firma. Zweiter Aufruf: { status: 'vorhanden' }. Den Text setzt api/data.js
--       (Zahl der Datensätze, SHA-256 des Bundles, Kettenbefund).
-- Beide nur für den Owner, sonst Fehler 42501.
--
-- Prüfung statisch: test/test-server-data.js (Regeln wie test/test-server-datenmodell.js).
-- =============================================================================

create or replace function umzug_stand(p_user text, p_company text, p_mit_audit boolean)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
    v_am    timestamptz;
    v_texte jsonb;
begin
    perform set_config('stackr.user', p_user, true);
    if not ist_owner(p_company) then
        raise exception using errcode = '42501', message = 'kein Zugriff';
    end if;
    select min(a.ts) into v_am from audit_log a
     where a.company_id = p_company and a.aktion = 'datenuebernahme';
    if coalesce(p_mit_audit, false) then
        select coalesce(jsonb_agg(to_jsonb(a.details) order by a.seq), '[]'::jsonb) into v_texte
          from audit_log a where a.company_id = p_company and a.aktion = 'browser_audit';
    end if;
    return jsonb_build_object('umgezogen_am', v_am, 'audit', v_texte);
end $$;

create or replace function umzug_abschliessen(p_user text, p_company text, p_details text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
    perform set_config('stackr.user', p_user, true);
    if not ist_owner(p_company) then
        raise exception using errcode = '42501', message = 'kein Schreibrecht';
    end if;
    -- Zwei gleichzeitige Abschlüsse derselben Firma nacheinander
    perform pg_advisory_xact_lock(hashtext('stackr-umzug:' || p_company));
    if exists (select 1 from audit_log a where a.company_id = p_company and a.aktion = 'datenuebernahme') then
        return jsonb_build_object('status', 'vorhanden');
    end if;
    insert into audit_log (company_id, aktion, art, entity_id, details)
    values (p_company, 'datenuebernahme', 'company', p_company, p_details);
    return jsonb_build_object('status', 'ok');
end $$;

-- ── Eigentümer ──────────────────────────────────────────────────────────────────
alter function umzug_stand(text, text, boolean)    owner to stackr_app;
alter function umzug_abschliessen(text, text, text) owner to stackr_app;

-- ── Rechte ──────────────────────────────────────────────────────────────────────
revoke all on function umzug_stand(text, text, boolean)    from public, anon, authenticated;
revoke all on function umzug_abschliessen(text, text, text) from public, anon, authenticated;
grant execute on function umzug_stand(text, text, boolean)    to service_role;
grant execute on function umzug_abschliessen(text, text, text) to service_role;
