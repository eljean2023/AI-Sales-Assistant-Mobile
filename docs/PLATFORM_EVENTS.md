# Platform Events — Global Super Admin Notification System

Status: **implemented** in `C:\Users\XJE\Desktop\AI-Sales-Assistant` (core
system + all 16 event types wired at their real call sites, except two
deliberately deferred cases — see §9). Push delivery itself is a structural
stub pending the separate mobile-auth/device-registration work — see
`docs/BACKEND_REQUIREMENTS.md`.
Audience: whoever implements this inside the `AI-Sales-Assistant` (Next.js) project.

Purpose: let the Super Admin monitor the health and growth of the SaaS in
real time via push notifications on the AI Sales Assistant Mobile app, for
platform-wide business events — completely independent of any tenant's own
notification system or settings.

---

## 1. Why this can't just reuse the existing "event" pattern as-is

Investigated directly in `C:\Users\XJE\Desktop\AI-Sales-Assistant`. There is
**no event bus, emitter, or job queue anywhere in this codebase.** Every
"event" today is a direct, synchronous function call at the exact code path
that causes it (e.g. the Stripe webhook switch calls a local `logActivity()`
helper inline). At least two independent copies of that helper already exist
(`lib/stripe/webhookHandlers.ts` and
`app/dashboard/super-admin/subscriptions/customers/actions.ts`).

Requirements here ask for two things that are in tension with that pattern:
"use the same event-driven architecture" and "extensible without modifying
existing flows." Direct calls are exactly what makes today's code *not*
extensible — adding a new side effect means editing the call site. Satisfying
both requires exactly **one** new piece of shared infrastructure: a minimal
in-process event emitter. Everything downstream of it reuses existing
conventions (Prisma model shapes, the `MobileDevice` table from the mobile
device-registration spec, the "never let a notification failure roll back the
real transaction" resilience pattern already used for `sendWelcomeEmail`).

---

## 2. Architecture

```
 Existing code paths                    New shared infra                Delivery (isolated)
 ───────────────────                    ─────────────────                ───────────────────
 registerAction()          ──┐
 Stripe webhook handlers   ──┤          emitPlatformEvent(type, metadata)
 changePlan() /            ──┤   ──►     ├─ 1. render title/body via template
   changeMyPlanAction()     │            │    registry, write PlatformEvent row
 suspend/reactivate         │            │    (durable audit ledger)
   actions                  │            └─ 2. fan out push            ──► MobileDevice rows
 webhook route catch        ──┤                to Super Admin devices       WHERE user.role
 new: cron reconciler      ──┤                                              = SUPER_ADMIN
   (trial expiry)           │                                                (no companyId filter,
 new: catch blocks for     ──┘                                               no tenant settings read)
   critical errors
```

### 2.1 Data model

```prisma
model PlatformEvent {
  id         String                @id @default(cuid())
  type       PlatformEventType
  priority   PlatformEventPriority
  category   PlatformEventCategory
  title      String                // rendered once at emit time, stored as a snapshot
  body       String?                // same — historical rows read correctly even if templates change later
  metadata   Json?                  // raw structured facts (companyName, amount, planCode, ...) for programmatic use
  companyId  String?                // context only, e.g. "which company this is about" — never used for access control
  createdAt  DateTime               @default(now())

  @@index([type])
  @@index([priority])
  @@index([category])
  @@index([createdAt])
}

enum PlatformEventType {
  COMPANY_REGISTERED
  USER_REGISTERED
  TRIAL_STARTED
  TRIAL_CONVERTED_TO_PAID
  TRIAL_EXPIRED
  SUBSCRIPTION_PURCHASED
  SUBSCRIPTION_UPGRADED
  SUBSCRIPTION_DOWNGRADED
  SUBSCRIPTION_RENEWED
  PAYMENT_SUCCEEDED
  PAYMENT_FAILED
  SUBSCRIPTION_CANCELED
  COMPANY_SUSPENDED
  COMPANY_REACTIVATED
  WEBHOOK_FAILED
  SYSTEM_ERROR
}

enum PlatformEventPriority {
  INFO
  SUCCESS
  WARNING
  ERROR
  CRITICAL
}

enum PlatformEventCategory {
  BUSINESS
  PAYMENT
  SYSTEM
  SECURITY
}
```

Priority and category are **fixed per event type**, not caller-supplied — see
§2.3.1. This keeps the classification consistent (every `PAYMENT_FAILED` row
is always `WARNING`/`PAYMENT`, never accidentally miscategorized by a
call site) and means adding a new event type is still just one enum value
plus one registry entry, not a new decision repeated at every call site.

Deliberately a **separate table from `ActivityLog`**, not more rows in it.
`ActivityLog`'s tenant scoping is 100% manual convention (`where: {
companyId }` written by hand at each call site, no Prisma middleware
enforcing it) — confirmed by reading `lib/prisma.ts` (a plain, unwrapped
`PrismaClient` singleton) and `lib/leads/queries.ts` (`getRecentActivity`
filters by `companyId`; `getGlobalRecentActivity` doesn't, by convention, not
by any structural guarantee). Mixing `WEBHOOK_FAILED`/`SYSTEM_ERROR` entries
into that same table and enum risks one future missing `where` clause leaking
"Stripe webhook failed for Company X" into Company X's own activity feed. A
physically separate table makes that structurally impossible instead of
relying on convention — this is what "completely isolated from customer
notifications" means concretely.

### 2.2 The emitter — the one new piece of shared infrastructure

```ts
// lib/platform-events/emit.ts
type PlatformEventInput = {
  type: PlatformEventType;
  companyId?: string;
  metadata?: Record<string, unknown>;
};

