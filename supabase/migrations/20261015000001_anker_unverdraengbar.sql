-- Stackr — Audit-Anker unverdrängbar (Audit 2026-10-13, S3)
-- =============================================================================
-- In BEIDEN Projekten ausführen (erst stackr-preview, dann stackr-prod). Wiederholbar.
-- api/_sync-store.js ruft ab dieser Fassung sync_append_anchors_v2 auf; die alte Funktion
-- sync_append_anchors bleibt unangetastet liegen (vorhandene Migrationen werden nicht
-- umgeschrieben) und wird nicht mehr benutzt.
--
-- Vorher: jeder Aufruf hängte an und LÖSCHTE danach alles außer den neuesten p_max Einträgen.
-- 20 Anfragen à 1.000 Fülleinträge verdrängten so den ersten echten Anker — der Gegenbeweis
-- gegen ein später manipuliertes Protokoll war weg. Eine bereits gesehene Event-ID mit anderem
-- Hash ersetzte nichts, stand aber als zweiter Wert daneben.
--
-- Jetzt:
--  - nichts wird mehr gelöscht;
--  - eine Event-ID ist je Owner+Scope einmalig: gleiche ID + gleicher Hash = idempotent
--    (übersprungen), gleiche ID + anderer Hash = Konflikt, NICHTS wird geschrieben;
--  - Kapazität je Scope (p_max) und je Nutzer über alle Scopes (p_max_user) wird VOR dem
--    Schreiben geprüft; ist sie erschöpft, kommt status 'capacity' zurück, statt alte
--    Beweise zu verdrängen. Archivierung gibt es (noch) nicht — siehe plan/01-AUFGABEN.md.
--  - Kontolöschung (sync.js delete/reset_all) lässt die Anker weiter stehen; das ist die
--    bestehende Entscheidung (Art. 17 Abs. 3 lit. b DSGVO i. V. m. §147 AO, datenschutz.html 6.1).
--
-- Vorhandene, früher bereits verdrängte Anker lassen sich nicht rekonstruieren; die App zeigt
-- lokal als verankert gemerkte Einträge ohne Server-Anker deshalb ausdrücklich als
-- "nicht mehr extern belegt" (js/cloud-sync.js verifyAuditAnchors).
-- =============================================================================

create index if not exists sync_anchors_entry on sync_anchors (user_id, scope, entry_id);

create or replace function sync_append_anchors_v2(p_user text, p_scope text, p_rows jsonb, p_max integer, p_max_user integer)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
    v_konflikt jsonb;
    v_neu      integer;
    v_scope    integer;
    v_user     integer;
begin
    -- Parallele Anfragen desselben Nutzers nacheinander (Kapazität und Einmaligkeit)
    perform pg_advisory_xact_lock(hashtext('stackr-anchor:' || p_user));

    -- Widerspruch innerhalb der Anfrage oder gegen den Bestand
    with rein as (
        select r->>'id' as id, r->>'h' as h from jsonb_array_elements(p_rows) as t(r)
    )
    select coalesce(jsonb_agg(distinct x.id), '[]'::jsonb) into v_konflikt from (
        select id from rein group by id having count(distinct h) > 1
        union
        select n.id from rein n
          join sync_anchors a on a.user_id = p_user and a.scope = p_scope and a.entry_id = n.id and a.h <> n.h
    ) x;
    if jsonb_array_length(v_konflikt) > 0 then
        return jsonb_build_object('status', 'conflict', 'ids', v_konflikt);
    end if;

    -- Neu sind nur IDs, die es im Bestand noch nicht gibt (gleicher Hash = idempotent)
    select count(distinct r->>'id') into v_neu
      from jsonb_array_elements(p_rows) as t(r)
     where not exists (select 1 from sync_anchors a
                        where a.user_id = p_user and a.scope = p_scope and a.entry_id = r->>'id');
    if v_neu = 0 then
        return jsonb_build_object('status', 'ok', 'added', 0);
    end if;

    select count(*) into v_scope from sync_anchors where user_id = p_user and scope = p_scope;
    select count(*) into v_user  from sync_anchors where user_id = p_user;
    if v_scope + v_neu > p_max or v_user + v_neu > p_max_user then
        return jsonb_build_object('status', 'capacity', 'scope', v_scope, 'user', v_user);
    end if;

    insert into sync_anchors (user_id, scope, entry_id, h, ts)
    select p_user, p_scope, n.id, n.h, n.ts
      from (select distinct on (r->>'id') r->>'id' as id, r->>'h' as h, (r->>'ts')::bigint as ts, t.i
              from jsonb_array_elements(p_rows) with ordinality as t(r, i)
             order by r->>'id', t.i) n
     where not exists (select 1 from sync_anchors a
                        where a.user_id = p_user and a.scope = p_scope and a.entry_id = n.id)
     order by n.i;
    return jsonb_build_object('status', 'ok', 'added', v_neu);
end $$;

revoke all on function sync_append_anchors_v2(text, text, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function sync_append_anchors_v2(text, text, jsonb, integer, integer) to service_role;
