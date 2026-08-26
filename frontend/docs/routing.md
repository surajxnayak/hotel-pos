# Routing

All routes are registered exactly once, in `frontend/src/App.js`. There is no dynamic route loading and no code-splitting — the entire SPA is one bundle.

## Full route table

| Path                          | Component            | Guard        | Notes                                                                 |
| ----------------------------- | -------------------- | ------------ | --------------------------------------------------------------------- |
| `/`                           | `CustomerEntry`      | —            | Phone-number login. Accepts `?qr=<token>` deep link.                  |
| `/scan`                       | `TablePicker`        | —            | Manual QR fallback.                                                   |
| `/table`                      | `TableAccess`        | —            | Create-vs-join gate. Requires `?qr=<token>` + cached customer token.  |
| `/order`                      | `OrderSession`       | —            | Diner's menu / cart / orders / bill. Requires an active `sessionToken`. |
| `/staff/login`                | `StaffLogin`         | —            | JWT sign-in.                                                          |
| `/staff/waiter`               | `WaiterDashboard`    | `WAITER`     | Tables + Queue tabs.                                                  |
| `/staff/waiter/*`             | Redirect             | —            | Any deeper path bounces back to `/staff/waiter`.                      |
| `/staff/kitchen`              | `KitchenDashboard`   | `KITCHEN`    | Tables + Queue tabs.                                                  |
| `/staff/cashier`              | `CashierDashboard`   | `CASHIER`    | Tables + Queue tabs.                                                  |
| `/staff/cashier/*`            | Redirect             | —            | Any deeper path bounces back to `/staff/cashier`.                     |
| `/staff/account`              | `MyAccount`          | any staff    | Universal profile/password edit.                                      |
| `/staff/admin/select`         | `AdminModeSelect`    | `ADMIN`      | Console area chooser after admin login.                               |
| `/staff/admin`                | `AdminOverview`      | `ADMIN`      | Admin home / KPIs.                                                    |
| `/staff/admin/operate`        | `AdminOperate`       | `ADMIN`      | Embeds `WaiterDashboard` / `KitchenDashboard` / `CashierDashboard` behind a 3-way pill (Waiter / Kitchen / Cashier). |
| `/staff/admin/tables`         | `AdminTablesPage`    | `ADMIN`      | Table overview + `free-session` + `reveal-participants`.              |
| `/staff/admin/menu`           | `AdminMenuPage`      | `ADMIN`      | Menu CRUD + customization builder.                                    |
| `/staff/admin/staff`          | `AdminStaffPage`     | `ADMIN`      | Staff CRUD.                                                           |
| `/staff/admin/roster`         | `AdminTableRoster`   | `ADMIN`      | Physical table CRUD (with `qrToken` reveal).                          |
| `/staff/admin/bills`          | `AdminBillsPage`     | `ADMIN`      | Historical bills.                                                     |
| `/staff/admin/analytics`      | `AdminAnalyticsPage` | `ADMIN`      | Revenue / top items / timing.                                         |
| `*`                           | Redirect to `/`      | —            | Unknown path fallback.                                                |

## Guards

`ProtectedStaffRoute` (`components/ProtectedStaffRoute.js`) enforces:

1. **JWT presence** — reads `staff_token` from `localStorage`; missing → redirect to `/staff/login`.
2. **Role match** (optional `role` prop) — a `WAITER` cannot open `/staff/kitchen`; on mismatch → redirect.
3. **Universal routes** (no `role` prop, e.g. `/staff/account`) — any signed-in staff role passes.

There is no separate "admin can act as any role" plumbing here; that is handled inside `AdminOperate.js` by embedding the child dashboard components with `embedded={true}` (which suppresses the `StaffShell` chrome so no route change fires).

## Why does `AdminOperate` embed instead of navigating?

If the admin clicked "Operate as Waiter" and we `nav('/staff/waiter')`, `ProtectedStaffRoute role="WAITER"` would kick them out because the JWT role is `ADMIN`, not `WAITER`. Embedding avoids that entirely — the component tree renders, but the URL stays `/staff/admin/operate`, so no guard re-runs.

The 3-way pill order on this page is deliberately **Waiter → Kitchen → Cashier**, mirroring the natural flow of an order through the restaurant.

## Deep linking cheatsheet

- **Customer QR link**: `/?qr=<qrToken>` — this is what the printed QR sticker encodes.
- **Rejoin last table**: on `/`, if a valid customer token is cached and the customer is currently in an active session, the app skips straight to `/order`.
- **Hard refresh on a staff page**: works — JWT is in `localStorage`, guard just re-validates. The one exception is the customer flow, which requires the `sessionToken` in `localStorage` to be still valid on the backend; if it is not, the app redirects to `/`.
