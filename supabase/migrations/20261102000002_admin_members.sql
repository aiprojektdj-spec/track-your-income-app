-- Stackr Admin-Panel — Phase b: Mitglieder, Notizen, Tags, Sperre
-- =============================================================================
-- Nach 20261102000001_admin_audit.sql. Zugriff nur ueber den Service-Key (RLS an, keine Policy).
--
-- admin_members: Spiegel der Whop-Mitgliedschaften (Konto-Metadaten, KEINE Buchhaltungsdaten).
--   Eine Zeile je Whop-Nutzer; hat er mehrere Mitgliedschaften, steht hier die "beste"
--   (aktiv > Test > ueberfaellig > Rest, dann juengste) — das entscheidet admin/api/members-sync.js.
--   suspended_* gehoert dem Panel und wird vom Abgleich NIE ueberschrieben.
--   last_active_at = juengster Sync-Stand (sync_snapshots.updated_at).
--
-- Jede schreibende Funktion nimmt p_ctx { admin, ip, ua } und schreibt den Audit-Eintrag in
-- DERSELBEN Transaktion: keine Aenderung ohne Spur, keine Spur ohne Aenderung.
--
-- sync_admin_gesperrt(user) wird von den Stackr-Endpunkten (api/_gesperrt.js) gefragt.
-- =============================================================================

create table if not exists admin_members (
    whop_user_id    text        primary key,
    email           text        not null default '',
    email_domain    text        generated always as (lower(split_part(email, '@', 2))) stored,
    name            text        not null default '',
    username        text        not null default '',
    plan_id         text        not null default '',
    membership_id   text        not null default '',
    status          text        not null default '',
    signup_at       timestamptz,
    last_active_at  timestamptz,
    last_sync_at    timestamptz not null default now(),
    suspended_at    timestamptz,
    suspended_reason text       not null default ''
);
create index if not exists admin_members_email  on admin_members (lower(email) text_pattern_ops);
create index if not exists admin_members_name   on admin_members (lower(name) text_pattern_ops);
create index if not exists admin_members_user   on admin_members (lower(username) text_pattern_ops);
create index if not exists admin_members_domain on admin_members (email_domain);
create index if not exists admin_members_status on admin_members (status);
create index if not exists admin_members_signup on admin_members (signup_at desc);
create index if not exists admin_members_active on admin_members (last_active_at desc);
create index if not exists admin_members_susp   on admin_members (suspended_at) where suspended_at is not null;

create table if not exists admin_notes (
    id           bigserial   primary key,
    whop_user_id text        not null references admin_members (whop_user_id),
    author       text        not null,
    body         text        not null,
    pinned       boolean     not null default false,
    created_at   timestamptz not null default now()
);
create index if not exists admin_notes_member on admin_notes (whop_user_id, pinned desc, id desc);

create table if not exists admin_member_tags (
    whop_user_id text not null references admin_members (whop_user_id),
    tag          text not null,
    primary key (whop_user_id, tag)
);
create index if not exists admin_member_tags_tag on admin_member_tags (tag, whop_user_id);

alter table admin_members     enable row level security;
alter table admin_notes       enable row level security;
alter table admin_member_tags enable row level security;

-- ── Audit in derselben Transaktion ──────────────────────────────────────────────
create or replace function sync_admin_audit_intern(
    p_ctx jsonb, p_action text, p_target_type text, p_target_id text, p_before jsonb, p_after jsonb)
returns void language sql set search_path = public, pg_temp as $$
    insert into admin_audit_log (admin_email, action, target_type, target_id, before, after, ip, user_agent)
    values (left(coalesce(p_ctx->>'admin', ''), 200), left(p_action, 80), left(p_target_type, 60),
            left(p_target_id, 200), p_before, p_after,
            left(coalesce(p_ctx->>'ip', ''), 64), left(coalesce(p_ctx->>'ua', ''), 300));
$$;

