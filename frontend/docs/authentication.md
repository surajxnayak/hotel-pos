# Authentication

There are **three** distinct auth models running in this app. Do not confuse them.

## 1. Customer — phone number, no password

A diner logs in with a 10-digit Indian mobile (`^[6-9]\d{9}$`). The backend issues a **30-day** bearer token (`customerToken`). No OTP, no verification — this is a low-friction gate to "start or join a table".

**Where the token is stored:** `localStorage['trattoria_customer']` (see `lib/session.js`).

**Where the token is attached:** `lib/api.js` request interceptor. It matches URLs like `/api/sessions/create/…`, `/api/sessions/join/…`, `/api/customers/me/…`, `/api/customers/logout` and attaches `Authorization: Bearer <customerToken>`.

**Once inside a session:** the endpoints under `/api/cart/`, `/api/orders/`, `/api/sessions/{sessionToken}/orders`, and `/api/sessions/{sessionToken}/bill` do **not** need the bearer token — the `sessionToken` in the URL is enough. This is by design; the customer token is only a one-time gate.

**Resuming a session:** on `/`, if a valid customer token is cached, the app calls `GET /api/customers/me/session` — a `200` with a `SessionResponse` means "you're already in a session somewhere, go straight to `/order`"; a `204` means "start fresh".

**Sign out:** clears both the session (`SESSION_KEY`) and the customer (`CUSTOMER_KEY`) in localStorage, and calls `POST /api/customers/logout` best-effort to revoke server-side.

**Leave table:** removes the customer from the session roster but keeps the customer token cached, so they can immediately join a different table. `POST /api/customers/me/session/leave`.

## 2. Staff — JWT

All four staff roles (`WAITER`, `KITCHEN`, `CASHIER`, `ADMIN`) authenticate via `POST /api/auth/login` and receive a JWT (`{ token, name, role }`).

**Where the token is stored:** `localStorage['staff_token']`.

**Where the token is attached:** `lib/api.js` request interceptor. It matches URLs containing `/waiter/`, `/kitchen/`, `/cashier/`, `/bills`, `/admin/`, or `/staff/me` and attaches `Authorization: Bearer <staffToken>`.

**Role checking on the client:** `components/ProtectedStaffRoute.js` reads the token, decodes the role (stored alongside the token in localStorage as `staff_role`), and:
- redirects to `/staff/login` if the token is missing or expired;
- redirects to `/` if the role doesn't match the route's required `role` prop.

**Role checking on the server:** the backend re-validates every request. The client-side guard is only a UX shortcut. An **ADMIN** JWT is accepted by `/api/waiter/**`, `/api/kitchen/**`, and `/api/cashier/**` server-side — this is how `AdminOperate` works without a role hack.

**Universal endpoints:** `/api/staff/me` and `/api/staff/me/password` accept any signed-in role. These power the `/staff/account` page.

**Sign out:** clears `staff_token` / `staff_role` and any admin flags; no backend call needed (JWT expires on its own).

## 3. Admin PIN — a second factor for destructive actions

Admins have a JWT (like any staff) **plus** an optional 4–6 digit security PIN, set via `PATCH /api/admin/me/pin`. This PIN gates:

- `POST /api/admin/tables/{tableId}/free-session`
- `POST /api/admin/tables/{tableId}/reveal-participants`
- Every admin create / delete / bulk-status-change (staff, tables, menu, customizations).

**Exception:** `PATCH /api/admin/menu/items/{id}/availability` — the ONE PIN-free admin write, because toggling an item on/off is high-frequency and low-risk.

**How the client asks for it:** `components/PinModal.js` prompts every time a PIN-gated action runs. The PIN is **not** cached — there is no "elevated session" concept. Every write sends the PIN in its own body.

**Fresh admin accounts have no PIN set.** `GET /api/admin/me` returns `pinSet: false`; the frontend uses this to render "Set PIN" (first time) vs "Change PIN" (subsequent) on the account page.

## Common pitfalls

- **Two roles on the same device:** log out first. Both tokens live under different localStorage keys and won't collide, but the customer flow and staff flow share `/` if the customer session is cached — sign out clears both.
- **Missing customer token:** `lib/api.js` will log `"→ auth: NO customer token in localStorage"` to the debug panel. This usually means the customer entry step was skipped or `clearCustomer()` was called mid-flow.
- **CORS-related 401 mystery:** if the browser blocks the request pre-flight, axios sees a `Network Error`, not a `401`. Check the Debug console for `Cannot reach backend at …` — that's the signature.
- **JWT expiry:** the backend rejects with `401`; the axios response interceptor surfaces the backend message via a toast. Frontend does not auto-refresh — the user must sign in again.
