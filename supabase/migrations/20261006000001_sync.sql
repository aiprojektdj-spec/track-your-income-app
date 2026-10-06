-- Stackr — Cloud-Sync auf Supabase (Phase 1, ersetzt die Upstash-Keys von api/sync.js)
-- =============================================================================
-- In BEIDEN Projekten ausführen: stackr-preview zuerst, dann stackr-prod.
--
-- Abbildung der Redis-Keys:
--   sync:<user>:<scope>          → sync_snapshots
--   scopes:<user>                → sync_scopes
--   syncanchor:<user>:<scope>    → sync_anchors
--   pubkey:<user>                → public_keys
--   grant:<owner>:<grantee>      → grants   (grantsby:/grantsfor: entfallen, sind Abfragen)
--   sync:rl:* / sync:iprl:*      → rate_limits
--
-- Zugriff: ausschließlich api/ mit dem Service-Key. RLS ist an und hat KEINE Policy,
-- anon/authenticated haben weder Tabellen- noch Funktionsrechte. Der Browser spricht
-- nie direkt mit Supabase (Entscheidung E2, 2026-10-06).
--
-- Inhalt: nur Chiffrat (E1 Option A). `data` ist exakt das Objekt, das heute als
-- Redis-Wert liegt: { ciphertext | blobUrl, iv, version, updatedAt, deviceId }.
-- =============================================================================

create table if not exists sync_snapshots (
    user_id    text        not null,
    scope      text        not null,
    version    integer     not null,
    data       jsonb       not null,
    updated_at timestamptz not null default now(),
    primary key (user_id, scope)
);

create table if not exists sync_scopes (
    user_id text not null,
    scope   text not null,
    primary key (user_id, scope)
);

create table if not exists sync_anchors (
    seq      bigserial primary key,
    user_id  text   not null,
    scope    text   not null,
    entry_id text   not null,
    h        text   not null,
    ts       bigint not null
);
create index if not exists sync_anchors_user_scope on sync_anchors (user_id, scope, seq);

create table if not exists public_keys (
    user_id text  primary key,
    data    jsonb not null
);

create table if not exists grants (
    owner_id   text        not null,
    grantee_id text        not null,
    data       jsonb       not null,
    created_at timestamptz not null default now(),
    primary key (owner_id, grantee_id)
);
create index if not exists grants_grantee on grants (grantee_id);

create table if not exists rate_limits (
    key      text        primary key,
    count    integer     not null,
    reset_at timestamptz not null
);

alter table sync_snapshots enable row level security;
alter table sync_scopes    enable row level security;
alter table sync_anchors   enable row level security;
alter table public_keys    enable row level security;
alter table grants         enable row level security;
alter table rate_limits    enable row level security;

-- ── Funktionen (je eine pro Speicheroperation, über PostgREST /rpc/<name>) ──────

-- Zähler im festen Fenster, wie INCR + EXPIRE NX. Abgelaufene Zeilen räumt jeder
-- hundertste Aufruf weg, sonst wüchse die Tabelle mit jeder IP.
create or replace function sync_rate_hit(p_key text, p_window integer)
returns integer language plpgsql as $$
declare n integer;
begin
    insert into rate_limits as r (key, count, reset_at)
    values (p_key, 1, now() + make_interval(secs => p_window))
    on conflict (key) do update set
        count    = case when r.reset_at <= now() then 1 else r.count + 1 end,
        reset_at = case when r.reset_at <= now() then now() + make_interval(secs => p_window) else r.reset_at end
    returning count into n;
    if random() < 0.01 then
        delete from rate_limits where reset_at < now() - interval '1 hour';
    end if;
    return n;
end $$;

create or replace function sync_get(p_user text, p_scope text)
returns jsonb language sql stable as $$
    select data from sync_snapshots where user_id = p_user and scope = p_scope
$$;

-- Wie das CAS-Lua-Skript: schreibt nur, wenn die gespeicherte Version der erwarteten
-- entspricht; sonst kommt der aktuelle Stand zurück. Gibt es noch keinen Snapshot,
-- wird geschrieben. Zwei gleichzeitige Erst-Schreiber: der zweite bekommt den Konflikt.
create or replace function sync_cas(p_user text, p_scope text, p_expected integer, p_data jsonb)
returns jsonb language plpgsql as $$
declare cur jsonb; n integer;
begin
    select data into cur from sync_snapshots
     where user_id = p_user and scope = p_scope for update;
    if found then
        if (cur->>'version') is distinct from p_expected::text then
            return jsonb_build_object('ok', false, 'current', cur);
        end if;
        update sync_snapshots
           set data = p_data, version = (p_data->>'version')::integer, updated_at = now()
         where user_id = p_user and scope = p_scope;
        return jsonb_build_object('ok', true);
    end if;
    insert into sync_snapshots (user_id, scope, version, data)
    values (p_user, p_scope, (p_data->>'version')::integer, p_data)
    on conflict do nothing;
    get diagnostics n = row_count;
    if n = 1 then return jsonb_build_object('ok', true); end if;
    select data into cur from sync_snapshots where user_id = p_user and scope = p_scope;
    return jsonb_build_object('ok', false, 'current', cur);
end $$;

-- Unbedingtes Schreiben, nur für den Spiegel-Betrieb und das Backfill.
create or replace function sync_put(p_user text, p_scope text, p_data jsonb)
returns void language sql as $$
    insert into sync_snapshots (user_id, scope, version, data)
    values (p_user, p_scope, (p_data->>'version')::integer, p_data)
    on conflict (user_id, scope) do update
        set data = excluded.data, version = excluded.version, updated_at = now()
$$;

