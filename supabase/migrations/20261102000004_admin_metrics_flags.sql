-- Stackr Admin-Panel — Phase d: Kennzahlen (daily_metrics) und Feature-Flags
-- =============================================================================
-- Nach 20261102000003_admin_payments.sql. Zugriff nur ueber den Service-Key (RLS an, keine Policy).
--
-- Kennzahlen entstehen NICHT nachts per Cron (Entscheidung User: keine oeffentliche Cron-Adresse),
-- sondern per Knopfdruck und nach jedem Mitglieder-/Zahlungsabgleich (sync_admin_metrics_compute).
-- Tage sind Kalendertage in Europe/Berlin.
--
-- admin_plans:         Monatsbetrag je Whop-Plan (vom User gepflegt; Whop liefert keinen Preis).
--                      Jahresplan 135 EUR -> 1125 Cent. MRR = Summe ueber Mitglieder mit status 'active'.
-- admin_status_events: Aenderungen von Status/Plan, erkannt beim Abgleich. Der ERSTE Abgleich
--                      (Tabelle leer) erzeugt keine Ereignisse, sonst waeren alle "neu".
--                      Daraus: neuer/Erweiterungs-/Rueckgangs-/verlorener MRR, Kuendiger, Testumstieg.
-- admin_daily_metrics: eine Zeile je Tag. signups/Umsatz/fehlgeschlagen werden fuer 90 Tage aus den
--                      Daten nachgerechnet; MRR, Zaehler und Ereignisse nur fuer den Tag der Berechnung
--                      (vergangene Tage sind eingefroren — Verlauf waechst ab heute).
-- Aktivitaet (DAU/WAU/MAU) = Nutzer mit Sync-Stand (sync_snapshots.updated_at) in 1/7/30 Tagen.
-- =============================================================================

create table if not exists admin_plans (
    plan_id       text        primary key,
    label         text        not null default '',
    monthly_cents integer     not null default 0 check (monthly_cents >= 0),
    updated_at    timestamptz not null default now()
);

create table if not exists admin_status_events (
    id           bigserial   primary key,
    ts           timestamptz not null default now(),
    whop_user_id text        not null,
    from_status  text,
    to_status    text        not null,
    from_plan    text,
    to_plan      text        not null default ''
);
create index if not exists admin_status_events_ts on admin_status_events (ts);

create table if not exists admin_daily_metrics (
    day               date        primary key,
    computed_at       timestamptz,
    mrr_cents         bigint,
    active            integer,
    trialing          integer,
    past_due          integer,
    canceled          integer,
    new_mrr_cents     bigint      not null default 0,
    expansion_cents   bigint      not null default 0,
    contraction_cents bigint      not null default 0,
    churned_cents     bigint      not null default 0,
    churned_logos     integer     not null default 0,
    trial_conversions integer     not null default 0,
    trial_lost        integer     not null default 0,
    signups           integer     not null default 0,
    revenue_cents     bigint      not null default 0,
    failed_payments   integer     not null default 0,
    dau               integer,
    wau               integer,
    mau               integer
);

alter table admin_plans         enable row level security;
alter table admin_status_events enable row level security;
alter table admin_daily_metrics enable row level security;

-- ── Mitglieder-Abgleich erkennt jetzt Status-/Plan-Aenderungen ──────────────────
create or replace function sync_admin_members_upsert(p_rows jsonb, p_ctx jsonb, p_audit boolean)
returns integer language plpgsql set search_path = public, pg_temp as $$
declare n integer; v_erst boolean;
begin
    -- Erstimport: noch kein Mitglied aelter als 10 Minuten
    v_erst := not exists (select 1 from admin_members where last_sync_at < now() - interval '10 minutes');
    if not v_erst then
        insert into admin_status_events (whop_user_id, from_status, to_status, from_plan, to_plan)
        select r->>'whop_user_id', m.status, coalesce(r->>'status', ''), m.plan_id, coalesce(r->>'plan_id', '')
          from jsonb_array_elements(p_rows) r
          left join admin_members m on m.whop_user_id = r->>'whop_user_id'
         where coalesce(r->>'whop_user_id', '') <> ''
           and (m.whop_user_id is null
                or m.status is distinct from coalesce(r->>'status', '')
                or m.plan_id is distinct from coalesce(r->>'plan_id', ''));
    end if;

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

