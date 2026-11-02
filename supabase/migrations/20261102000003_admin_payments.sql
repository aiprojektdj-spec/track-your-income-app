-- Stackr Admin-Panel — Phase c: Zahlungen (nur Anzeige, Whop nur lesend)
-- =============================================================================
-- Nach 20261102000002_admin_members.sql. Zugriff nur ueber den Service-Key (RLS an, keine Policy).
--
-- admin_payments: Spiegel der Whop-Zahlungen, per Knopfdruck abgeglichen (admin/api/payments-sync.js).
--   Keine Kartendaten ausser Marke und letzte 4 Ziffern (so liefert Whop sie). Betraege in Cent.
--   Das Panel hat KEINEN schreibenden Whop-Zugriff (Entscheidung User 2026-11-02): Erstattung und
--   Kuendigung passieren im Whop-Dashboard.
-- =============================================================================

create table if not exists admin_payments (
    id              text        primary key,
    whop_user_id    text        not null default '',
    membership_id   text        not null default '',
    status          text        not null default '',
    failed          boolean     not null default false,
    failure_message text        not null default '',
    amount_cents    bigint      not null default 0,
    refunded_cents  bigint      not null default 0,
    currency        text        not null default '',
    card_brand      text        not null default '',
    card_last4      text        not null default '',
    created_at      timestamptz,
    paid_at         timestamptz,
    last_sync_at    timestamptz not null default now()
);
create index if not exists admin_payments_user   on admin_payments (whop_user_id, created_at desc);
create index if not exists admin_payments_failed on admin_payments (created_at desc) where failed;

alter table admin_payments enable row level security;

-- p_rows: [{ id, whop_user_id, membership_id, status, failed, failure_message, amount_cents,
--            refunded_cents, currency, card_brand, card_last4, created_at, paid_at }]
create or replace function sync_admin_payments_upsert(p_rows jsonb, p_ctx jsonb, p_audit boolean)
returns integer language plpgsql set search_path = public, pg_temp as $$
declare n integer;
begin
    insert into admin_payments (id, whop_user_id, membership_id, status, failed, failure_message,
                                amount_cents, refunded_cents, currency, card_brand, card_last4,
                                created_at, paid_at, last_sync_at)
    select r->>'id', coalesce(r->>'whop_user_id', ''), coalesce(r->>'membership_id', ''),
           coalesce(r->>'status', ''), coalesce((r->>'failed')::boolean, false),
           left(coalesce(r->>'failure_message', ''), 300),
           coalesce((r->>'amount_cents')::bigint, 0), coalesce((r->>'refunded_cents')::bigint, 0),
           left(coalesce(r->>'currency', ''), 8), left(coalesce(r->>'card_brand', ''), 30),
           left(coalesce(r->>'card_last4', ''), 4),
           nullif(r->>'created_at', '')::timestamptz, nullif(r->>'paid_at', '')::timestamptz, now()
      from jsonb_array_elements(p_rows) r
     where coalesce(r->>'id', '') <> ''
    on conflict (id) do update set
        whop_user_id = excluded.whop_user_id, membership_id = excluded.membership_id,
        status = excluded.status, failed = excluded.failed, failure_message = excluded.failure_message,
        amount_cents = excluded.amount_cents, refunded_cents = excluded.refunded_cents,
        currency = excluded.currency, card_brand = excluded.card_brand, card_last4 = excluded.card_last4,
        created_at = excluded.created_at, paid_at = excluded.paid_at, last_sync_at = now();
    get diagnostics n = row_count;

    if p_audit then
        perform sync_admin_audit_intern(p_ctx, 'payments.sync', 'payments', '', null, jsonb_build_object('rows', n));
    end if;
    return n;
end $$;

-- Zahlungen eines Mitglieds (neueste zuerst) plus Summen
create or replace function sync_admin_payments_for(p_id text)
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select jsonb_build_object(
        'payments', coalesce((select jsonb_agg(to_jsonb(p) - 'last_sync_at' order by p.created_at desc nulls last)
                                from (select * from admin_payments where whop_user_id = p_id
                                       order by created_at desc nulls last limit 100) p), '[]'::jsonb),
        'summe', jsonb_build_object(
            'bezahlt_cents',   coalesce((select sum(amount_cents - refunded_cents) from admin_payments
                                          where whop_user_id = p_id and not failed), 0),
            'erstattet_cents', coalesce((select sum(refunded_cents) from admin_payments where whop_user_id = p_id), 0),
            'fehlgeschlagen',  (select count(*) from admin_payments where whop_user_id = p_id and failed)),
        'zuletzt_abgeglichen', (select max(last_sync_at) from admin_payments))
$$;

-- Mahnliste: ueberfaellige Mitgliedschaften und fehlgeschlagene Zahlungen der letzten 30 Tage
create or replace function sync_admin_dunning()
returns jsonb language sql stable set search_path = public, pg_temp as $$
    select jsonb_build_object(
        'past_due', coalesce((select jsonb_agg(jsonb_build_object(
                'whop_user_id', m.whop_user_id, 'email', m.email, 'name', m.name, 'status', m.status,
                'letzte_zahlung', (select max(p.paid_at) from admin_payments p where p.whop_user_id = m.whop_user_id and not p.failed))
                order by m.name) from admin_members m where m.status = 'past_due'), '[]'::jsonb),
        'failed', coalesce((select jsonb_agg(x order by x.created_at desc) from (
                select p.id, p.whop_user_id, p.failure_message, p.amount_cents, p.currency, p.created_at,
                       p.card_brand, p.card_last4, m.email, m.name
                  from admin_payments p left join admin_members m on m.whop_user_id = p.whop_user_id
                 where p.failed and p.created_at > now() - interval '30 days'
                 order by p.created_at desc limit 200) x), '[]'::jsonb),
        'zuletzt_abgeglichen', (select max(last_sync_at) from admin_payments))
$$;

-- ── Rechte ──────────────────────────────────────────────────────────────────────
revoke all on admin_payments from public, anon, authenticated;
revoke all on function sync_admin_payments_upsert(jsonb, jsonb, boolean) from public, anon, authenticated;
revoke all on function sync_admin_payments_for(text)                     from public, anon, authenticated;
revoke all on function sync_admin_dunning()                              from public, anon, authenticated;
grant select, insert, update, delete on admin_payments to service_role;
grant execute on function sync_admin_payments_upsert(jsonb, jsonb, boolean) to service_role;
grant execute on function sync_admin_payments_for(text)                     to service_role;
grant execute on function sync_admin_dunning()                              to service_role;