type RenderedPlatformEvent = {
  title: string;
  body?: string;
  priority: PlatformEventPriority;
  category: PlatformEventCategory;
};

const handlers: Array<(e: PlatformEventInput, rendered: RenderedPlatformEvent) => Promise<void>> = [
  writePlatformEventRecord,
  deliverToSuperAdminDevices,
  // future: add a Slack/email/analytics handler here — one line, nothing else changes
];

export async function emitPlatformEvent(event: PlatformEventInput) {
  const rendered = renderPlatformEvent(event.type, event.metadata ?? {});
  await Promise.allSettled(handlers.map((h) => h(event, rendered)));
}
```

`Promise.allSettled` (not `Promise.all`) is deliberate: a push-delivery
failure must never throw back into the Stripe webhook transaction or the
registration action that triggered it. Same resilience posture as the
existing `sendWelcomeEmail` failure handling (best-effort, `console.error`'d,
never blocks the caller) — satisfies "must not interfere with existing
tenant notification system or billing logic."

### 2.3 Event registry (copy + priority + category, one source of truth)

Callers pass structured facts only; one registry — keyed by event type —
supplies the copy template *and* its priority/category together. This is
deliberately a single map, not three parallel ones (templates / priorities /
categories) that could drift out of sync as events are added. A new event
type is "add an enum value + one registry entry," never a change to an
existing call site.

```ts
// lib/platform-events/registry.ts — the only place copy + classification live
type PlatformEventDefinition = {
  priority: PlatformEventPriority;
  category: PlatformEventCategory;
  render: (m: any) => { title: string; body?: string };
};

