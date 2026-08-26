# Roles & Permissions

There are four staff roles plus the anonymous customer. Every backend endpoint enforces role checks; the frontend mirrors them for UX only.

## Overview matrix

|                                   | Customer | Waiter | Kitchen | Cashier | Admin |
| --------------------------------- | :------: | :----: | :-----: | :-----: | :---: |
| Log in via phone number           |    ✅    |   ❌   |   ❌    |   ❌    |  ❌   |
| Log in via username/password (JWT)|    ❌    |   ✅   |   ✅    |   ✅    |  ✅   |
| Browse the menu                   |    ✅    |   ✅   |   ✅    |   ✅    |  ✅   |
| Add items to a shared cart        |    ✅    |   ❌   |   ❌    |   ❌    |  ❌   |
| Submit an order                   |    ✅    |   ✅¹  |   ❌    |   ❌    |  ✅   |
| Confirm a `PLACED` order          |    ❌    |   ✅   |   ❌    |   ❌    |  ✅   |
| Mark items `PREPARING` / `READY`  |    ❌    |   ❌   |   ✅    |   ❌    |  ✅   |
| Mark an item `SERVED`             |    ❌    |   ✅   |   ❌    |   ❌    |  ✅   |
| Edit / cancel a `PLACED` item     |    ❌    |   ✅   |   ❌    |   ❌    |  ✅   |
| Set an item note                  |    ❌    |   ✅   |   ❌    |   ❌    |  ✅   |
| Set a table (session) note        |    ❌    |   ✅   |   ❌    |   ❌    |  ✅   |
| Request the bill                  |    ✅    |   ✅   |   ❌    |   ❌    |  ✅   |
| Revert a bill request             |    ❌    |   ❌   |   ❌    |   ✅    |  ✅   |
| Generate the bill                 |    ❌    |   ❌   |   ❌    |   ✅    |  ✅   |
| Pay / split-pay / void a bill     |    ❌    |   ❌   |   ❌    |   ✅    |  ✅   |
| See other tables' details         |    ❌    |   ✅   |   ✅    |   ✅    |  ✅   |
| Menu CRUD                         |    ❌    |   ❌   |   ❌    |   ❌    |  ✅   |
| Staff CRUD                        |    ❌    |   ❌   |   ❌    |   ❌    |  ✅   |
| Table roster CRUD                 |    ❌    |   ❌   |   ❌    |   ❌    |  ✅   |
| Free-session override             |    ❌    |   ❌   |   ❌    |   ❌    |  ✅²  |
| Reveal participant phone numbers  |    ❌    |   ❌   |   ❌    |   ❌    |  ✅²  |
| Analytics                         |    ❌    |   ❌   |   ❌    |   ❌    |  ✅   |

¹ Waiter's "walk-in order" (`POST /api/waiter/tables/{tableId}/orders`) skips `CART`/`PLACED` and lands as `CONFIRMED` in one call — see `WaiterItemPicker.js`.
² PIN-gated (see [authentication.md](./authentication.md)).

## Customer

Route: `/`, `/table`, `/order`.

The customer sees a **single shared cart** with everyone else at the table. Any participant can add/edit/remove items. Once anyone taps "Submit Order", the whole cart becomes a placed order, and a fresh empty cart opens automatically for the next round.

Item notes are **staff-only**. The customer never sees `notes` — every customer-facing response returns `notes: null`. The frontend also does not display notes anywhere on the customer's screens.

## Waiter

Route: `/staff/waiter` (or embedded via admin's `/staff/admin/operate`).

Two tabs:

- **Tables**: full grid of tables with `overviewStatus` badges. Tapping a tile opens a `DetailPanel` with:
  - Session PIN, participant count, opened-at time
  - Table note editor (`PATCH /api/waiter/tables/{tableId}/note`)
  - "Add Order" button → opens `WaiterItemPicker` for walk-in orders
  - Every submitted order for that session, with per-item confirm/serve/note actions
  - "Request Bill" button (when all items are `SERVED`)

- **Queue**: two columns — Pending (`PLACED`) and Ready-to-serve (`READY`) — for triaging without leaving the current view.

## Kitchen

Route: `/staff/kitchen`.

Two tabs:

- **Tables**: read-mostly view of every table (no session PIN, no billing info). Item actions are the same as the queue view.
- **Queue**: a flat list of **items** (not orders) at `CONFIRMED` or `PREPARING`. Each card has one big button — "Start Preparing" or "Mark Ready" — that fires `PATCH /api/kitchen/order-items/{itemId}/status`. Customization selections are shown on every card so the kitchen knows exactly what to cook.

## Cashier

Route: `/staff/cashier`.

Two tabs:

- **Tables**: grid + drill-down like the waiter's, but without the session PIN and without any per-item write actions. The drill-down shows a running `estimatedTotal` pre-tax.
- **Queue** (bills): sessions at `BILL_REQUESTED` (from `GET /api/bills/requested`) followed by generated-but-unpaid bills (from `GET /api/bills/pending`).

Actions from either tab:
- Revert a bill request (undoes the customer's tap; puts the orders back to `SERVED`).
- Generate the bill (opens `GenerateBillModal` — tax %, discount, optional tip + recipient).
- Pay (single method) or split-pay (multiple methods, must sum exactly to `total`).
- Void a paid bill (audit-only; does not undo the meal).

## Admin

Route: `/staff/admin/…`.

Admin is the **superset**. Beyond the admin-only screens (menu, staff, roster, bills history, analytics), an admin can:

- Enter any staff dashboard via `AdminOperate` (Waiter / Kitchen / Cashier). Every write is attributed to the admin's own staff account.
- Bypass a stuck session (`free-session`, PIN-gated).
- Reveal participant phone numbers (`reveal-participants`, PIN-gated).
- Bulk-manage staff, menu, tables (all PIN-gated except item availability toggle).

See [authentication.md#3-admin-pin](./authentication.md) for the PIN model.
