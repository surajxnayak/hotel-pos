# Project Structure

Every non-trivial file and folder in this repo, and what it does.

```
/app
├── README.md
├── API_REFERENCE.md          # Backend API spec (do not edit)
├── design_guidelines.json    # Original brand/typography tokens
├── docs/                     # Everything under here (this document included)
├── memory/
│   └── PRD.md                # Product-level notes; not shipped in the build
└── frontend/                 # The React app — 100% of runtime code lives here
    ├── package.json
    ├── yarn.lock
    ├── tailwind.config.js    # Design tokens as Tailwind theme extensions
    ├── postcss.config.js
    ├── .env                  # REACT_APP_API_BASE_URL, REACT_APP_WS_BASE_URL
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js          # ReactDOM entry — mounts <App /> and <Toaster />
        ├── index.css         # Tailwind directives + font imports + globals
        ├── App.js            # React Router route table (single source of routes)
        ├── components/       # Reusable UI (see below)
        ├── views/            # Route-level screens (see below)
        ├── hooks/
        │   ├── useTableOverview.js       # REST + WS table-grid data hook
        │   └── useQueueTableNotes.js     # Resolves session notes for a queue view
        └── lib/
            ├── api.js         # Axios instance + every REST helper
            ├── ws.js          # STOMP-over-SockJS factory
            ├── session.js     # localStorage helpers (session, orderIds, customer)
            ├── config.js      # Bill defaults + validation bounds (cashier)
            └── debugStore.js  # In-memory ring buffer used by DebugPanel
```

## `frontend/src/components/`

| File                        | Purpose                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `AdminShell.js`             | Chrome for admin pages: sidebar nav + role badge + sign-out.                                         |
| `BulkCreateModal.js`        | Generic PIN-gated modal used by admin to bulk-add tables/staff/menu.                                 |
| `CustomizationBuilder.js`   | Admin-side builder for a menu item's customization groups & options.                                 |
| `CustomizationModal.js`     | Shared modal for **customer AND waiter** to pick RADIO/CHECKBOX options. Emits `{menuItemId, quantity, selectedOptionIds}`. |
| `DebugPanel.js`             | Floating console at bottom-right; renders `debugStore` entries with filters.                         |
| `DetailPanel.js`            | Right-side drawer used by every "click a table tile → see details" flow.                             |
| `DietaryAndOptions.js`      | Exports `DietaryBadge` (veg/non-veg/egg dot) and `SelectedOptions` (chip list of chosen options).    |
| `FilterTabs.js`             | Table-grid filter pills (All / Needs Confirmation / Preparing / …).                                  |
| `GenerateBillModal.js`      | Cashier's "Generate Bill" form — tax %, discount, tip, tip recipient.                                |
| `OrderList.js`              | **Shared** order+item renderer used by every table drill-down (waiter/kitchen/cashier/admin).        |
| `PinModal.js`               | Admin PIN prompt gate for sensitive writes.                                                          |
| `ProtectedStaffRoute.js`    | Route guard — checks JWT + role; redirects to `/staff/login` on mismatch.                            |
| `Receipt.js`                | Printable bill view (used both in cashier's post-payment modal and customer's bill viewer).          |
| `StaffShell.js`             | Chrome for waiter/kitchen/cashier: header + refresh + account menu.                                  |
| `StaffTabs.js`              | The Tables/Queue pill switcher shared by all three staff dashboards.                                 |
| `StartTableModal.js`        | Waiter "open a walk-in table" flow.                                                                  |
| `StatusBadge.js`            | Colored pill for `TableOverviewStatus` (`NEEDS_CONFIRMATION`, `READY_TO_SERVE`, …).                  |
| `StatusManagerModal.js`     | Admin bulk-activate / bulk-deactivate helper.                                                        |
| `TableCard.js`              | Single tile in the table grid.                                                                       |
| `TableGrid.js`              | Grid layout of `TableCard`s + `FilterTabs`.                                                          |
| `TableNoteView.js`          | Read-only rendering of a session note (kitchen/cashier).                                             |
| `WaiterItemPicker.js`       | Waiter's walk-in order composer. **Reuses `CustomizationModal`** for items with option groups.       |

## `frontend/src/views/`

