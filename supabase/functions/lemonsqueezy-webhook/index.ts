// ================================================================
// Stackr — LemonSqueezy Webhook Handler
// Supabase Edge Function (Deno)
//
// Events handled:
//   subscription_created  → Pro-Abo aktivieren
//   subscription_updated  → Status aktualisieren
//   subscription_resumed  → Reaktivieren
//   subscription_cancelled→ Läuft bis Periodenende
//   subscription_expired  → Abo abgelaufen
//   subscription_paused   → Abo pausiert
//
// Setup:
//   1. supabase functions deploy lemonsqueezy-webhook
//   2. In LemonSqueezy Dashboard → Webhooks → neue URL:
//      https://[DEIN-PROJECT-ID].supabase.co/functions/v1/lemonsqueezy-webhook
//   3. Secret aus LemonSqueezy kopieren → Supabase → Settings → Secrets:
//      LEMONSQUEEZY_WEBHOOK_SECRET = <dein-secret>
// ================================================================

import { serve }         from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient }  from "https://esm.sh/@supabase/supabase-js@2";

// ── Env-Variablen ──────────────────────────────────────────────
const WEBHOOK_SECRET       = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ── HMAC-SHA256 Signatur-Prüfung ───────────────────────────────
async function verifySignature(body: string, signature: string): Promise<boolean> {
    if (!WEBHOOK_SECRET) return false; // Kein Secret → immer ablehnen (nie im Dev-Mode deployen)
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(WEBHOOK_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    const hex = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    return hex === signature;
}

// ── LemonSqueezy Status → eigener Status ──────────────────────
const STATUS_MAP: Record<string, string> = {
    active:    "active",
    on_trial:  "active",
    cancelled: "cancelled",
    paused:    "paused",
    past_due:  "past_due",
    expired:   "expired",
    unpaid:    "past_due",
};

// ── Webhook Handler ────────────────────────────────────────────
serve(async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    const body      = await req.text();
    const signature = req.headers.get("x-signature") ?? "";

    // Signatur prüfen
    if (!(await verifySignature(body, signature))) {
        console.error("[Webhook] Ungültige Signatur");
        return new Response("Invalid signature", { status: 401 });
    }

    // JSON parsen
    let event: Record<string, any>;
    try {
        event = JSON.parse(body);
    } catch {
        return new Response("Invalid JSON", { status: 400 });
    }

    const eventName  = String(event?.meta?.event_name ?? "");
    const attributes = event?.data?.attributes ?? {};
    const customData = event?.meta?.custom_data  ?? {};

    // user_id kommt aus checkout[custom][user_id] (wird in user-plan.js mitgeschickt)
    const userId = String(customData?.user_id ?? "");

    console.log("[Webhook] Event:", eventName, "| user_id:", userId || "(leer)");

    // Nur Subscription-Events verarbeiten
    const handledEvents = [
        "subscription_created",
        "subscription_updated",
        "subscription_resumed",
        "subscription_cancelled",
        "subscription_expired",
        "subscription_paused",
    ];

    if (!handledEvents.includes(eventName)) {
        return new Response(
            JSON.stringify({ received: true, skipped: eventName }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }

    if (!userId) {
        console.warn("[Webhook] Kein user_id in custom_data — Abo kann nicht zugeordnet werden");
        return new Response(
            JSON.stringify({ received: true, warning: "no user_id" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }

    // Subscription-Daten extrahieren
    const subscriptionId = String(event?.data?.id ?? "");
    const customerId     = String(attributes.customer_id ?? "");
    const variantId      = String(attributes.variant_id ?? "");
    const orderId        = String(attributes.order_id ?? "");

    const lsStatus = String(attributes.status ?? "active");
    const status   = STATUS_MAP[lsStatus] ?? lsStatus;

    // Ablaufdatum: renews_at (aktiv), ends_at (cancelled), trial_ends_at (trial)
    const periodEnd: string | null =
        attributes.renews_at     ??
        attributes.ends_at       ??
        attributes.trial_ends_at ??
        null;

    // Supabase-Client mit service_role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        if (["subscription_created", "subscription_updated", "subscription_resumed"].includes(eventName)) {
            // Abo anlegen oder aktualisieren
            const { error } = await supabase
                .from("subscriptions")
                .upsert(
                    {
                        user_id:                       userId,
                        plan:                          "pro",
                        status,
                        current_period_end:            periodEnd,
                        lemonsqueezy_subscription_id:  subscriptionId,
                        lemonsqueezy_customer_id:      customerId,
                        lemonsqueezy_order_id:         orderId,
                        variant_id:                    variantId,
                        updated_at:                    new Date().toISOString(),
                    },
                    { onConflict: "lemonsqueezy_subscription_id" }
                );

            if (error) throw error;
            console.log("[Webhook] Abo upserted:", subscriptionId, "→", status);

        } else {
            // Stornierung / Ablauf / Pause: Status + Enddatum aktualisieren
            const { error } = await supabase
                .from("subscriptions")
                .update({
                    status,
                    current_period_end: periodEnd,
                    updated_at:         new Date().toISOString(),
                })
                .eq("lemonsqueezy_subscription_id", subscriptionId);

            if (error) throw error;
            console.log("[Webhook] Abo aktualisiert:", subscriptionId, "→", status);
        }

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Webhook] DB-Fehler:", msg);
        return new Response(
            JSON.stringify({ error: msg }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(
        JSON.stringify({ received: true, event: eventName, user: userId, status }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
});
