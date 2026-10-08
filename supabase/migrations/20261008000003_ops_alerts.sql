-- Stackr — Alarm-Historie in Supabase (ersetzt 'stackr/alerts/' in Vercel Blob, api/_alert.js)
-- =============================================================================
-- In BEIDEN Projekten ausführen. Unabhängig von den anderen 20261008-Migrationen.
--
-- Entscheidung User 2026-10-07: das zweite Alarmziel neben dem Make-Webhook wird eine
-- Supabase-Tabelle, damit @vercel/blob nach dem Umzug ganz entfallen kann. Bewusste
-- Grenze: fällt Supabase selbst aus, landet DIESER Alarm nur im Webhook und im Log.
--
-- Aufbewahrung 30 Tage wie bisher im Blob-Präfix. Aufgeräumt wird beim Schreiben (höchstens
-- 200 Zeilen je Aufruf), nicht im täglichen Cron: Alarme ohne Nachfolger bleiben daher
-- liegen, bis der nächste Alarm kommt. Zusätzlich hält ein Deckel die Tabelle bei
-- höchstens 10.000 Zeilen, falls viele Instanzen gleichzeitig melden (die Entprellung in
-- _alert.js gilt nur je Instanz).
--
-- Inhalt: source/event sind Code-Literale, detail ist err.message (gekürzt, s. api/_log.js).
-- Keine IP, keine Nutzer-ID.
-- =============================================================================

create table if not exists ops_alerts (
    id     bigserial   primary key,
    ts     timestamptz not null default now(),
    source text        not null,
    event  text        not null,
    detail text        not null default '',
    env    text        not null default ''
);
create index if not exists ops_alerts_ts on ops_alerts (ts);

alter table ops_alerts enable row level security;

create or replace function sync_alert_add(p_source text, p_event text, p_detail text, p_env text)
returns void language plpgsql as $$
begin
    delete from ops_alerts where id in (
        select id from ops_alerts where ts < now() - interval '30 days'
         limit 200 for update skip locked);
    delete from ops_alerts where id <= (select max(id) from ops_alerts) - 10000;

    insert into ops_alerts (source, event, detail, env)
    values (left(coalesce(p_source, ''), 60), left(coalesce(p_event, ''), 60),
            left(coalesce(p_detail, ''), 500), left(coalesce(p_env, ''), 20));
end $$;

-- ── Rechte (wie 20261006000001_sync.sql) ─────────────────────────────────────────
revoke all on ops_alerts from public, anon, authenticated;
revoke all on sequence ops_alerts_id_seq from public, anon, authenticated;
revoke all on function sync_alert_add(text, text, text, text) from public, anon, authenticated;
grant execute on function sync_alert_add(text, text, text, text) to service_role;