| File                       | Route                        | Purpose                                                                             |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `CustomerEntry.js`         | `/`                          | Phone-number entry page (customer login).                                           |
| `TablePicker.js`           | `/scan`                      | Manual QR entry fallback if the deep-link is lost.                                  |
| `TableAccess.js`           | `/table`                     | "Create a new order list" vs "Join with PIN".                                       |
| `OrderSession.js`          | `/order`                     | The whole diner experience — Menu / Cart / Orders / Bill.                           |
| `StaffLogin.js`            | `/staff/login`               | Username/password sign-in for all four staff roles.                                 |
| `WaiterDashboard.js`       | `/staff/waiter`              | Tables + Queue tabs; walk-in order flow; item confirm/serve/edit/remove; notes.     |
| `KitchenDashboard.js`      | `/staff/kitchen`             | Tables + Queue tabs; per-item `CONFIRMED → PREPARING → READY` transitions.          |
| `CashierDashboard.js`      | `/staff/cashier`             | Tables + Queue tabs; bill request → generate → pay/void/revert.                     |
| `MyAccount.js`             | `/staff/account`             | Universal self-service: change username/email/password.                             |
| `AdminModeSelect.js`       | `/staff/admin/select`        | Post-login "which console area?" chooser.                                           |
| `AdminOverview.js`         | `/staff/admin`               | Admin home / KPIs.                                                                  |
| `AdminOperate.js`          | `/staff/admin/operate`       | Embeds Waiter/Kitchen/Cashier dashboards behind a 3-way pill (Waiter / Kitchen / Cashier). |
| `AdminTablesPage.js`       | `/staff/admin/tables`        | Admin table overview + `free-session` + `reveal-participants` (both PIN-gated).     |
| `AdminMenuPage.js`         | `/staff/admin/menu`          | Menu CRUD + availability toggle + customization builder.                            |
| `AdminStaffPage.js`        | `/staff/admin/staff`         | Staff CRUD (bulk create, role edit, bulk activate/deactivate).                      |
| `AdminTableRoster.js`      | `/staff/admin/roster`        | Physical table roster (add/rename/retire/reactivate).                               |
| `AdminBillsPage.js`        | `/staff/admin/bills`         | Historical bill list + filters + drill-down.                                        |
| `AdminAnalyticsPage.js`    | `/staff/admin/analytics`     | Revenue, top items, timing dashboards.                                              |

## `frontend/src/lib/`

| File            | Purpose                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `api.js`        | Single axios instance. Request interceptor injects the right token (staff JWT vs customer bearer). Every endpoint helper lives here. |
| `ws.js`         | `createStompClient({ subscriptions, onConnect })` — subscribes/unsubscribes cleanly on reconnect; emits debug logs. |
| `session.js`    | `saveSession / loadSession / clearSession` for the customer's active `sessionToken`+`pin`; also `orderIds` (for reconciliation) and 30-day cached customer identity. |
| `config.js`     | Restaurant defaults for tax %, discount, and cashier validation limits.                                     |
| `debugStore.js` | Ring-buffer of `{ level, category, message, time, data }`; `DebugPanel` subscribes.                         |

## Where does X live? (quick jumps)

| I want to touch…                                     | Go to                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| A backend endpoint helper                            | `frontend/src/lib/api.js`                                    |
| The customer's menu / cart / orders UI               | `frontend/src/views/OrderSession.js`                         |
| The customization picker (customer + waiter)         | `frontend/src/components/CustomizationModal.js`              |
| The waiter's walk-in order composer                  | `frontend/src/components/WaiterItemPicker.js`                |
| The item-row renderer inside a table drill-down      | `frontend/src/components/OrderList.js`                       |
| The waiter's queue view (per-order card list)        | `WaiterQueueView` in `frontend/src/views/WaiterDashboard.js` |
| The kitchen's per-item queue                         | `KitchenQueueView` in `frontend/src/views/KitchenDashboard.js` |
| The admin "operate as …" 3-way pill                  | `frontend/src/views/AdminOperate.js`                         |
| Route registrations                                  | `frontend/src/App.js`                                        |
| Tailwind theme (colors, `bg`, `bg2`, `ink`, `brand`) | `frontend/tailwind.config.js`                                |
| WebSocket topic subscriptions                        | `frontend/src/lib/ws.js` (factory) + call-sites in views     |
