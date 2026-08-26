# Components

Everything under `frontend/src/components/`. Sorted alphabetically.

## `AdminShell.js`
Chrome for admin pages. Sidebar with nav links, top bar with role + sign-out. Wraps children in a max-width container. Every admin page starts with `<AdminShell title=… subtitle=…>`.

## `BulkCreateModal.js`
Generic PIN-gated modal for batch admin creates (tables, staff, menu categories, menu items). Renders a dynamic list of row inputs from a `fields` config prop, collects the PIN, and calls the parent-supplied `onSubmit(pin, rows)`.

## `CustomizationBuilder.js`
Admin-side editor for a menu item's customization groups + options. Handles the create/patch/delete cascade with a per-mutation PIN prompt.

## `CustomizationModal.js`
**Shared between customer and waiter.** Renders `item.customizationGroups`, tracks per-group selection (RADIO singleton, CHECKBOX multi), computes a live per-item price preview, and calls `onConfirm({ menuItemId, quantity, selectedOptionIds })`. Enforces that every `required: true` group has exactly one selection.

**Props:** `item`, `onClose`, `onConfirm`, `busy`, `errorMessage`.

Used by:
- `views/OrderSession.js` → adds directly to the cart via `addCartItem`.
- `components/WaiterItemPicker.js` → adds to the waiter's local order draft; the payload eventually goes to `waiterPlaceOrder`.

## `DebugPanel.js`
Floating console at bottom-right of every screen. Subscribes to `lib/debugStore` and renders every logged event (`info`, `error`, `ws`) with a timestamp. Filters at the top. Great for wiring up a fresh backend / diagnosing CORS.

## `DetailPanel.js`
Slide-in-from-right drawer used by every "click a table tile → see details" flow. Pure layout — the caller passes children.

## `DietaryAndOptions.js`
Two exports:
- **`DietaryBadge`** — small circle-in-square badge for `VEG` / `NON_VEG` / `EGG`. Renders nothing when `type` is null.
- **`SelectedOptions`** — a chip list of chosen customization options, grouped by `groupName`. Accepts either `options` (structured, from live orders) or `summary` (flat string, from `BillLineItem.customizationSummary`).

## `FilterTabs.js`
Table-grid filter pills (All / Needs Confirmation / Preparing / Ready / Billed / Available). Controlled — parent owns the active filter.

## `GenerateBillModal.js`
Cashier's "Generate Bill" form. Fields: tax % (validated against `BILL_LIMITS.taxRatePercent`), discount (non-negative), tip, tip-recipient dropdown populated from `GET /api/bills/waiters`. On submit calls `generateBill(sessionId, body)`.

## `OrderList.js`
**The shared order+item renderer** used by every table drill-down (waiter, kitchen, cashier, admin). Renders an `OrderResponse[]` grouped by order, with per-item status badge, customization options (via `SelectedOptions`), notes (staff-only), and a slot for parent-provided actions.

**Props:**
- `orders` — `OrderResponse[]`.
- `onConfirmOrder(orderId)` — waiter only. Shows a "Confirm Order" button on `PLACED` orders.
- `onServeItem(itemId)` — waiter only. Shows a "Serve" button on `READY` items.
- `onAdvanceItem(itemId, nextStatus)` — kitchen only. Shows "Start" / "Ready" buttons.
- `onEditItemNote(item)` — waiter only. Shows a "Note" / "Add note" pill.
- `busy` — parent-owned busy key (`c-${orderId}`, `s-${itemId}`, `a-${itemId}`) for per-action spinners.

## `PinModal.js`
Admin's security-PIN prompt. Modal with numeric input + submit. Parent calls with `onConfirm(pin)` and shows/hides via a boolean state — the modal is stateless w.r.t. WHICH action needed the PIN.

## `ProtectedStaffRoute.js`
Route guard. Reads `staff_token` + `staff_role` from `localStorage`; redirects to `/staff/login` on missing token, or to `/` on role mismatch. Universal routes (no `role` prop) accept any signed-in staff.

## `Receipt.js`
Printable receipt used by both the customer's bill viewer and the cashier's post-payment modal. Renders `BillResponse` with item lines (including `customizationSummary`), subtotal / tax / discount / tip / total, payment method(s), and generated/paid/voided timestamps. Styled to look decent when the browser is asked to print (`window.print()`).

## `StaffShell.js`
Chrome for waiter / kitchen / cashier. Header with role name + refresh + account menu, max-width content container. Toggled off by `AdminOperate` via the `embedded` prop on each dashboard.

## `StaffTabs.js`
The Tables / Queue pill switcher shared by all three staff dashboards. Controlled by the parent. Includes a refresh button that spins on click even when the network call finishes instantly (so it always feels responsive).

## `StartTableModal.js`
Waiter's walk-in flow. Calls `POST /api/waiter/tables/{tableId}/session`, then either closes (fresh session with no orders yet) or opens `WaiterItemPicker` for immediate order entry.

## `StatusBadge.js`
Coloured pill for `TableOverviewStatus`. Colour and label are looked up from a static config keyed on the enum value.

## `StatusManagerModal.js`
Admin bulk activate/deactivate helper. Shared by staff and tables (accepts a `kind` prop to route to the right endpoint).

## `TableCard.js`
Single tile in the table grid. Shows table number, `StatusBadge`, and count badges (`ordersAwaitingConfirmation` / `itemsInKitchen` / `itemsReadyToServe`) coloured to match urgency.

## `TableGrid.js`
`FilterTabs` + grid of `TableCard`s. Handles filtering; parent handles selection via `onSelect(table)`.

## `TableNoteView.js`
Read-only rendering of a session note. Used by kitchen and cashier (only the waiter can edit it).

## `WaiterItemPicker.js`
Waiter's walk-in order composer. Left column: searchable menu. Right column: order draft with per-line qty controls. Tapping a menu item with `customizationGroups` opens `CustomizationModal`; every distinct variant becomes its own draft line (so a waiter can add "Large + Extra Cheese ×2" alongside a plain build of the same dish).

The final payload sent to `POST /api/waiter/tables/{tableId}/orders` is exactly:
```json
{ "items": [ { "menuItemId": …, "quantity": …, "selectedOptionIds"?: [...] } ] }
```
No `notes` field — item notes are set post-placement via `waiterSetItemNote`.
