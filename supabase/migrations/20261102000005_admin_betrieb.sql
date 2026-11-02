-- Stackr Admin-Panel — Phase e: Betrieb, Missbrauchs-Warteschlange, Bulk-Laeufe
-- =============================================================================
-- Nach 20261102000004_admin_metrics_flags.sql. Zugriff nur ueber den Service-Key (RLS an, keine Policy).
--
-- Betriebsansicht: liest NUR vorhandene Tabellen (ops_alerts, client_error_*, loeschplan) — Stackr hat
--   keine Job-Queue, kein Sentry und keine Login-Orte; dafuer gibt es hier nichts anzuzeigen.
-- Missbrauchs-Pruefung (Knopfdruck, kein Cron) meldet:
--   signup_domain    >= 5 Anmeldungen derselben Firmen-Domain in 24 h (Freemail-Anbieter ausgenommen)
--   failed_payments  >= 3 fehlgeschlagene Zahlungen eines Mitglieds in 30 Tagen
--   Eine entschiedene Meldung (freigegeben/gesperrt) taucht 30 Tage lang nicht erneut auf.
--   "Sperren" gibt es nur fuer Mitglieder-Meldungen; eine Domain laesst sich nur freigeben.
-- Bulk: Trockenlauf -> Start (Anzahl muss mit dem Trockenlauf uebereinstimmen, Obergrenze) -> Schritte
--   zu je <= 50 Mitgliedern, Ergebnis je Mitglied in admin_bulk_items, je Mitglied ein Audit-Eintrag.
-- =============================================================================

create table if not exists admin_abuse_flags (
    id          bigserial   primary key,
    kind        text        not null check (kind in ('signup_domain', 'failed_payments')),
    subject     text        not null,
    whop_user_id text,
    detail      jsonb       not null default '{}'::jsonb,
    status      text        not null default 'offen' check (status in ('offen', 'freigegeben', 'gesperrt')),
    created_at  timestamptz not null default now(),
    decided_at  timestamptz,
    decided_by  text,
    reason      text        not null default ''
);
create unique index if not exists admin_abuse_offen  on admin_abuse_flags (kind, subject) where status = 'offen';
create index        if not exists admin_abuse_status on admin_abuse_flags (status, id desc);

create table if not exists admin_bulk_runs (
    id          bigserial   primary key,
    ts          timestamptz not null default now(),
    admin_email text        not null,
    op          text        not null check (op in ('tag.add', 'suspend')),
    param       text        not null default '',
    filter      jsonb       not null,
    total       integer     not null,
    done        integer     not null default 0,
    failed      integer     not null default 0,
    status      text        not null default 'laeuft' check (status in ('laeuft', 'fertig'))
);

create table if not exists admin_bulk_items (
    run_id       bigint not null references admin_bulk_runs (id),
    whop_user_id text   not null,
    status       text   not null default 'offen' check (status in ('offen', 'ok', 'fehler')),
    message      text   not null default '',
    primary key (run_id, whop_user_id)
);
create index if not exists admin_bulk_items_offen on admin_bulk_items (run_id) where status = 'offen';

alter table admin_abuse_flags enable row level security;
alter table admin_bulk_runs   enable row level security;
alter table admin_bulk_items  enable row level security;

-- ── Betriebsansicht ─────────────────────────────────────────────────────────────
create or replace function sync_admin_betrieb()
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select jsonb_build_object(
        'alarme', coalesce((select jsonb_agg(a order by a.ts desc) from (
                    select ts, source, event, left(detail, 200) as detail, env
                      from ops_alerts order by ts desc limit 50) a), '[]'::jsonb),
        'alarme_24h', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'event', event, 'n', n) order by n desc)
                    from (select source, event, count(*) n from ops_alerts
                           where ts > now() - interval '24 hours' group by 1, 2) b), '[]'::jsonb),
        'client_fehler', coalesce((select jsonb_agg(c order by c.n desc) from (
                    select k.hash, sum(k.count)::int as n, left(t.entry::text, 300) as eintrag
                      from client_error_counts k join client_error_types t on t.hash = k.hash
                     where k.day >= (now() at time zone 'Europe/Berlin')::date - 6
                     group by k.hash, t.entry order by n desc limit 15) c), '[]'::jsonb),
        'loeschplan', jsonb_build_object(
            'gesamt', (select count(*) from loeschplan),
            'faellig', (select count(*) from loeschplan where inaktiv_seit < now() - interval '30 days')),
        'mitglieder', jsonb_build_object(
            'gesamt', (select count(*) from admin_members),
            'gesperrt', (select count(*) from admin_members where suspended_at is not null)),
        'abuse_offen', (select count(*) from admin_abuse_flags where status = 'offen'),
        'stand', jsonb_build_object(
            'mitglieder', (select max(last_sync_at) from admin_members),
            'zahlungen', (select max(last_sync_at) from admin_payments),
            'kennzahlen', (select max(computed_at) from admin_daily_metrics)))
