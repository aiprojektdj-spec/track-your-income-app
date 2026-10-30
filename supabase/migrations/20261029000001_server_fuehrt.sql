-- Stackr — Server führt, je Firma umschaltbar (Schritt R6 aus plan/server-umbau-2026-10-22.md, P2)
-- =============================================================================
-- Braucht 20261022000002_server_datenmodell.sql. Erst im Testprojekt (User), prod zum Livegang.
-- Wiederholbar.
--
-- companies.server_fuehrt: false = Browser führt (P1, Server spiegelt nur), true = Server führt
-- (P2: der Browser holt Änderungen anderer Geräte, bei Konflikt gilt der Server-Stand, der alte
-- Cloud-Sync ruht für die Firma). Gilt geräteübergreifend, deshalb in der Datenbank.
--
-- firma_modus(p_user, p_company, p_server_fuehrt)
--   p_server_fuehrt null  → nur lesen (Mitglied)        → { server_fuehrt }
--   true / false          → umschalten (nur Owner), mit Audit-Eintrag 'modus'
-- Kein Mitglied bzw. kein Owner beim Umschalten: Fehler 42501.
--
-- Prüfung statisch: test/test-server-data.js.
-- =============================================================================

alter table companies add column if not exists server_fuehrt boolean not null default false;

create or replace function firma_modus(p_user text, p_company text, p_server_fuehrt boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v boolean;
begin
    perform set_config('stackr.user', p_user, true);
    if p_server_fuehrt is not null then
        if not ist_owner(p_company) then
            raise exception using errcode = '42501', message = 'kein Schreibrecht';
        end if;
        update companies set server_fuehrt = p_server_fuehrt
         where id = p_company and server_fuehrt is distinct from p_server_fuehrt;
        if found then
            insert into audit_log (company_id, aktion, art, entity_id, details)
            values (p_company, 'modus', 'company', p_company,
                    case when p_server_fuehrt then 'Server führt' else 'Browser führt' end);
        end if;
    end if;
    select c.server_fuehrt into v from companies c where c.id = p_company and ist_mitglied(c.id);
    if v is null then
        raise exception using errcode = '42501', message = 'kein Zugriff';
    end if;
    return jsonb_build_object('server_fuehrt', v);
end $$;

-- ── Eigentümer ──────────────────────────────────────────────────────────────────
alter function firma_modus(text, text, boolean) owner to stackr_app;

-- ── Rechte ──────────────────────────────────────────────────────────────────────
revoke all on function firma_modus(text, text, boolean) from public, anon, authenticated;
grant execute on function firma_modus(text, text, boolean) to service_role;
