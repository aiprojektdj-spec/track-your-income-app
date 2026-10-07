-- Stackr — Browser-Fehlerzähler auf Supabase (ersetzt die clerr:*-Keys aus api/_client-errors.js)
-- =============================================================================
-- In BEIDEN Projekten ausführen, nach 20261006000001_sync.sql (braucht rate_limits /
-- sync_rate_hit für IP-Deckel und Tagesdeckel).
--
-- Abbildung der Redis-Keys:
--   clerr:d:<tag>     Hash typ → Anzahl         → client_error_counts (day, hash, count)
--   clerr:m:<typ>     bereinigter Eintrag, NX   → client_error_types (hash, entry, first_day)
--   clerr:new:<tag>   Typen, neu an diesem Tag  → client_error_types.first_day = tag
--   clerr:iprl:*, clerr:total:*                 → rate_limits über sync_rate_hit
--
-- Verfall wie in Redis nach 30 Tagen: Zähler älter als 30 Tage räumt jeder hundertste
-- Aufruf weg. Ein Typ, dessen first_day 30 Tage zurückliegt, gilt beim nächsten
-- Auftreten wieder als neu (entspricht dem abgelaufenen SET NX EX).
--
-- Inhalt: nur der bereinigte Eintrag aus sanitize() — keine IP, keine Nutzer-ID.
-- Zugriff: ausschließlich api/ mit dem Service-Key, wie bei 20261006000001_sync.sql.
-- =============================================================================

create table if not exists client_error_counts (
    day   date    not null,
    hash  text    not null,
    count integer not null,
    primary key (day, hash)
);

create table if not exists client_error_types (
    hash      text  primary key,
    entry     jsonb not null,
    first_day date  not null
);

alter table client_error_counts enable row level security;
alter table client_error_types  enable row level security;

-- Zählt ein Vorkommen. Rückgabe true = Typ ist an p_day neu.
create or replace function sync_clerr_store(p_day date, p_hash text, p_entry jsonb)
returns boolean language plpgsql as $$
declare n integer;
begin
    insert into client_error_counts as c (day, hash, count) values (p_day, p_hash, 1)
    on conflict (day, hash) do update set count = c.count + 1;

    insert into client_error_types as t (hash, entry, first_day) values (p_hash, p_entry, p_day)
    on conflict (hash) do update set entry = excluded.entry, first_day = excluded.first_day
        where t.first_day <= p_day - 30;
    get diagnostics n = row_count;

    if random() < 0.01 then
        delete from client_error_counts where day <= p_day - 30;
        delete from client_error_types  where first_day <= p_day - 30;
    end if;
    return n = 1;
end $$;

-- Tagesdaten für die Zusammenfassung: { counts: {hash: n}, neu: [hash], entries: {hash: entry} }
create or replace function sync_clerr_summary(p_day date)
returns jsonb language sql stable as $$
    select jsonb_build_object(
        'counts',  coalesce((select jsonb_object_agg(hash, count) from client_error_counts where day = p_day), '{}'::jsonb),
        'neu',     coalesce((select jsonb_agg(hash order by hash) from client_error_types where first_day = p_day), '[]'::jsonb),
        'entries', coalesce((select jsonb_object_agg(hash, entry) from client_error_types where first_day = p_day), '{}'::jsonb)
    )
$$;

-- ── Rechte (wie 20261006000001_sync.sql) ─────────────────────────────────────────
revoke all on client_error_counts, client_error_types from public, anon, authenticated;
revoke all on function sync_clerr_store(date, text, jsonb) from public, anon, authenticated;
revoke all on function sync_clerr_summary(date)          from public, anon, authenticated;
grant execute on function sync_clerr_store(date, text, jsonb) to service_role;
grant execute on function sync_clerr_summary(date)          to service_role;
