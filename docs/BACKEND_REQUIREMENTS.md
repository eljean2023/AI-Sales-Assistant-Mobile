# Backend Requirements for AI Sales Assistant Mobile

Status: **proposal — nothing in this document exists in the backend yet.**
Audience: whoever implements these endpoints inside the `AI-Sales-Assistant` (Next.js) project.

This document exists because the mobile app must adapt to the backend, not the
other way around. Section 1 is a factual audit of the backend as it stands
today. Section 2 is the new surface the mobile app needs, designed to reuse as
much existing backend logic as possible.

---

## 1. Current backend state (as of this audit)

Investigated directly in `C:\Users\XJE\Desktop\AI-Sales-Assistant`.

| Area | Finding |
|---|---|
| Framework | Next.js App Router, deployed on Vercel |
| Auth library | Auth.js / NextAuth v5 (beta), Credentials provider only |
| Session strategy | `session: { strategy: "jwt" }` — a JWT **inside an httpOnly cookie**, managed entirely by NextAuth. The token is never returned in a JSON response body. |
| Login/register today | **Not API routes.** They're React Server Actions (`app/(auth)/actions.ts`: `loginAction`, `registerAction`) that take `FormData` and call `signIn("credentials", …)` internally. Not callable as JSON HTTP endpoints. |
| Refresh tokens | **Do not exist.** No model, no route, no cookie. Grepped the full codebase to confirm. |
| Logout | `signOutAction()` server action clears the NextAuth cookie. No DB session row to revoke (stateless JWT). |
| Route protection | `proxy.ts` (NextAuth's middleware-equivalent) only guards `/dashboard/*` **pages** — it does not run on `/api/**` at all. Every API route checks auth manually via `await auth()` from `lib/auth/auth.ts`; there is no shared `requireAuth()` helper. |
| API conventions | Flat `NextResponse.json(...)`, no consistent envelope. Errors are always `{ error: "message string" }`. No consistent versioning (`/api/v1/sales/assistant` is the only versioned route; everything else is unversioned). Zod (`safeParse`) for validation throughout. |
| Push notifications today | **Web Push only**, not mobile push. Prisma model `UniversalPushSubscription` stores a browser `PushSubscription` (`endpoint` + `keys.auth`/`keys.p256dh`, `platformType: IOS|ANDROID` enum already exists but refers to *browser* on iOS/Android, not native apps). Route: `app/api/push/subscribe/route.ts` (POST upsert / DELETE soft-disable), requires a NextAuth session. Delivery via the `web-push` npm package + VAPID keys — **cannot send to an FCM/Expo device token as-is.** |
| User model | `User { id, email, name, passwordHash, role (USER\|ADMIN\|SUPER_ADMIN\|DEMO), companyId, ... }`. No `Session`/`Account`/`RefreshToken` tables. |
| Password hashing | `lib/auth/password.ts` (bcryptjs) — reusable as-is. |
| Validation schemas | `lib/validation/auth.schemas.ts` has `loginSchema { email, password }` already — reusable as-is. |

**Conclusion:** there is no bearer-token, no refresh-token, and no mobile-compatible device-registration concept anywhere in the backend today. Everything below is new — but it's built as an *extension* of the existing Auth.js identity system, not a second one. See §2.1 for why.

---

## 1a. Can NextAuth v5 itself support a React Native bearer client?

Investigated before writing the spec below, by reading the installed
`next-auth@5.0.0-beta.31` / `@auth/core` source directly (not just docs),
since this determines whether a second auth system is actually necessary.

**Verdict: yes, reuse is possible and is what's specified below — with two
caveats that shape the design.**

- `next-auth/jwt`'s `getToken()` **already supports reading `Authorization:
  Bearer <token>`**, falling back to it when no cookie is present
  (`@auth/core/src/jwt.ts:171-176`, confirmed by reading the source). This
  isn't something to build.
- The credential check (`prisma.user.findUnique` + `verifyPassword` in
  `lib/auth/auth.ts`'s `authorize()`) is already isolated, Prisma-only logic —
  trivially callable from a new route without going through NextAuth's
  `signIn()` at all.
- The JWT itself (`encode`/`decode` from `next-auth/jwt`) is keyed on
  `AUTH_SECRET` plus a `salt`, which is just the session cookie's name string
  (`authjs.session-token` — confirmed in `@auth/core/src/lib/utils/cookie.ts:64`).
  A mobile access token can be minted with the **same `encode()` call, same
  secret, same claims shape** (`sub`, `role`, `companyId`) the web session
  cookie already carries — literally the same token format, delivered over a
  header instead of a cookie for a client that has no cookie jar.

**Caveat 1 — `auth()` itself won't see it.** `auth()`, used by every existing
protected API route, resolves the session purely from the cookie
(`@auth/core/src/lib/actions/session.ts:38`, `sessionStore.value` only, no
header fallback). Routes that need to accept a mobile bearer token must call
`getToken()` directly instead of `auth()`. This only affects *new* mobile
routes (§2.3) — no existing web route changes.

**Caveat 2 — the module is explicitly marked unstable by its own maintainers.**
`@auth/core/src/jwt.ts:26-28` states in the source: *"This module will be
refactored/changed. We do not recommend relying on it right now."* Combined
with `next-auth` being pinned at a pre-1.0 beta here, treat `encode`/`decode`/
`getToken` usage as something to isolate behind a small wrapper (see §2.4) so
a future next-auth upgrade only requires touching one file.

**What NextAuth still doesn't provide, for either cookie or bearer transport:**
any refresh-token or revocation concept. The JWT is a single stateless token
(30-day default expiry) invalidated only by expiry or secret rotation — true
today for web, and reusing NextAuth doesn't change it. A mobile client still
needs a short-lived access token + rotating refresh token, which has to be
built regardless of token strategy. That refresh/revocation layer is the only
genuinely new piece below — everything else is reuse.

### 2.1 Design: one shared identity system, mobile-appropriate token lifecycle

- Same `User` table, same `loginSchema`, same `verifyPassword`/`passwordHash`
  — a mobile user is the same account as a web user, checked the same way.
- Same `AUTH_SECRET`, same `encode`/`decode` from `next-auth/jwt` — the mobile
  access token is a real Auth.js session JWT, just short-lived (e.g. 15m
  instead of the web cookie's 30-day default) and handed back in a JSON body
  instead of a `Set-Cookie` header.
- New: a rotating, revocable refresh token (opaque random string, hashed at
  rest) — because Auth.js has no equivalent, not because we're avoiding
  Auth.js.
- Does **not** touch `proxy.ts`, `authConfig`, or the web cookie flow. Web
  login is unaffected.

### 2.2 New Prisma models

```prisma
model MobileRefreshToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash  String    @unique   // sha256 of the raw refresh token; never store it raw
  createdAt  DateTime  @default(now())
  expiresAt  DateTime
  revokedAt  DateTime?

  @@index([userId])
}