const registry: Record<PlatformEventType, PlatformEventDefinition> = {
  COMPANY_REGISTERED: {
    priority: "INFO", category: "BUSINESS",
    render: (m) => ({ title: `New company registered: ${m.companyName}` }),
  },
  USER_REGISTERED: {
    priority: "INFO", category: "BUSINESS",
    render: (m) => ({ title: `New user registered: ${m.email}` }),
  },
  TRIAL_STARTED: {
    priority: "INFO", category: "BUSINESS",
    render: (m) => ({ title: `New trial started: ${m.companyName}` }),
  },
  TRIAL_CONVERTED_TO_PAID: {
    priority: "SUCCESS", category: "BUSINESS",
    render: (m) => ({
      title: `🎉 Trial Converted to Paid`,
      body: `Company: ${m.companyName}\nPlan: ${m.planName}\nMRR: +$${m.mrrDelta}/month`,
    }),
  },
  TRIAL_EXPIRED: {
    priority: "WARNING", category: "BUSINESS",
    render: (m) => ({ title: `Trial expired: ${m.companyName}` }),
  },
  SUBSCRIPTION_PURCHASED: {
    priority: "SUCCESS", category: "PAYMENT",
    render: (m) => ({ title: `New ${m.planName} subscription purchased.`, body: m.companyName }),
  },
  SUBSCRIPTION_UPGRADED: {
    priority: "SUCCESS", category: "PAYMENT",
    render: (m) => ({ title: `Subscription upgraded: ${m.companyName}`, body: `${m.oldPlanName} → ${m.newPlanName}` }),
  },
  SUBSCRIPTION_DOWNGRADED: {
    priority: "WARNING", category: "PAYMENT",
    render: (m) => ({ title: `Subscription downgraded: ${m.companyName}`, body: `${m.oldPlanName} → ${m.newPlanName}` }),
  },
  SUBSCRIPTION_RENEWED: {
    priority: "SUCCESS", category: "PAYMENT",
    render: (m) => ({ title: `Subscription renewed: ${m.companyName}`, body: m.planName }),
  },
  PAYMENT_SUCCEEDED: {
    priority: "SUCCESS", category: "PAYMENT",
    render: (m) => ({ title: `Payment received: $${m.amount}`, body: m.companyName }),
  },
  PAYMENT_FAILED: {
    priority: "WARNING", category: "PAYMENT",
    render: (m) => ({ title: `Payment failed for ${m.companyName}.` }),
  },
  SUBSCRIPTION_CANCELED: {
    priority: "WARNING", category: "PAYMENT",
    render: (m) => ({ title: `Subscription canceled: ${m.companyName}` }),
  },
  COMPANY_SUSPENDED: {
    priority: "WARNING", category: "SECURITY",
    render: (m) => ({ title: `Company suspended: ${m.companyName}` }),
  },
  COMPANY_REACTIVATED: {
    priority: "INFO", category: "SECURITY",
    render: (m) => ({ title: `Company reactivated: ${m.companyName}` }),
  },
  WEBHOOK_FAILED: {
    priority: "ERROR", category: "SYSTEM",
    render: (m) => ({ title: `Webhook processing failed: ${m.eventType}`, body: m.eventId }),
  },
  SYSTEM_ERROR: {
    priority: "CRITICAL", category: "SYSTEM",
    render: (m) => ({ title: `Critical error: ${m.summary}` }),
  },
};