$$;

-- ── Missbrauch ──────────────────────────────────────────────────────────────────
create or replace function sync_admin_abuse_scan(p_ctx jsonb, p_audit boolean)
returns integer language plpgsql set search_path = public, pg_temp as $$
declare n1 integer; n2 integer;
begin
    insert into admin_abuse_flags (kind, subject, detail)
    select 'signup_domain', x.d, jsonb_build_object('anmeldungen_24h', x.c, 'schwelle', 5)
      from (select email_domain d, count(*) c from admin_members
             where signup_at > now() - interval '24 hours' and email_domain <> ''
               and email_domain not in ('gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
                                        'yahoo.com', 'yahoo.de', 'gmx.de', 'gmx.net', 'web.de', 't-online.de',
                                        'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'freenet.de')
             group by 1 having count(*) >= 5) x
     where not exists (select 1 from admin_abuse_flags f where f.kind = 'signup_domain' and f.subject = x.d
                          and (f.status = 'offen' or f.decided_at > now() - interval '30 days'))
    on conflict do nothing;
    get diagnostics n1 = row_count;

    insert into admin_abuse_flags (kind, subject, whop_user_id, detail)
    select 'failed_payments', x.u, x.u, jsonb_build_object('fehlgeschlagen_30t', x.c, 'schwelle', 3)
      from (select whop_user_id u, count(*) c from admin_payments
             where failed and created_at > now() - interval '30 days' and whop_user_id <> ''
             group by 1 having count(*) >= 3) x
     where not exists (select 1 from admin_abuse_flags f where f.kind = 'failed_payments' and f.subject = x.u
                          and (f.status = 'offen' or f.decided_at > now() - interval '30 days'))
    on conflict do nothing;
    get diagnostics n2 = row_count;

    if p_audit then
        perform sync_admin_audit_intern(p_ctx, 'abuse.scan', 'abuse', '', null, jsonb_build_object('neu', n1 + n2));
    end if;
    return n1 + n2;
end $$;

create or replace function sync_admin_abuse_list(p_status text)
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select coalesce(jsonb_agg(x order by x.id desc), '[]'::jsonb) from (
        select f.id, f.kind, f.subject, f.detail, f.status, f.created_at, f.decided_at, f.decided_by, f.reason,
               f.whop_user_id, m.email, m.name, m.suspended_at
          from admin_abuse_flags f left join admin_members m on m.whop_user_id = f.whop_user_id
         where p_status is null or f.status = p_status
         order by f.id desc limit 200) x
$$;

-- Ergebnis: Flag-Zeile, oder { fehler } bei unzulaessiger Entscheidung, oder null (nicht offen/unbekannt)
create or replace function sync_admin_abuse_decide(p_id bigint, p_decision text, p_reason text, p_ctx jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare f admin_abuse_flags; v_sperre jsonb;
begin
    select * into f from admin_abuse_flags where id = p_id and status = 'offen' for update;
    if not found then return null; end if;
    if p_decision not in ('freigegeben', 'gesperrt') then return jsonb_build_object('fehler', 'entscheidung_ungueltig'); end if;
    if p_decision = 'gesperrt' then
        if f.whop_user_id is null then return jsonb_build_object('fehler', 'domain_nicht_sperrbar'); end if;
        v_sperre := sync_admin_member_suspend(f.whop_user_id, true, left('Missbrauchsverdacht: ' || coalesce(p_reason, ''), 300), p_ctx);
        if v_sperre is null then return jsonb_build_object('fehler', 'mitglied_fehlt'); end if;
    end if;
    update admin_abuse_flags
       set status = p_decision, decided_at = now(), decided_by = left(coalesce(p_ctx->>'admin', ''), 200),
           reason = left(coalesce(p_reason, ''), 300)
     where id = p_id returning * into f;
    perform sync_admin_audit_intern(p_ctx, 'abuse.' || p_decision, 'abuse', p_id::text, null,
                                    jsonb_build_object('kind', f.kind, 'subject', f.subject));
    return to_jsonb(f);
end $$;

-- ── Bulk ────────────────────────────────────────────────────────────────────────
-- Dieselben Filter wie die Mitgliederliste: q, status, tag, suspended
create or replace function sync_admin_filter_ids(p_filter jsonb, p_limit integer)
returns setof text language sql stable set search_path = public, pg_temp as $$
    with q as (select nullif(lower(btrim(coalesce(p_filter->>'q', ''))), '') v, btrim(coalesce(p_filter->>'q', '')) raw)
    select m.whop_user_id from admin_members m, q
     where (q.v is null or lower(m.email) like q.v || '%' or lower(m.name) like q.v || '%'
            or lower(m.username) like q.v || '%' or m.whop_user_id = q.raw or m.email_domain = q.v)
       and (nullif(p_filter->>'status', '') is null or m.status = p_filter->>'status')
       and (nullif(p_filter->>'suspended', '') is null or (m.suspended_at is not null) = (p_filter->>'suspended')::boolean)
       and (nullif(p_filter->>'tag', '') is null or exists (select 1 from admin_member_tags t
                                                     where t.whop_user_id = m.whop_user_id and t.tag = p_filter->>'tag'))
     order by m.whop_user_id
     limit least(greatest(coalesce(p_limit, 100), 1), 100000)
$$;

create or replace function sync_admin_bulk_preview(p_filter jsonb)
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select jsonb_build_object(
        'anzahl', (select count(*) from sync_admin_filter_ids(p_filter, 100000)),
        'beispiele', coalesce((select jsonb_agg(jsonb_build_object('whop_user_id', m.whop_user_id, 'email', m.email,
                                 'name', m.name, 'status', m.status, 'suspended_at', m.suspended_at) order by m.whop_user_id)
                                 from admin_members m
                                where m.whop_user_id in (select * from sync_admin_filter_ids(p_filter, 10))), '[]'::jsonb))
$$;

-- Ergebnis { run_id, total } oder { fehler, anzahl }
create or replace function sync_admin_bulk_start(p_op text, p_param text, p_filter jsonb, p_max integer, p_expect integer, p_ctx jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare n integer; v_run bigint;
begin
    select count(*) into n from sync_admin_filter_ids(p_filter, 100000);
    if n = 0 then return jsonb_build_object('fehler', 'leer', 'anzahl', 0); end if;
    if n > p_max then return jsonb_build_object('fehler', 'zu_viele', 'anzahl', n); end if;
    if p_expect is distinct from n then return jsonb_build_object('fehler', 'anzahl_geaendert', 'anzahl', n); end if;

    insert into admin_bulk_runs (admin_email, op, param, filter, total)
    values (left(coalesce(p_ctx->>'admin', ''), 200), p_op, left(coalesce(p_param, ''), 300), p_filter, n) returning id into v_run;
    insert into admin_bulk_items (run_id, whop_user_id) select v_run, i from sync_admin_filter_ids(p_filter, p_max) i;

    perform sync_admin_audit_intern(p_ctx, 'bulk.start', 'bulk', v_run::text, null,
                                    jsonb_build_object('op', p_op, 'param', p_param, 'filter', p_filter, 'total', n));
    return jsonb_build_object('run_id', v_run, 'total', n);
end $$;

-- Verarbeitet bis zu p_batch (<= 50) offene Mitglieder; jedes in eigenem Unterblock, ein Fehler stoppt nicht den Lauf
create or replace function sync_admin_bulk_step(p_run bigint, p_batch integer, p_ctx jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare r record; v_run admin_bulk_runs; v_ctx jsonb; v_res jsonb; v_offen integer;
begin
    select * into v_run from admin_bulk_runs where id = p_run for update;
    if not found then return null; end if;
    v_ctx := p_ctx || jsonb_build_object('ua', left(coalesce(p_ctx->>'ua', ''), 250) || ' [bulk ' || p_run || ']');

    for r in select i.whop_user_id from admin_bulk_items i
              where i.run_id = p_run and i.status = 'offen'
              order by i.whop_user_id limit least(greatest(coalesce(p_batch, 50), 1), 50) loop
        begin
            if v_run.op = 'tag.add' then
                perform sync_admin_tag_set(r.whop_user_id, v_run.param, true, v_ctx);
                update admin_bulk_items set status = 'ok' where run_id = p_run and whop_user_id = r.whop_user_id;
            elsif v_run.op = 'suspend' then
                if exists (select 1 from admin_members where whop_user_id = r.whop_user_id and suspended_at is not null) then
                    update admin_bulk_items set status = 'ok', message = 'war bereits gesperrt'
                     where run_id = p_run and whop_user_id = r.whop_user_id;
                else
                    v_res := sync_admin_member_suspend(r.whop_user_id, true, v_run.param, v_ctx);
                    if v_res is null then raise exception 'Mitglied nicht gefunden'; end if;
                    update admin_bulk_items set status = 'ok' where run_id = p_run and whop_user_id = r.whop_user_id;
                end if;
            end if;
        exception when others then
            update admin_bulk_items set status = 'fehler', message = left(sqlerrm, 200)
             where run_id = p_run and whop_user_id = r.whop_user_id;
        end;
    end loop;

    update admin_bulk_runs set
        done   = (select count(*) from admin_bulk_items where run_id = p_run and status <> 'offen'),
        failed = (select count(*) from admin_bulk_items where run_id = p_run and status = 'fehler')
     where id = p_run;
    select count(*) into v_offen from admin_bulk_items where run_id = p_run and status = 'offen';
    if v_offen = 0 and v_run.status <> 'fertig' then
        update admin_bulk_runs set status = 'fertig' where id = p_run;
        perform sync_admin_audit_intern(p_ctx, 'bulk.done', 'bulk', p_run::text, null,
                                        jsonb_build_object('total', v_run.total,
                                                           'fehler', (select failed from admin_bulk_runs where id = p_run)));
    end if;
    return sync_admin_bulk_get(p_run);
end $$;

create or replace function sync_admin_bulk_get(p_run bigint)
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select jsonb_build_object(
        'lauf', to_jsonb(r),
        'fehler', coalesce((select jsonb_agg(jsonb_build_object('whop_user_id', i.whop_user_id, 'message', i.message) order by i.whop_user_id)
                              from (select * from admin_bulk_items where run_id = r.id and status = 'fehler'
                                     order by whop_user_id limit 100) i), '[]'::jsonb))
      from admin_bulk_runs r where r.id = p_run
$$;

-- ── Export (nur Zahlungen; Mitglieder und Audit laufen ueber ihre Listenfunktionen) ──
create or replace function sync_admin_payments_export(p_from date, p_to date, p_limit integer)
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select coalesce(jsonb_agg(to_jsonb(p) - 'last_sync_at' order by p.created_at desc), '[]'::jsonb)
      from (select * from admin_payments
             where created_at >= p_from and created_at < p_to + 1
             order by created_at desc limit least(greatest(coalesce(p_limit, 5000), 1), 5000)) p
$$;

-- ── Rechte ──────────────────────────────────────────────────────────────────────
revoke all on admin_abuse_flags, admin_bulk_runs, admin_bulk_items from public, anon, authenticated;
revoke all on sequence admin_abuse_flags_id_seq, admin_bulk_runs_id_seq from public, anon, authenticated;
revoke all on function sync_admin_betrieb()                                              from public, anon, authenticated;
revoke all on function sync_admin_abuse_scan(jsonb, boolean)                             from public, anon, authenticated;
revoke all on function sync_admin_abuse_list(text)                                       from public, anon, authenticated;
revoke all on function sync_admin_abuse_decide(bigint, text, text, jsonb)                from public, anon, authenticated;
revoke all on function sync_admin_filter_ids(jsonb, integer)                             from public, anon, authenticated;
revoke all on function sync_admin_bulk_preview(jsonb)                                    from public, anon, authenticated;
revoke all on function sync_admin_bulk_start(text, text, jsonb, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function sync_admin_bulk_step(bigint, integer, jsonb)                      from public, anon, authenticated;
revoke all on function sync_admin_bulk_get(bigint)                                       from public, anon, authenticated;
revoke all on function sync_admin_payments_export(date, date, integer)                   from public, anon, authenticated;
grant select, insert, update, delete on admin_abuse_flags, admin_bulk_runs, admin_bulk_items to service_role;
grant usage on sequence admin_abuse_flags_id_seq, admin_bulk_runs_id_seq to service_role;
grant execute on function sync_admin_betrieb()                                              to service_role;
grant execute on function sync_admin_abuse_scan(jsonb, boolean)                             to service_role;
grant execute on function sync_admin_abuse_list(text)                                       to service_role;
grant execute on function sync_admin_abuse_decide(bigint, text, text, jsonb)                to service_role;
grant execute on function sync_admin_filter_ids(jsonb, integer)                             to service_role;
grant execute on function sync_admin_bulk_preview(jsonb)                                    to service_role;
grant execute on function sync_admin_bulk_start(text, text, jsonb, integer, integer, jsonb) to service_role;
grant execute on function sync_admin_bulk_step(bigint, integer, jsonb)                      to service_role;
grant execute on function sync_admin_bulk_get(bigint)                                       to service_role;
grant execute on function sync_admin_payments_export(date, date, integer)                   to service_role;
