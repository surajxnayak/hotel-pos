# Changelog

Human-authored log of significant changes. Order: newest first.

## 2026-01 — Analytics dashboard expanded to 12 endpoints

### Added
- **9 new analytics API helpers** in `lib/api.js`:
  `adminVoidDiscountReport`, `adminStaffPerformanceWaiters`, `adminStaffPerformanceCashiers`, `adminCustomerRetention`, `adminTablePerformance`, `adminPeakHours`, `adminTipSummary`, `adminDietaryMix`, `adminUpsellPerformance`. All use the existing `withIsoInstantRange` helper for `from`/`to`.
- **`AdminAnalyticsPage.js` fully redesigned**. Loads all 12 endpoints in parallel from one range picker (with 7d / 30d / 90d presets and a refresh button); every request is `.catch(() => null|[])` isolated so a single failing endpoint never blanks the page.
  - **KPI strip** (6 tiles): Revenue, Avg Bill, Tips, Customers, Discounts, Voids.
  - **Revenue trend**: daily bar chart (`dailyBreakdown`) with total, tax, discount and average bill micro-stats.
  - **Tips trend**: daily bar chart (`tip-summary → dailyBreakdown`) + entry count.
  - **Peak Hours heatmap**: 7 rows × 24 columns, colour-graded by billCount intensity; hover reveals bill count + revenue for that cell.
  - **Customer Retention**: SVG ring dial showing returning-rate %, backed by unique / new / returning counts.
  - **Top Items** and **Upsell Performance**: horizontal-bar lists sorted by their natural metric (quantity vs revenue).
  - **Dietary Mix**: stacked bar + per-bucket cards (Veg / Non-veg / Egg / Untagged). Percents fall back to computed values when the API returns `null` on zero-revenue ranges.
  - **Operational Timing**: three tiles (avg-confirm / avg-serve / sampled), seconds pretty-printed as `s / m / h`.
  - **Table Performance**: sortable-by-revenue table with sessions, avg session duration (minutes), and a mini bar.
  - **Waiter / Cashier performance tables**: staff-name rows with per-role metrics; empty when no events in range.
  - **Loss Prevention** section: total voided amount, void count, total discount given, discount % of revenue, plus two horizontal-bar lists (voids by reason, voids by staff).
- Consistent formatting: `money`, `compactMoney` (Lakh/Crore-aware for India), `pct`, `num`, and `secondsToText` helpers keep every widget grammatically identical.

### Notes
- 100% additive to the analytics screen. No other view touched.
- No new dependencies; the heatmap and ring dial are hand-rolled SVG/Tailwind (kept dependency-light on purpose).

## 2026-01 — Menu search + filters (customer) + name search (waiter, admin)

### Added
- **Customer menu now has full client-side search + filtering** on `views/OrderSession.js → MenuView`:
  - Live case-insensitive substring search on `name` + `description` (180ms debounce for render performance only — no network calls).
  - Veg-only toggle. Untagged items (`dietaryType === null`) are **excluded** when ON — treated as unsafe, not "assume veg".
  - Allergen exclusion chips, tokens derived from every item's `allergens` string (comma-split, trimmed, lowercased, deduped). When one or more chips are active, items whose `allergens` contain that token are hidden. Items with `allergens === null` are never hidden.
  - Price sort — Default / Low → High / High → Low.
  - Category quick-filter (horizontal pill row).
  - All filters combine via AND. Categories with zero matches are hidden entirely.
  - Empty-state with a one-tap "Clear all filters" button when the combined filters produce zero results.
- **Waiter menu already has name-only search** in `components/WaiterItemPicker.js` — verified.
- **Admin menu now has a name-only search** in `views/AdminMenuPage.js` (top-right, next to the Category / New Item buttons). Combines with the existing All/Live/Disabled filter tabs.

### Notes
- 100% client-side. `GET /api/menu` is called exactly once on mount; every filter change is a re-filter of the in-memory `MenuCategoryResponse[]`.
- No new fields invented — search/filter is only on data that already exists in the API (`name`, `description`, `dietaryType`, `allergens`, `price`).

## 2026-01 — Kitchen queue as 2-column order-grouped view + table notes in queue

### Added
- **Kitchen queue is now a 2-column, order-grouped view** matching the waiter's queue layout: **To Start** (`itemStatus === "CONFIRMED"`) and **In Progress** (`itemStatus === "PREPARING"`). Items of the same order are grouped under a single card (with `OrderHeader` + table note) rather than shown as flat, unrelated tiles.
- **Same order can now appear in both kitchen columns.** When a cook advances one item to `PREPARING`, only that item moves — the remaining `CONFIRMED` items stay in "To Start". This yields **two groups sharing the same order id**, one in each column. Both groups render the same table note.
- **Table notes are now visible on every order card in the waiter's queue view** (Pending + Ready-to-Serve) — matching the drill-down view.
- **New hook `hooks/useQueueTableNotes.js`** — resolves session-note strings for the set of orders shown in any queue view. It does the two-step reconciliation (`tablesList` → tableId → `tableDetail`) that the flat `OrderResponse` payload doesn't include. Silent on individual failures.

### Changed
- Kitchen queue's per-item card grid → per-order group cards with in-card item rows and per-item Start / Ready buttons.
- `ClipboardList` icon added to `KitchenDashboard.js` imports for the "To Start" column badge.

## 2026-01 — Customization reuse in waiter walk-in orders + queue-view polish

### Added
- **Waiter walk-in orders now reuse the shared `CustomizationModal`.** When a waiter taps a menu item with `customizationGroups` in the walk-in picker, the same modal the customer sees opens. Every variant becomes its own draft line, so a waiter can add "Large + Extra Cheese × 2" and a plain build of the same dish in one order.
- **Selected customization options are now visible in the waiter's Queue view** (Pending + Ready-to-Serve columns) via the shared `SelectedOptions` component. Previously only the table drill-down / grid view showed them.
- **Selected customization options are now visible in the kitchen's Queue view** on every per-item card.

### Changed
- **Admin "Operate as" pill re-ordered to Waiter → Kitchen → Cashier** — matching the natural flow of an order through the restaurant.
- **Waiter walk-in order payload is now strictly `{ menuItemId, quantity, selectedOptionIds? }`.** The old `notes` field was silently dropped by the backend; it's now removed from the payload entirely. Item notes remain settable post-placement via the existing "Add note" flow.
- **`WaiterItemPicker` draft is now an array (not a map by `menuItemId`)** so multiple customization variants of the same dish can coexist in one draft.
- **Item-note editor copy** updated from "Visible to kitchen & customer" to "Visible to kitchen & other staff only" — matching the API contract where `notes` is never returned to customers.

### Removed
- **Customer no longer sees item notes.** Removed "Staff note:" line from the customer's Cart tab and the note snippet from the Orders tab. The backend already returns `notes: null` for customer-facing responses; this removes the vestigial UI. Table notes were never displayed on customer screens.

## 2025 — Initial build

- Customer flow: phone login → QR create/join → shared cart → orders → bill.
- Waiter dashboard: table grid + queue tabs, walk-in order picker, item notes, table notes.
- Kitchen dashboard: table grid + item queue.
- Cashier dashboard: table grid + bill queue, generate/pay/void/split-pay/revert.
- Admin: overview, embedded operate-as, menu CRUD, staff CRUD, table roster, historical bills, analytics.
- Real-time via STOMP-over-SockJS with REST reconciliation on every reconnect/focus/online.
- Debug console on every screen.