export function renderPlatformEvent(type: PlatformEventType, metadata: Record<string, unknown>) {
  const def = registry[type];
  return { ...def.render(metadata), priority: def.priority, category: def.category };
}
```

The rendered `{title, body, priority, category}` is stored on the
`PlatformEvent` row (a snapshot, same convention `ActivityLog.message`
already uses — a stored string, not a live template reference) and reused as
the push payload. `COMPANY_SUSPENDED`/`COMPANY_REACTIVATED` are classified
`SECURITY` rather than `BUSINESS` since they represent an access-control
action on a tenant, not a growth metric — open to reclassifying if you'd
rather group all company-lifecycle events under `BUSINESS`.

### 2.4 Delivery — structurally isolated from tenant notifications

```ts
async function deliverToSuperAdminDevices(_event, rendered: { title: string; body?: string }) {
  const devices = await prisma.mobileDevice.findMany({
    where: { isActive: true, user: { role: "SUPER_ADMIN" } },
  });
  // push each device with `rendered` — distinct delivery function from
  // broadcastUniversalPush: no companyId parameter, no UniversalPushSubscription,
  // no tenant Notification/preferences table read anywhere in this path.
}
```

Reuses the `MobileDevice` table from the mobile device-registration spec (a
Super Admin logs into the same mobile app and registers a device the same
way as any tenant user) — reusing storage, not reusing the targeting/delivery
*logic*, which stays fully separate from `broadcastUniversalPush` /
`notifyHotLead` / `notifyDemoBooked`. There is no `companyId` filter and no
tenant table read in this path, so there is structurally nothing for a
tenant's notification settings to gate.

---

## 3. Event → trigger-point map (verified against the actual code)

| # | Event | Trigger point | Status |
|---|---|---|---|
| 1 | Company registered | `registerAction` (`app/(auth)/actions.ts`) | existing |
| 2 | User registered | `registerAction` + team-invite acceptance | existing |
| 3 | Trial started | wherever `Company.subscriptionStatus` → `TRIAL` | existing |
| 4 | Trial expired | proactive sweep, see §4 | **new: cron job** |
| 5 | Subscription purchased | `checkout.session.completed` / `customer.subscription.created` (`lib/stripe/webhookHandlers.ts`) | existing |
| 5a | **Trial converted to paid** | Same `handleCheckoutSessionCompleted` (`lib/stripe/webhookHandlers.ts:44-134`) — the `company` row is fetched at line 59, *before* the status is overwritten to `ACTIVE` at line 98. If `company.subscriptionStatus === "TRIAL"` at that point, emit `TRIAL_CONVERTED_TO_PAID` instead of `SUBSCRIPTION_PURCHASED`; otherwise emit `SUBSCRIPTION_PURCHASED` (fresh signup or a lapsed customer resubscribing, not a trial conversion). | existing call site, **new before/after check** (see §5) |
| 6 | Subscription upgraded | `changePlan()` (`app/dashboard/super-admin/subscriptions/customers/actions.ts:138`) + `changeMyPlanAction()` (`app/dashboard/billing/manage-actions.ts:118`) | existing call sites, **new shared direction helper** (see §5) |
| 7 | Subscription downgraded | same two call sites | same new helper |
| 8 | Subscription renewed | `invoice.payment_succeeded` | **new Stripe case + endpoint config** (see §5) |
| 9 | Payment succeeded | same new case | **new Stripe case + endpoint config** |
| 10 | Payment failed | `invoice.payment_failed` (`handleInvoicePaymentFailed`) | existing |
| 11 | Subscription canceled | `customer.subscription.deleted`, `cancelCustomerAction` (`customers/actions.ts:106`), `cancelMySubscriptionAction` (`manage-actions.ts:24`) | existing (3 call sites) |
| 12 | Company suspended | `suspendCustomerAction` (`customers/actions.ts:38-64`) | existing |
| 13 | Company reactivated | `reactivateCustomerAction` (`customers/actions.ts:69-101`), `reactivateMySubscriptionAction` (`manage-actions.ts:68-116`) | existing (2 call sites) |
| 14 | Webhook failed | `app/api/webhooks/stripe/route.ts:43-44` — the fall-through **after** the benign P2002-concurrent-retry check (line 39-42), which is a race, not a failure, and must not fire this alert | existing |
| 15 | Critical platform error | `catch` blocks you choose to instrument | existing, generic |

---

## 4. Trial expiry needs the first scheduled job in this codebase

Trial/grace-period expiry is currently lazy — reconciled only when *that*
tenant's own dashboard loads (`ensureTrialExpired()` /
`ensureGracePeriodExpired()` in `lib/subscriptions/lifecycle.ts`, explicitly
written that way to avoid needing a scheduled job). Real-time Super Admin
alerting needs proactive detection instead. Since this is already deployed on
Vercel, **Vercel Cron** (a `vercel.json` entry hitting a new
`/api/cron/platform-events` route, e.g. hourly) is the natural fit — no new
paid dependency, matches the existing hosting choice. That route sweeps
companies whose `trialEndsAt` just passed, runs `ensureTrialExpired()`
proactively, and calls `emitPlatformEvent(TRIAL_EXPIRED, …)` for each one that
flips.

---

## 5. Three implementation gaps found, not just wiring

**Upgrade vs. downgrade can't currently be told apart.**
`downgradeCustomerAction` is a literal alias of `upgradeCustomerAction`
(`customers/actions.ts:184`: `export const downgradeCustomerAction =
upgradeCustomerAction;`) — both call the same `changePlan()`, which never
compares old vs. new plan price. The tenant self-service equivalent
(`changeMyPlanAction`) has the identical gap. Fix: one small shared helper,
used by both call sites (avoiding a third duplicated comparison):

```ts
function determinePlanDirection(
  oldPlan: SubscriptionPlan,
  newPlan: SubscriptionPlan,
): "UPGRADED" | "DOWNGRADED" | "UNCHANGED" {
  if (newPlan.monthlyPrice.greaterThan(oldPlan.monthlyPrice)) return "UPGRADED";
  if (newPlan.monthlyPrice.lessThan(oldPlan.monthlyPrice)) return "DOWNGRADED";
  return "UNCHANGED";
}
```

**Trial-conversion detection needs the pre-update company row, already available.**
`handleCheckoutSessionCompleted` fetches `company` at line 59 and only
overwrites `subscriptionStatus` at line 98 — the prior status is sitting
right there in scope. The `metadata.mrrDelta` for both `SUBSCRIPTION_PURCHASED`
and `TRIAL_CONVERTED_TO_PAID` is the new plan's `monthlyPrice` looked up from
`SubscriptionPlan` (same lookup the plan-direction helper below already
needs) — for a trial conversion this is the full new MRR since there was no
prior paid MRR; for a plain upgrade/downgrade it's `newPlan.monthlyPrice -
oldPlan.monthlyPrice`.

**"Subscription renewed" and "Payment succeeded" have no existing code path
at all.** The Stripe dispatcher (`lib/stripe/webhookHandlers.ts`) only
handles `checkout.session.completed`, `customer.subscription.created/updated/
deleted`, and `invoice.payment_failed` — confirmed via `grep -n "case \""`,
no `invoice.payment_succeeded` case exists. Needs: (1) a new case added to
the switch, and (2) confirming that event type is actually enabled on the
Stripe webhook endpoint configuration (Stripe dashboard), since Stripe only
sends event types the endpoint is subscribed to.

---

## 6. Requirement-by-requirement check

- **Platform-level, not tenant-level:** `PlatformEvent.companyId` is display
  context only, never an access-control filter; `deliverToSuperAdminDevices`
  has no tenant filter at all.
- **Isolated from customer notifications:** separate table, separate enum,
  separate delivery function — no shared code path with
  `broadcastUniversalPush` / `Notification` / `notifyHotLead`.
- **Never depends on tenant notification settings:** the delivery query never
  reads any tenant-scoped table.
- **Extensible without modifying existing flows:** a new event is a new enum
  value + one new template function + one new call site; the emitter,
  handlers, and every prior call site are untouched.
- **Event-driven, no duplicated logic:** the emitter is the single dispatch
  point (vs. today's 2-3 duplicated `logActivity` copies), and the plan-
  direction check is one shared helper instead of a third duplicate.
- **Doesn't interfere with tenant notifications/billing:**
  `Promise.allSettled` inside `emitPlatformEvent` guarantees a Super Admin
  delivery failure can never roll back or throw into the Stripe transaction
  or registration action that triggered it.
- **Priority and category on every row:** fixed per event type in the
  registry (§2.3), not a per-call-site decision — every `PAYMENT_FAILED` is
  always `WARNING`/`PAYMENT`, structurally, not by convention.

---

## 7. Future scalability — becoming the platform's central event system

The requirement is that mobile push, audit logs, analytics, revenue
dashboards, monitoring, and future integrations can all consume these same
events later **without changing the core architecture**. Two things already
in this design are what make that true, not new additions:

1. **The handler-list in `emitPlatformEvent` (§2.2) is the extension point.**
   Today it holds two handlers (`writePlatformEventRecord`,
   `deliverToSuperAdminDevices`). Adding analytics forwarding, a Slack
   integration, or a future webhook-out system later is: write one new
   handler function, add it to the array. No existing handler, call site, or
   the emitter itself changes. This is the same shape as adding a new event
   type (§2.3) — the design has exactly one extension point for "new event"
   and exactly one for "new consumer of events," and neither touches
   anything existing.
2. **`PlatformEvent` already *is* the audit log / analytics source, not a
   separate thing to build.** Every row carries `type`, `priority`,
   `category`, `metadata`, `companyId`, `createdAt` — a revenue dashboard
   ("MRR gained this week") queries `type: TRIAL_CONVERTED_TO_PAID` rows and
   sums `metadata.mrrDelta`; a monitoring view filters `category: SYSTEM,
   priority: CRITICAL`; a security audit filters `category: SECURITY`. No
   second table, no ETL step — the same rows Super Admin gets pushed for are
   what every future consumer reads.

Concretely, nothing above needs to be built now for this to hold later —
it's a property of the shapes already chosen (a typed, classified,
`metadata`-bearing row + an array-based fan-out), not a promise to revisit.

---

## 8. What's new vs. reused

| Piece | New or reused |
|---|---|
| `User`/`Company` model, `SUPER_ADMIN` role, `requireSuperAdmin()` guard | Reused as-is |
| `MobileDevice` table (device storage) | Reused as-is (mobile device-registration spec) |
| "Best-effort, never block the caller" resilience pattern | Reused (same as `sendWelcomeEmail`) |
| `PlatformEvent` table + `PlatformEventType`/`PlatformEventPriority`/`PlatformEventCategory` enums | New — deliberately separate from `ActivityLog` |
| `emitPlatformEvent()` + event registry (copy + priority + category) + its two handlers | New — the one piece of shared dispatch infra that doesn't exist yet |
| `deliverToSuperAdminDevices()` | New — structurally independent of `broadcastUniversalPush`/tenant `Notification` |
| `determinePlanDirection()` helper | New — shared by both existing plan-change call sites |
| Trial-conversion before/after check in `handleCheckoutSessionCompleted` | New — reuses the `company` row already fetched there |
| `SUBSCRIPTION_RENEWED`/`PAYMENT_SUCCEEDED` emission | New — corrected during implementation: no new Stripe case was needed; renewal/payment-succeeded was already handled by `customer.subscription.updated`'s period-advance branch, just not previously emitting a platform event |
| Vercel Cron for trial-expiry sweep | New — first scheduled job in the codebase |

---

## 9. Deferred to a future pass (deliberately, scope kept closed)

Two more genuine trigger points were found while implementing the Stripe
webhook instrumentation, both inside `handleSubscriptionUpdated`
(`lib/stripe/webhookHandlers.ts`). Neither introduces a new event type —
both would just be additional emission points for event types that already
exist and are already wired elsewhere. Left un-instrumented for now to keep
this phase's scope closed; either is a small, isolated follow-up.

1. **`cancel_at_period_end` branch** (around line 206 as of this writing) —
   fires when a subscription is scheduled to cancel (still has access until
   the period ends). This is a genuine `SUBSCRIPTION_CANCELED` moment
   distinct from the three already-wired sites (`handleSubscriptionDeleted`,
   `cancelCustomerAction`, `cancelMySubscriptionAction`) — specifically, the
   case where a customer cancels via Stripe's own customer portal directly,
   bypassing this app's own cancel actions entirely. Today that path only
   writes an `ActivityLog` row; a Super Admin wouldn't get pushed a
   `SUBSCRIPTION_CANCELED` alert for it.
2. **Stripe-side reactivation branch** (the `company.subscriptionStatus !==
   ACTIVE` check near the end of the same function) — fires when a
   subscription becomes active again without a period advance or pending
   cancellation (e.g. clearing `pause_collection` directly in Stripe, or a
   self-service undo that doesn't go through `reactivateMySubscriptionAction`).
   Same gap, for `COMPANY_REACTIVATED`.

Follow-up: add `emitPlatformEvent({ type: "SUBSCRIPTION_CANCELED", ... })` /
`{ type: "COMPANY_REACTIVATED", ... }` in these two branches, following the
exact same pattern already used for the other branches in that function
(return a `PlatformEventInput[]` entry, emitted by `route.ts` after the
transaction commits — the collector plumbing already exists end-to-end, this
is purely "add one more array entry in two more places").
