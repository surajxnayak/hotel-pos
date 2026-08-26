# Views

Every route-level screen in `frontend/src/views/`. Each entry lists the route, key responsibilities, and the state it owns.

## Customer

### `CustomerEntry.js` — `/`
The customer's first screen. Accepts a phone number, calls `POST /api/customers/login`, and:
1. If a valid session is already open for that number (`GET /api/customers/me/session` returns 200), sends the user straight to `/order`.
2. Otherwise proceeds to `/table` (using `?qr=<token>` from the URL if present, or falling back to `/scan`).

### `TablePicker.js` — `/scan`
Manual QR entry when the deep link is unavailable. Free-text `qrToken` input, validates against `GET /api/sessions/status/{qrToken}`, then navigates to `/table?qr=…`.

### `TableAccess.js` — `/table`
Two paths, controlled by `GET /api/sessions/status/{qrToken}`:
- **No active session** → shows a "Start a new order list" button that calls `POST /api/sessions/create/{qrToken}`.
- **Active session exists** → shows a PIN input that calls `POST /api/sessions/join/{qrToken}` with the entered PIN.
On success, saves the `SessionResponse` to `localStorage` and navigates to `/order`.

### `OrderSession.js` — `/order`
The biggest view in the app. Three tabs:
- **Menu**: renders `GET /api/menu` grouped by category. Each item is a `MenuItemCard`. Items with `customizationGroups.length > 0` open the shared `CustomizationModal` on tap; others add directly. **Full client-side search + filtering** via `MenuFilterBar`: text search (name + description, 180ms debounced), veg-only toggle (excludes untagged), allergen exclusion chips (derived from the menu's allergen tokens), price sort (default / asc / desc), and a category quick-filter row. All filters combine via AND; categories with zero matches are hidden; a "Clear all filters" action appears on the empty state.
- **Cart**: live shared cart. Increment/decrement/remove via cart REST endpoints. Notes are **not** displayed (they're staff-only).
- **Orders**: every submitted order for the session, live-updated. Item statuses render with a coloured badge. Notes are **not** shown here either.

Header shows the session PIN (tap to copy) and a menu with "Leave table" and "Sign out" flows. When a bill is requested, the Cart tab is auto-locked and a golden banner appears with a "View bill" button.

**State it owns**: `menu`, `cart`, `orders`, `activeTab`, `busyId` (per-action spinners), `submitBusy`, `showConfirmBill`, `customizeItem` + `customizeBusy` + `customizeErr`, and one deliberate optimistic flag — `justRequestedBill`. See [data-flow.md](./data-flow.md#optimistic-updates--the-one-exception).

## Staff — shared shell

Every staff dashboard uses `StaffShell` + `StaffTabs`. The tabs (Tables / Queue) are internal state — no route change fires when switching them. This is what lets `AdminOperate` embed any staff dashboard without triggering `ProtectedStaffRoute` redirects.

### `StaffLogin.js` — `/staff/login`
`POST /api/auth/login`, stores JWT + name + role in `localStorage`, and navigates by role:
- `ADMIN` → `/staff/admin/select`
- everyone else → `/staff/{role}` (lowercased).

### `MyAccount.js` — `/staff/account`
Universal profile page for any signed-in staff. Uses `GET/PATCH /api/staff/me` and `PATCH /api/staff/me/password`. Admins can also set/change their PIN here via `PATCH /api/admin/me/pin`.

## Waiter

### `WaiterDashboard.js` — `/staff/waiter`
- **Tables**: `useTableOverview(waiterTablesList)` → `TableGrid`. Tapping a tile opens `WaiterTableDetail` (a `DetailPanel`). "AVAILABLE" tiles open `StartTableModal` instead (walk-in flow).
- **Queue**: two-column view (Pending PLACED / Ready-to-Serve READY). Each order card shows the table note (via `useQueueTableNotes`). Confirms orders, adjusts quantities (only while `PLACED`), soft-removes items, serves ready items.
- **`WaiterTableDetail`** shows session PIN, participant count, note editor, "Add Order" button (opens `WaiterItemPicker`), the full order list (`OrderList`), and a "Request Bill" button once every item is `SERVED`.
- **`ItemNotePrompt`** — inline modal to `PATCH /api/waiter/order-items/{itemId}/note`. Copy: "Visible to kitchen & other staff only" (customer never sees notes).

## Kitchen

### `KitchenDashboard.js` — `/staff/kitchen`
- **Tables**: `useTableOverview(kitchenTablesList)` → `TableGrid`. Drill-down (`KitchenTableDetail`) shows the same itemized order list as the waiter's, minus PIN, and per-item Start/Ready buttons via `OrderList onAdvanceItem`.
- **Queue**: a **2-column, order-grouped** view — **To Start** (items at `CONFIRMED`) and **In Progress** (items at `PREPARING`). Items of the same order are grouped into a single card per column, with the order header, the table note, and each item's action button (Start → PREPARING, Ready → READY). When one item of a multi-item order is advanced, only that item moves — the remaining items stay in the previous column, producing **two card-groups sharing the same order id**, each showing the same table note. Table note is fetched via `useQueueTableNotes(queue, kitchenTablesList, kitchenTableDetail)`.

## Cashier

### `CashierDashboard.js` — `/staff/cashier`
- **Tables**: `useTableOverview(cashierTablesList)` → `TableGrid`. Drill-down (`CashierTableDetail`) shows the itemized order list with a running `estimatedTotal (pre-tax)`. Actions: request bill (mirrors customer), revert bill request, generate bill (`GenerateBillModal`).
- **Queue (bills)**: two sections — sessions at `BILL_REQUESTED` (needing generate) and generated-but-unpaid bills (needing pay). Actions: generate, revert, single-method pay, split-pay, void.

## Admin

### `AdminModeSelect.js` — `/staff/admin/select`
Simple hub post-admin-login: Overview / Operate as / Menu / Staff / Roster / Bills / Analytics.

### `AdminOverview.js` — `/staff/admin`
Landing page with a few KPI cards + shortcuts.

### `AdminOperate.js` — `/staff/admin/operate`
3-way sliding pill: **Waiter → Kitchen → Cashier** (in the natural flow of an order). Embeds `WaiterDashboard`/`KitchenDashboard`/`CashierDashboard` with `embedded={true}` to suppress the outer `StaffShell` (so no route change happens, so `ProtectedStaffRoute` doesn't bounce the admin).

### `AdminTablesPage.js` — `/staff/admin/tables`
Table overview + drill-down with two admin-only actions on the detail panel:
- **Free-session** (PIN-gated) — force-close a stuck session.
- **Reveal participants** (PIN-gated) — the only place phone numbers are exposed.

### `AdminMenuPage.js` — `/staff/admin/menu`
Menu CRUD. `BulkCreateModal` for batch category/item creation. `CustomizationBuilder` for per-item option groups. Availability toggle is the one PIN-free write; everything else goes through `PinModal`. Includes a simple name-only search box that combines with the All/Live/Disabled filter tabs — pure client-side.

### `AdminStaffPage.js` — `/staff/admin/staff`
Staff CRUD via `BulkCreateModal` + `StatusManagerModal` (bulk activate/deactivate). Password resets are self-service only (admin can't set another staff member's password after creation).

### `AdminTableRoster.js` — `/staff/admin/roster`
The only place `qrToken`s are visible to staff (for printing/regenerating QR stickers). Add/rename/retire/reactivate physical tables.

### `AdminBillsPage.js` — `/staff/admin/bills`
Historical bills with `from`/`to` filters. Uses `Receipt.js` for the drill-down view.

### `AdminAnalyticsPage.js` — `/staff/admin/analytics`
Comprehensive analytics dashboard fed by 12 `/api/admin/analytics/*` endpoints. Sections: a 6-tile KPI strip (revenue / avg bill / tips / customers / discounts / voids); revenue and tips daily bar charts; a peak-hours day×hour heatmap; a customer-retention donut; top items / upsells / dietary-mix cards; operational timing; per-table performance table; per-staff performance tables (waiters, cashiers); and a loss-prevention block (voids by reason + voids by staff, discount totals). Uses a shared `from`/`to` range with 7/30/90-day presets — one `Apply` fires all 12 REST calls in parallel; each failure is caught individually so a single broken endpoint never blanks the whole screen. Uses the same `from`/`to` filters as the bills page.