-- ── Abgleich mit Whop ───────────────────────────────────────────────────────────
-- p_rows: [{ whop_user_id, email, name, username, plan_id, membership_id, status, signup_at }]
create or replace function sync_admin_members_upsert(p_rows jsonb, p_ctx jsonb, p_audit boolean)
returns integer language plpgsql set search_path = public, pg_temp as $$
declare n integer;
begin
    insert into admin_members (whop_user_id, email, name, username, plan_id, membership_id, status, signup_at, last_sync_at)
    select r->>'whop_user_id', coalesce(r->>'email', ''), coalesce(r->>'name', ''), coalesce(r->>'username', ''),
           coalesce(r->>'plan_id', ''), coalesce(r->>'membership_id', ''), coalesce(r->>'status', ''),
           nullif(r->>'signup_at', '')::timestamptz, now()
      from jsonb_array_elements(p_rows) r
     where coalesce(r->>'whop_user_id', '') <> ''
    on conflict (whop_user_id) do update set
        email = excluded.email, name = excluded.name, username = excluded.username,
        plan_id = excluded.plan_id, membership_id = excluded.membership_id, status = excluded.status,
        signup_at = coalesce(excluded.signup_at, admin_members.signup_at), last_sync_at = now();
    get diagnostics n = row_count;

    update admin_members m set last_active_at = s.mx
      from (select user_id, max(updated_at) mx from sync_snapshots group by user_id) s
     where s.user_id = m.whop_user_id and m.last_active_at is distinct from s.mx;

    if p_audit then
        perform sync_admin_audit_intern(p_ctx, 'members.sync', 'members', '', null, jsonb_build_object('rows', n));
    end if;
    return n;
end $$;

-- ── Liste (Filter, Sortierung, Seiten) ──────────────────────────────────────────
create or replace function sync_admin_members_list(
    p_q text, p_status text, p_tag text, p_suspended boolean,
    p_sort text, p_dir text, p_limit integer, p_offset integer)
returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare
    v_q   text := nullif(lower(btrim(coalesce(p_q, ''))), '');
    v_col text := case p_sort when 'email' then 'email' when 'name' then 'name' when 'status' then 'status'
                              when 'last_active_at' then 'last_active_at' else 'signup_at' end;
    v_dir text := case when p_dir = 'asc' then 'asc' else 'desc' end;
    v_res jsonb;
begin
    execute format($f$
        with f as (
            select m.* from admin_members m
             where ($1 is null or lower(m.email) like $1 || '%%' or lower(m.name) like $1 || '%%'
                    or lower(m.username) like $1 || '%%' or m.whop_user_id = $7 or m.email_domain = $1)
               and ($2 is null or m.status = $2)
               and ($3 is null or (m.suspended_at is not null) = $3)
               and ($4 is null or exists (select 1 from admin_member_tags t
                                           where t.whop_user_id = m.whop_user_id and t.tag = $4))
        ), p as (
            select f.*, row_number() over (order by f.%I %s nulls last, f.whop_user_id) rn
              from f order by rn limit $5 offset $6
        )
        select jsonb_build_object(
            'total', (select count(*) from f),
            'rows', coalesce((select jsonb_agg(
                (to_jsonb(p) - 'rn') || jsonb_build_object('tags', coalesce(
                    (select jsonb_agg(t.tag order by t.tag) from admin_member_tags t
                      where t.whop_user_id = p.whop_user_id), '[]'::jsonb))
                order by p.rn) from p), '[]'::jsonb))
    $f$, v_col, v_dir)
    into v_res
    using v_q, nullif(p_status, ''), p_suspended, nullif(p_tag, ''),
          least(greatest(coalesce(p_limit, 25), 1), 200), greatest(coalesce(p_offset, 0), 0), btrim(coalesce(p_q, ''));
    return v_res;
end $$;