model MobileDevice {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  companyId   String
  company     Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  platform    MobilePlatform
  deviceName  String?
  deviceId    String    @unique
  fcmToken    String
  lastSeen    DateTime  @default(now())
  lastIp      String?
  appVersion  String
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())

  @@index([userId])
  @@index([companyId])
}

enum MobilePlatform {
  IOS
  ANDROID
}
```

`MobileDevice` is deliberately **separate** from `UniversalPushSubscription`:
that table requires `authKey`/`p256dhKey` as `NOT NULL` and is unique-keyed on
a browser `endpoint` URL — it cannot represent an FCM token without a schema
change that would risk the existing Web Push feature.

Field notes:
- `companyId` is denormalized onto the row (same pattern as `User.companyId`)
  so device fan-out for a company's push campaign doesn't need a join through
  `User`. Always set from the authenticated session, never trusted from the
  client body.
- `deviceId` — not the FCM token — is the identity anchor (`@unique`): a
  stable per-installation identifier (e.g. `expo-application`'s
  `getAndroidId()`/`getIosIdForVendorAsync()`, or an app-generated UUID
  persisted in `expo-secure-store`) that survives FCM token rotation. `fcmToken`
  is *not* unique here on purpose — it's the current delivery address for a
  given `deviceId` row, overwritten whenever it rotates, not a second identity
  key. This also fixes an edge case in the mobile app's current
  disable-notifications flow, which unregisters by fetching a fresh FCM token
  at toggle-off time — if the token had rotated since enabling, that lookup
  could silently miss the row. Unregistering by `deviceId` instead is
  immune to that.
- `deviceName` is best-effort display metadata (e.g. `Device.modelName` from
  `expo-device`), nullable since it isn't always obtainable.
- `lastSeen`/`lastIp` are set by the server on every register call (creation
  or re-registration), not by the client — `lastIp` via the same
  `getClientIp(request)` helper already used in `lib/leads/rate-limit.ts`.
- No `updatedAt` — not tracked for this model per spec.
- Implementing this requires adding back-relation array fields to the
  existing `User` and `Company` models (`mobileDevices MobileDevice[]`),
  same as the existing `pushSubscriptions UniversalPushSubscription[]` field
  already on `User`.

### 2.3 Endpoints

All under a new `/api/mobile/*` prefix (kept separate from `/api/v1/*`, which
is an unrelated public API-key-authenticated surface for a different purpose —
see the audit above; **the URL prefix is a naming suggestion, confirm with the
team before implementing**).

---

#### `POST /api/mobile/auth/login`

Authenticates with the existing `User` credentials (same check as
`authorize()` in `lib/auth/auth.ts`) and mints a real Auth.js session JWT via
`encode()` from `next-auth/jwt`, using `AUTH_SECRET` and salt
`"authjs.session-token"` — the same secret/format the web cookie uses, just
short-lived and returned in the body instead of set as a cookie.

- **Auth required:** none
- **Request body:**
  ```json
  { "email": "string", "password": "string" }
  ```
- **Response 200:**
  ```json
  {
    "accessToken": "string (Auth.js JWT via encode(), maxAge ~15m)",
    "refreshToken": "string (opaque, long-lived, e.g. 30d)",
    "user": { "id": "string", "email": "string", "name": "string", "role": "string", "companyId": "string" }
  }
  ```
  The `accessToken` payload should carry the same claims shape the web session
  already carries (`sub`, `role`, `companyId`) so any shared downstream code
  that reads a decoded token sees an identical shape regardless of client.
- **Response 401:** `{ "error": "Invalid email or password" }`
- **Notes:** apply the same rate limiting used on the public lead-intake
  routes (`lib/leads/rate-limit.ts`'s `checkRateLimit`) to this route to guard
  against credential stuffing — it's currently only used on public lead
  routes, not on any login path (since no JSON login path existed before).

#### `POST /api/mobile/auth/refresh`

- **Auth required:** none (the refresh token itself is the credential)
- **Request body:** `{ "refreshToken": "string" }`
- **Response 200:** `{ "accessToken": "string", "refreshToken": "string" }`
  (`accessToken` freshly minted via the same `encode()` call as login; rotate
  the refresh token on every use — issue a new one, revoke the old
  `MobileRefreshToken` row, to limit replay if one leaks)
- **Response 401:** `{ "error": "Invalid or expired refresh token" }` — the
  mobile app is expected to force a logout on this response (already
  implemented client-side).

#### `POST /api/mobile/auth/logout`

- **Auth required:** access token (`Authorization: Bearer <accessToken>`)
- **Request body:** `{ "refreshToken": "string" }`
- **Behavior:** mark the matching `MobileRefreshToken` row `revokedAt = now()`.
- **Response 200:** `{ "ok": true }`

#### `POST /api/mobile/devices/register`

- **Auth required:** access token
- **Request body:**
  ```json
  {
    "deviceId": "string",
    "fcmToken": "string",
    "platform": "ios" | "android",
    "appVersion": "string",
    "deviceName": "string (optional)"
  }
  ```
- **Behavior:** upsert a `MobileDevice` row keyed on `deviceId` (not
  `fcmToken` — see field notes in §2.2). `userId`/`companyId` come from the
  authenticated session, never the body. Sets `fcmToken`, `appVersion`,
  `deviceName`, `lastSeen = now()`, `lastIp` (from the request), and
  `isActive = true` on every call — this is the same call used both for
  first-time registration and for periodic re-registration on token rotation
  (mirrors the upsert-by-`endpoint` pattern already used in
  `app/api/push/subscribe/route.ts`, keyed on `deviceId` instead).
- **Response 200:** `{ "ok": true }`

#### `POST /api/mobile/devices/unregister`

- **Auth required:** access token
- **Request body:** `{ "deviceId": "string" }`
- **Behavior:** set `isActive = false` on the matching `MobileDevice` row,
  scoped to the authenticated `userId` (soft-disable, same pattern as the
  existing push-subscribe `DELETE`). Keying on `deviceId` rather than
  `fcmToken` means this still works even if the token rotated since the
  device was registered.
- **Response 200:** `{ "ok": true }`

### 2.4 Access-token verification (for protecting the mobile-only routes)

A small `getMobileSession(request)` helper — the one new piece of auth
plumbing — that wraps `getToken()` from `next-auth/jwt`:

```ts
import { getToken } from "next-auth/jwt";

export async function getMobileSession(request: Request) {
  return getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    salt: "authjs.session-token",
  });
}
```

This reuses `AUTH_SECRET` and Auth.js's own `decode()` under the hood — it is
not a parallel verification scheme, just the one existing mechanism invoked
directly instead of through the cookie-only `auth()` wrapper. Isolating it in
one function means a future next-auth upgrade (this project is on a pre-1.0
beta; see §1a caveat 2) only requires updating this file if `encode`/`decode`/
`getToken`'s internals change.

Used by `/api/mobile/auth/logout`, `/api/mobile/devices/register`, and
`/api/mobile/devices/unregister` — the only routes that need to authenticate a
mobile bearer request. Existing web routes keep using `auth()` unchanged.

### 2.5 Explicitly out of scope

No endpoints for leads, dashboards, analytics, chat, or CRM data — the mobile
app is a notification companion only. Sending the actual push (FCM delivery
via `firebase-admin` once a `MobileDevice` exists) is a separate, later
concern from the client-facing contract above and isn't specified here.

---

## 3. What changes in the mobile app once these exist

Currently `src/api/auth.api.ts` and `src/api/devices.api.ts` in this repo call
placeholder paths (`/auth/login`, `/auth/refresh`, `/auth/logout`,
`/devices/register`, `/devices/unregister`) as flagged assumptions when the
project was scaffolded. Once the above is implemented and the real paths/prefix
are confirmed, those two files need their URL strings updated to match — no
other mobile code depends on the exact path.