create or replace function sync_delete(p_user text, p_scope text)
returns void language sql as $$
    delete from sync_snapshots where user_id = p_user and scope = p_scope
$$;

-- Scope-Deckel (Fund R2). Ein bereits belegter Scope läuft immer durch. Die Sperre je
-- Nutzer verhindert, dass zwei gleichzeitige Anfragen den Deckel gemeinsam überschreiten.
create or replace function sync_claim_scope(p_user text, p_scope text, p_max integer)
returns boolean language plpgsql as $$
begin
    perform pg_advisory_xact_lock(hashtext('scopes:' || p_user));
    if exists (select 1 from sync_scopes where user_id = p_user and scope = p_scope) then
        return true;
    end if;
    if (select count(*) from sync_scopes where user_id = p_user) >= p_max then
        return false;
    end if;
    insert into sync_scopes (user_id, scope) values (p_user, p_scope);
    return true;
end $$;

create or replace function sync_release_scope(p_user text, p_scope text)
returns void language sql as $$
    delete from sync_scopes where user_id = p_user and scope = p_scope
$$;

create or replace function sync_list_scopes(p_user text)
returns jsonb language sql stable as $$
    select coalesce(jsonb_agg(scope order by scope), '[]'::jsonb) from sync_scopes where user_id = p_user
$$;

create or replace function sync_clear_scopes(p_user text)
returns void language sql as $$
    delete from sync_scopes where user_id = p_user
$$;

-- Anker anhängen und wie LTRIM auf die neuesten p_max kürzen.
-- p_rows: [{ "id": "...", "h": "<64 hex>", "ts": 1234567890 }, ...]
create or replace function sync_append_anchors(p_user text, p_scope text, p_rows jsonb, p_max integer)
returns void language plpgsql as $$
begin
    insert into sync_anchors (user_id, scope, entry_id, h, ts)
    select p_user, p_scope, r->>'id', r->>'h', (r->>'ts')::bigint
      from jsonb_array_elements(p_rows) with ordinality as t(r, i)
     order by i;
    delete from sync_anchors
     where user_id = p_user and scope = p_scope
       and seq < (select seq from sync_anchors
                   where user_id = p_user and scope = p_scope
                   order by seq desc offset p_max - 1 limit 1);
end $$;

create or replace function sync_list_anchors(p_user text, p_scope text)
returns jsonb language sql stable as $$
    select coalesce(jsonb_agg(jsonb_build_object('id', entry_id, 'h', h, 'ts', ts) order by seq), '[]'::jsonb)
      from sync_anchors where user_id = p_user and scope = p_scope
$$;

create or replace function sync_set_pubkey(p_user text, p_data jsonb)
returns void language sql as $$
    insert into public_keys (user_id, data) values (p_user, p_data)
    on conflict (user_id) do update set data = excluded.data
$$;

create or replace function sync_get_pubkey(p_user text)
returns jsonb language sql stable as $$
    select data from public_keys where user_id = p_user
$$;

-- Grant-Deckel je Owner, gleiche Logik wie sync_claim_scope. Ein Re-Grant an denselben
-- Steuerberater läuft immer durch und ersetzt den Envelope.
create or replace function sync_add_grant(p_owner text, p_grantee text, p_data jsonb, p_max integer)
returns boolean language plpgsql as $$
begin
    perform pg_advisory_xact_lock(hashtext('grantsby:' || p_owner));
    if not exists (select 1 from grants where owner_id = p_owner and grantee_id = p_grantee)
       and (select count(*) from grants where owner_id = p_owner) >= p_max then
        return false;
    end if;
    insert into grants (owner_id, grantee_id, data) values (p_owner, p_grantee, p_data)
    on conflict (owner_id, grantee_id) do update set data = excluded.data;
    return true;
end $$;

create or replace function sync_get_grant(p_owner text, p_grantee text)
returns jsonb language sql stable as $$
    select data from grants where owner_id = p_owner and grantee_id = p_grantee
$$;

create or replace function sync_revoke_grant(p_owner text, p_grantee text)
returns void language sql as $$
    delete from grants where owner_id = p_owner and grantee_id = p_grantee
$$;

-- [{ "id": "<owner>", "data": {...} }] — Mandanten, die p_grantee freigegeben haben
create or replace function sync_list_grants_for(p_grantee text)
returns jsonb language sql stable as $$
    select coalesce(jsonb_agg(jsonb_build_object('id', owner_id, 'data', data) order by created_at), '[]'::jsonb)
      from grants where grantee_id = p_grantee
$$;

-- [{ "id": "<grantee>", "data": {...} }] — wem p_owner freigegeben hat
create or replace function sync_list_grantees_by(p_owner text)
returns jsonb language sql stable as $$
    select coalesce(jsonb_agg(jsonb_build_object('id', grantee_id, 'data', data) order by created_at), '[]'::jsonb)
      from grants where owner_id = p_owner
$$;

-- ── Rechte ──────────────────────────────────────────────────────────────────────
-- Supabase gibt anon/authenticated per Default-Privileges Rechte auf alles Neue in
-- `public`. Hier ausdrücklich zurücknehmen — RLS allein schützt die Funktionen nicht.
revoke all on sync_snapshots, sync_scopes, sync_anchors, public_keys, grants, rate_limits
    from public, anon, authenticated;
revoke all on sequence sync_anchors_seq_seq from public, anon, authenticated;

do $$
declare f record;
begin
    for f in select p.oid::regprocedure as sig
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname like 'sync\_%'
    loop
        execute format('revoke all on function %s from public, anon, authenticated', f.sig);
        execute format('grant execute on function %s to service_role', f.sig);
    end loop;
end $$;