-- ── Pläne ───────────────────────────────────────────────────────────────────────
-- Gepflegte Plaene plus Plan-IDs, die Mitglieder haben, aber noch keinen Betrag
create or replace function sync_admin_plans_list()
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select jsonb_build_object(
        'plans', coalesce((select jsonb_agg(to_jsonb(p) order by p.plan_id) from admin_plans p), '[]'::jsonb),
        'ohne_betrag', coalesce((select jsonb_agg(jsonb_build_object('plan_id', x.plan_id, 'mitglieder', x.n) order by x.n desc)
                                   from (select plan_id, count(*) n from admin_members
                                          where plan_id <> '' and status = 'active'
                                            and plan_id not in (select plan_id from admin_plans)
                                          group by plan_id) x), '[]'::jsonb))
$$;

create or replace function sync_admin_plan_save(p_plan text, p_label text, p_cents integer, p_ctx jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_before jsonb; v_after jsonb;
begin
    select to_jsonb(p) - 'updated_at' into v_before from admin_plans p where plan_id = p_plan;
    insert into admin_plans (plan_id, label, monthly_cents) values (p_plan, left(coalesce(p_label, ''), 60), p_cents)
    on conflict (plan_id) do update set label = excluded.label, monthly_cents = excluded.monthly_cents, updated_at = now()
    returning to_jsonb(admin_plans) - 'updated_at' into v_after;
    perform sync_admin_audit_intern(p_ctx, 'plans.save', 'plan', p_plan, v_before, v_after);
    return v_after;
end $$;

-- ── Tagesberechnung ─────────────────────────────────────────────────────────────
create or replace function sync_admin_metrics_compute(p_ctx jsonb, p_audit boolean)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_today date := (now() at time zone 'Europe/Berlin')::date; v_ev record; v_ohne integer;
begin
    -- Reihen der letzten 90 Tage aus den Daten (idempotent)
    insert into admin_daily_metrics (day, signups, revenue_cents, failed_payments)
    select d::date, coalesce(s.n, 0), coalesce(p.rev, 0), coalesce(p.fail, 0)
      from generate_series(v_today - 89, v_today, interval '1 day') d
      left join (select (signup_at at time zone 'Europe/Berlin')::date dd, count(*) n
                   from admin_members where signup_at is not null group by 1) s on s.dd = d::date
      left join (select (coalesce(paid_at, created_at) at time zone 'Europe/Berlin')::date dd,
                        sum(amount_cents - refunded_cents) filter (where not failed) rev,
                        count(*) filter (where failed) fail
                   from admin_payments group by 1) p on p.dd = d::date
    on conflict (day) do update set
        signups = excluded.signups, revenue_cents = excluded.revenue_cents, failed_payments = excluded.failed_payments;

    -- Ereignisse des heutigen Tages
    select
        coalesce(sum(coalesce(tm, 0)) filter (where to_status = 'active' and coalesce(from_status, '') not in ('active', 'past_due')), 0) as neu,
        coalesce(sum(tm - fm) filter (where from_status = 'active' and to_status = 'active' and coalesce(tm, 0) > coalesce(fm, 0)), 0) as erw,
        coalesce(sum(fm - tm) filter (where from_status = 'active' and to_status = 'active' and coalesce(tm, 0) < coalesce(fm, 0)), 0) as rueck,
        coalesce(sum(coalesce(fm, 0)) filter (where from_status in ('active', 'past_due') and to_status not in ('active', 'past_due')), 0) as weg,
        count(*) filter (where from_status in ('active', 'past_due') and to_status not in ('active', 'past_due')) as logos,
        count(*) filter (where from_status = 'trialing' and to_status = 'active') as umstieg,
        count(*) filter (where from_status = 'trialing' and to_status not in ('active', 'trialing', 'past_due')) as verloren
      into v_ev
      from (select e.from_status, e.to_status,
                   coalesce((select monthly_cents from admin_plans where plan_id = e.from_plan), 0) as fm,
                   coalesce((select monthly_cents from admin_plans where plan_id = e.to_plan), 0) as tm
              from admin_status_events e
             where (e.ts at time zone 'Europe/Berlin')::date = v_today) x;

    update admin_daily_metrics set
        computed_at = now(),
        mrr_cents = (select coalesce(sum(pl.monthly_cents), 0) from admin_members m
                      join admin_plans pl on pl.plan_id = m.plan_id where m.status = 'active'),
        active   = (select count(*) from admin_members where status = 'active'),
        trialing = (select count(*) from admin_members where status = 'trialing'),
        past_due = (select count(*) from admin_members where status = 'past_due'),
        canceled = (select count(*) from admin_members where status in ('canceled', 'expired', 'completed')),
        new_mrr_cents = v_ev.neu, expansion_cents = v_ev.erw, contraction_cents = v_ev.rueck,
        churned_cents = v_ev.weg, churned_logos = v_ev.logos,
        trial_conversions = v_ev.umstieg, trial_lost = v_ev.verloren,
        dau = (select count(distinct user_id) from sync_snapshots where updated_at >= now() - interval '1 day'),
        wau = (select count(distinct user_id) from sync_snapshots where updated_at >= now() - interval '7 days'),
        mau = (select count(distinct user_id) from sync_snapshots where updated_at >= now() - interval '30 days')
     where day = v_today;

    select count(distinct plan_id) into v_ohne from admin_members
     where status = 'active' and plan_id <> '' and plan_id not in (select plan_id from admin_plans);

    if p_audit then
        perform sync_admin_audit_intern(p_ctx, 'metrics.compute', 'metrics', v_today::text, null, null);
    end if;
    return jsonb_build_object('day', v_today, 'plaene_ohne_betrag', v_ohne);
end $$;

-- ── Kennzahlen eines Zeitraums ──────────────────────────────────────────────────
create or replace function sync_admin_kpis(p_a date, p_b date)
returns jsonb language sql stable set search_path = public, pg_temp as $$
    with ende as (select * from admin_daily_metrics where day <= p_b and mrr_cents is not null order by day desc limit 1),
         anfang as (select * from admin_daily_metrics where day < p_a and mrr_cents is not null order by day desc limit 1),
         s as (select coalesce(sum(new_mrr_cents), 0) neu, coalesce(sum(expansion_cents), 0) erw,
                      coalesce(sum(contraction_cents), 0) rueck, coalesce(sum(churned_cents), 0) weg,
                      coalesce(sum(churned_logos), 0) logos, coalesce(sum(trial_conversions), 0) umstieg,
                      coalesce(sum(trial_lost), 0) verloren, coalesce(sum(signups), 0) signups,
                      coalesce(sum(revenue_cents), 0) umsatz, coalesce(sum(failed_payments), 0) fehl
                 from admin_daily_metrics where day between p_a and p_b)
    select jsonb_build_object(
        'mrr_cents',        (select mrr_cents from ende),
        'arr_cents',        (select mrr_cents * 12 from ende),
        'mrr_start_cents',  (select mrr_cents from anfang),
        'active',           (select active from ende),
        'neu_cents',        s.neu, 'erweiterung_cents', s.erw, 'rueckgang_cents', s.rueck, 'verloren_cents', s.weg,
        'net_new_mrr_cents', s.neu + s.erw - s.rueck - s.weg,
        'logo_churn',       s.logos::numeric / nullif((select active from anfang), 0),
        'revenue_churn',    s.weg::numeric / nullif((select mrr_cents from anfang), 0),
        'kuendiger',        s.logos,
        'arpu_cents',       (select (mrr_cents::numeric / nullif(active, 0)) from ende),
        'dau', (select dau from ende), 'wau', (select wau from ende), 'mau', (select mau from ende),
        'trial_conversion', s.umstieg::numeric / nullif(s.umstieg + s.verloren, 0),
        'signups',          s.signups, 'umsatz_cents', s.umsatz, 'fehlgeschlagen', s.fehl)
      from s
$$;

create or replace function sync_admin_dashboard(p_from date, p_to date)
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select jsonb_build_object(
        'aktuell',   sync_admin_kpis(p_from, p_to),
        'vorher',    sync_admin_kpis(p_from - (p_to - p_from + 1), p_from - 1),
        'reihe',     coalesce((select jsonb_agg(to_jsonb(d) - 'computed_at' order by d.day)
                                 from admin_daily_metrics d where d.day between p_from and p_to), '[]'::jsonb),
        'berechnet', (select max(computed_at) from admin_daily_metrics))
$$;

-- Kohorten nach Anmeldemonat: wie viele sind HEUTE noch aktiv (keine Verlaufsmatrix, siehe Kopf)
create or replace function sync_admin_cohorts()
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select coalesce(jsonb_agg(jsonb_build_object('monat', to_char(mon, 'YYYY-MM'), 'gesamt', gesamt, 'aktiv', aktiv)
                              order by mon desc), '[]'::jsonb)
      from (select date_trunc('month', signup_at at time zone 'Europe/Berlin') mon, count(*) gesamt,
                   count(*) filter (where status in ('active', 'trialing', 'past_due')) aktiv
              from admin_members where signup_at is not null
             group by 1 order by 1 desc limit 24) x
$$;

-- ── Feature-Flags ───────────────────────────────────────────────────────────────
-- status: off = fuer alle aus | on = fuer alle an | rules = nach Regeln (Nutzer, Konten, Plaene, Prozent)
-- killed: Notaus, schlaegt alles andere. Auswertung: api/_flags.js (stabiler Hash je key + Nutzer).
create table if not exists admin_flags (
    key         text        primary key check (key ~ '^[a-z0-9][a-z0-9._-]{1,62}$'),
    description text        not null default '',
    status      text        not null default 'off' check (status in ('off', 'rules', 'on')),
    killed      boolean     not null default false,
    percent     integer     not null default 0 check (percent between 0 and 100),
    user_ids    text[]      not null default '{}',
    account_ids text[]      not null default '{}',
    plan_ids    text[]      not null default '{}',
    updated_at  timestamptz not null default now()
);
alter table admin_flags enable row level security;

create or replace function sync_admin_flags_list()
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select coalesce(jsonb_agg(to_jsonb(f) order by f.key), '[]'::jsonb) from admin_flags f
$$;

create or replace function sync_admin_flag_save(
    p_key text, p_desc text, p_status text, p_percent integer,
    p_users text[], p_accounts text[], p_plans text[], p_ctx jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_before jsonb; v_after jsonb;
begin
    select to_jsonb(f) - 'updated_at' into v_before from admin_flags f where key = p_key;
    insert into admin_flags (key, description, status, percent, user_ids, account_ids, plan_ids)
    values (p_key, left(coalesce(p_desc, ''), 300), p_status, p_percent,
            coalesce(p_users, '{}'), coalesce(p_accounts, '{}'), coalesce(p_plans, '{}'))
    on conflict (key) do update set
        description = excluded.description, status = excluded.status, percent = excluded.percent,
        user_ids = excluded.user_ids, account_ids = excluded.account_ids, plan_ids = excluded.plan_ids,
        updated_at = now()
    returning to_jsonb(admin_flags) - 'updated_at' into v_after;
    perform sync_admin_audit_intern(p_ctx, case when v_before is null then 'flags.create' else 'flags.update' end,
                                    'flag', p_key, v_before, v_after);
    return v_after;
end $$;

create or replace function sync_admin_flag_kill(p_key text, p_killed boolean, p_ctx jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_old boolean;
begin
    select killed into v_old from admin_flags where key = p_key for update;
    if not found then return null; end if;
    update admin_flags set killed = p_killed, updated_at = now() where key = p_key;
    perform sync_admin_audit_intern(p_ctx, case when p_killed then 'flags.kill' else 'flags.unkill' end, 'flag', p_key,
                                    jsonb_build_object('killed', v_old), jsonb_build_object('killed', p_killed));
    return jsonb_build_object('killed', p_killed);
end $$;

-- ── Rechte ──────────────────────────────────────────────────────────────────────
revoke all on admin_plans, admin_status_events, admin_daily_metrics, admin_flags from public, anon, authenticated;
revoke all on sequence admin_status_events_id_seq from public, anon, authenticated;
revoke all on function sync_admin_plans_list()                                  from public, anon, authenticated;
revoke all on function sync_admin_plan_save(text, text, integer, jsonb)         from public, anon, authenticated;
revoke all on function sync_admin_metrics_compute(jsonb, boolean)               from public, anon, authenticated;
revoke all on function sync_admin_kpis(date, date)                              from public, anon, authenticated;
revoke all on function sync_admin_dashboard(date, date)                         from public, anon, authenticated;
revoke all on function sync_admin_cohorts()                                     from public, anon, authenticated;
revoke all on function sync_admin_flags_list()                                  from public, anon, authenticated;
revoke all on function sync_admin_flag_save(text, text, text, integer, text[], text[], text[], jsonb) from public, anon, authenticated;
revoke all on function sync_admin_flag_kill(text, boolean, jsonb)               from public, anon, authenticated;
grant select, insert, update, delete on admin_plans, admin_status_events, admin_daily_metrics, admin_flags to service_role;
grant usage on sequence admin_status_events_id_seq to service_role;
grant execute on function sync_admin_plans_list()                                  to service_role;
grant execute on function sync_admin_plan_save(text, text, integer, jsonb)         to service_role;
grant execute on function sync_admin_metrics_compute(jsonb, boolean)               to service_role;
grant execute on function sync_admin_kpis(date, date)                              to service_role;
grant execute on function sync_admin_dashboard(date, date)                         to service_role;
grant execute on function sync_admin_cohorts()                                     to service_role;
grant execute on function sync_admin_flags_list()                                  to service_role;
grant execute on function sync_admin_flag_save(text, text, text, integer, text[], text[], text[], jsonb) to service_role;
grant execute on function sync_admin_flag_kill(text, boolean, jsonb)               to service_role;