-- ── Schnellsuche (Cmd+K): alle Treffer ueber Indizes ────────────────────────────
create or replace function sync_admin_search(p_q text, p_limit integer)
returns jsonb language sql stable set search_path = public, pg_temp as $$
    with q as (select nullif(lower(btrim(coalesce(p_q, ''))), '') v, btrim(coalesce(p_q, '')) raw)
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select m.whop_user_id, m.email, m.name, m.status, m.suspended_at
          from admin_members m, q
         where q.v is not null
           and (m.whop_user_id = q.raw or lower(m.email) like q.v || '%' or lower(m.name) like q.v || '%'
                or lower(m.username) like q.v || '%' or m.email_domain = q.v)
         order by m.signup_at desc nulls last
         limit least(greatest(coalesce(p_limit, 8), 1), 25)
    ) x
$$;

-- ── Detail ──────────────────────────────────────────────────────────────────────
create or replace function sync_admin_member_get(p_id text)
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select jsonb_build_object(
        'member', to_jsonb(m),
        'tags', coalesce((select jsonb_agg(t.tag order by t.tag) from admin_member_tags t
                           where t.whop_user_id = m.whop_user_id), '[]'::jsonb),
        'notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.pinned desc, n.id desc) from admin_notes n
                            where n.whop_user_id = m.whop_user_id), '[]'::jsonb),
        'loeschplan', (select to_jsonb(l) from loeschplan l where l.user_id = m.whop_user_id),
        'sync', jsonb_build_object(
            'scopes', (select count(*) from sync_scopes s where s.user_id = m.whop_user_id),
            'zuletzt', (select max(updated_at) from sync_snapshots s where s.user_id = m.whop_user_id)))
      from admin_members m where m.whop_user_id = p_id
$$;

-- ── Sperre ──────────────────────────────────────────────────────────────────────
-- Liefert { before, after } oder null, wenn es das Mitglied nicht gibt.
create or replace function sync_admin_member_suspend(p_id text, p_on boolean, p_reason text, p_ctx jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_before jsonb; v_after jsonb;
begin
    select jsonb_build_object('suspended_at', suspended_at, 'reason', suspended_reason)
      into v_before from admin_members where whop_user_id = p_id for update;
    if not found then return null; end if;

    update admin_members
       set suspended_at = case when p_on then coalesce(suspended_at, now()) else null end,
           suspended_reason = case when p_on then left(coalesce(p_reason, ''), 300) else '' end
     where whop_user_id = p_id
    returning jsonb_build_object('suspended_at', suspended_at, 'reason', suspended_reason) into v_after;

    perform sync_admin_audit_intern(p_ctx, case when p_on then 'users.suspend' else 'users.unsuspend' end,
                                    'member', p_id, v_before, v_after);
    return jsonb_build_object('before', v_before, 'after', v_after);
end $$;

-- Wird von den Stackr-Endpunkten gefragt: true = gesperrt.
create or replace function sync_admin_gesperrt(p_user text)
returns boolean language sql stable set search_path = public, pg_temp as $$
    select exists (select 1 from admin_members where whop_user_id = p_user and suspended_at is not null)
$$;

-- ── Notizen ─────────────────────────────────────────────────────────────────────
create or replace function sync_admin_note_add(p_id text, p_body text, p_ctx jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_note admin_notes;
begin
    if not exists (select 1 from admin_members where whop_user_id = p_id) then return null; end if;
    insert into admin_notes (whop_user_id, author, body)
    values (p_id, coalesce(p_ctx->>'admin', ''), left(p_body, 5000)) returning * into v_note;
    -- Der Notiztext steht NICHT im Audit-Log (kann Personenbezug enthalten), nur Id und Laenge.
    perform sync_admin_audit_intern(p_ctx, 'notes.add', 'member', p_id, null,
                                    jsonb_build_object('note_id', v_note.id, 'laenge', length(v_note.body)));
    return to_jsonb(v_note);
end $$;

create or replace function sync_admin_note_pin(p_note bigint, p_pinned boolean, p_ctx jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_note admin_notes; v_old boolean;
begin
    select pinned into v_old from admin_notes where id = p_note for update;
    if not found then return null; end if;
    update admin_notes set pinned = p_pinned where id = p_note returning * into v_note;
    perform sync_admin_audit_intern(p_ctx, 'notes.pin', 'member', v_note.whop_user_id,
                                    jsonb_build_object('note_id', p_note, 'pinned', v_old),
                                    jsonb_build_object('note_id', p_note, 'pinned', p_pinned));
    return to_jsonb(v_note);
end $$;

-- ── Tags ────────────────────────────────────────────────────────────────────────
create or replace function sync_admin_tag_set(p_id text, p_tag text, p_on boolean, p_ctx jsonb)
returns boolean language plpgsql set search_path = public, pg_temp as $$
declare n integer;
begin
    if not exists (select 1 from admin_members where whop_user_id = p_id) then return null; end if;
    if p_on then
        insert into admin_member_tags (whop_user_id, tag) values (p_id, p_tag) on conflict do nothing;
    else
        delete from admin_member_tags where whop_user_id = p_id and tag = p_tag;
    end if;
    get diagnostics n = row_count;
    if n > 0 then
        perform sync_admin_audit_intern(p_ctx, case when p_on then 'tags.add' else 'tags.remove' end,
                                        'member', p_id, null, jsonb_build_object('tag', p_tag));
    end if;
    return n > 0;
end $$;

create or replace function sync_admin_tags_liste()
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select coalesce(jsonb_agg(jsonb_build_object('tag', tag, 'n', n) order by tag), '[]'::jsonb)
      from (select tag, count(*) n from admin_member_tags group by tag) x
$$;

-- ── Rechte ──────────────────────────────────────────────────────────────────────
revoke all on admin_members, admin_notes, admin_member_tags from public, anon, authenticated;
revoke all on sequence admin_notes_id_seq from public, anon, authenticated;
revoke all on function sync_admin_audit_intern(jsonb, text, text, text, jsonb, jsonb)       from public, anon, authenticated;
revoke all on function sync_admin_members_upsert(jsonb, jsonb, boolean)                      from public, anon, authenticated;
revoke all on function sync_admin_members_list(text, text, text, boolean, text, text, integer, integer) from public, anon, authenticated;
revoke all on function sync_admin_search(text, integer)                                      from public, anon, authenticated;
revoke all on function sync_admin_member_get(text)                                           from public, anon, authenticated;
revoke all on function sync_admin_member_suspend(text, boolean, text, jsonb)                 from public, anon, authenticated;
revoke all on function sync_admin_gesperrt(text)                                             from public, anon, authenticated;
revoke all on function sync_admin_note_add(text, text, jsonb)                                from public, anon, authenticated;
revoke all on function sync_admin_note_pin(bigint, boolean, jsonb)                           from public, anon, authenticated;
revoke all on function sync_admin_tag_set(text, text, boolean, jsonb)                        from public, anon, authenticated;
revoke all on function sync_admin_tags_liste()                                               from public, anon, authenticated;
grant select, insert, update, delete on admin_members, admin_notes, admin_member_tags to service_role;
grant usage on sequence admin_notes_id_seq to service_role;
grant execute on function sync_admin_audit_intern(jsonb, text, text, text, jsonb, jsonb)       to service_role;
grant execute on function sync_admin_members_upsert(jsonb, jsonb, boolean)                      to service_role;
grant execute on function sync_admin_members_list(text, text, text, boolean, text, text, integer, integer) to service_role;
grant execute on function sync_admin_search(text, integer)                                      to service_role;
grant execute on function sync_admin_member_get(text)                                           to service_role;
grant execute on function sync_admin_member_suspend(text, boolean, text, jsonb)                 to service_role;
grant execute on function sync_admin_gesperrt(text)                                             to service_role;
grant execute on function sync_admin_note_add(text, text, jsonb)                                to service_role;
grant execute on function sync_admin_note_pin(bigint, boolean, jsonb)                           to service_role;
grant execute on function sync_admin_tag_set(text, text, boolean, jsonb)                        to service_role;
grant execute on function sync_admin_tags_liste()                                               to service_role;
