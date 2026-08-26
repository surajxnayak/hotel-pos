# Data Flow

The single most important idea in this codebase: **REST is the source of truth. WebSockets are only a latency optimization.**

## Why this rule exists

WebSocket connections drop for boring reasons — a phone screen lock, a backgrounded tab, a spotty network, a proxy that idles out long-lived sockets. If the UI treated WS as its source of truth, it would silently go stale the first time any of that happened. So every view treats a WS message as a *hint to update*, and every reconnect/refocus as an opportunity to *reconcile the whole world*.

## The pattern

Almost every stateful view in this app follows this shape:

```js
useEffect(() => {
  refresh();                                   // 1. Initial REST fetch
  const { deactivate } = createStompClient({   // 2. Subscribe to relevant topics
    subscriptions: [{ topic: "/topic/…", handler }],
    onConnect: refresh,                        // 3. Re-fetch on every (re)connect
  });
  const onVis = () => document.visibilityState === "visible" && refresh();
  document.addEventListener("visibilitychange", onVis); // 4. Re-fetch on tab focus
  window.addEventListener("online", refresh);           // 5. Re-fetch on network resume
  return () => {
    deactivate();
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("online", refresh);
  };
}, [refresh]);
```

**Five reconciliation triggers** for every screen: mount, WS connect, WS message (per-topic), tab focus, network back online.

This is encapsulated once in `hooks/useTableOverview.js` for every table-grid screen (waiter/kitchen/cashier/admin), and repeated inline in `OrderSession.js`, `WaiterDashboard.js` queue view, and `KitchenDashboard.js` queue view.

## What flows where

### Customer's phone

- **REST reads**: menu (`GET /api/menu`), cart (`GET /api/cart/{sessionToken}`), submitted orders (`GET /api/sessions/{sessionToken}/orders`), individual order (`GET /api/orders/{orderId}`), session bill (`GET /api/sessions/{sessionToken}/bill`).
- **REST writes**: cart mutations (`POST/PATCH/DELETE /api/cart/...`), submit (`POST /api/cart/{sessionToken}/submit`), bill request (`POST /api/orders/bill-request/{sessionToken}`), leave-table (`POST /api/customers/me/session/leave`), logout.
- **WS subscribes**: `/topic/cart/{sessionId}` (any participant changes the cart), `/topic/table/{sessionId}` (staff progress on our orders).
- **Reconciliation**: `refreshCart()` + `refreshOrders()` on every trigger.

### Waiter dashboard

- **Table grid**: `GET /api/waiter/tables` + WS `/topic/tables` (single-tile updates).
- **Queue view**: `GET /api/waiter/orders/pending` + `GET /api/waiter/orders/ready-to-serve` + WS `/topic/waiter` (any new PLACED order triggers a full re-fetch).
- **Table drill-down**: `GET /api/waiter/tables/{tableId}` — refreshed on each explicit action (confirm/serve/note) via `load()`.

### Kitchen dashboard

- **Table grid**: `GET /api/kitchen/tables` + WS `/topic/tables`.
- **Queue view**: `GET /api/kitchen/queue` + WS `/topic/kitchen` (any order at CONFIRMED/PREPARING/READY triggers a re-fetch).
- **Table drill-down**: `GET /api/kitchen/tables/{tableId}`.

### Cashier dashboard

- **Table grid**: `GET /api/cashier/tables` + WS `/topic/tables`.
- **Queue (bills)**: `GET /api/bills/requested` + `GET /api/bills/pending` + WS `/topic/cashier` (bill lifecycle events).
- **Table drill-down**: `GET /api/cashier/tables/{tableId}`.

### Admin

- Every admin table screen reuses `useTableOverview(adminTablesList)` — same pattern, different fetcher.
- Admin analytics/bills pages are pure REST — no WS subscription.

## Optimistic updates — the *one* exception

`OrderSession.js` uses a `justRequestedBill` flag: the moment the customer taps "Request Bill", the UI locks locally without waiting for the server or WS. This closes a ~200ms window where a fast tapper could accidentally add another cart item post-request. The flag automatically clears as soon as a REST fetch confirms no BILL_REQUESTED order exists (i.e., after a cashier revert).

**No other view uses optimistic UI.** Every other action shows a spinner, calls REST, and then re-fetches. This is boring on purpose.

## Local persistence

Only three things are cached in `localStorage`:

| Key                       | Owner    | What                                          |
| ------------------------- | -------- | --------------------------------------------- |
| `trattoria_session`       | Customer | Current `sessionId`/`sessionToken`/`pin`/`tableNumber` from create/join. |
| `trattoria_customer`      | Customer | 30-day `customerToken`+phone+`savedAt`.       |
| `trattoria_order_ids`     | Customer | Order-id set for cross-refresh reconciliation. |
| `staff_token` / `staff_role` / `staff_name` | Staff | JWT + role for guard checks. |
| `admin_operate_mode`      | Admin    | Last-picked mode (waiter/kitchen/cashier) on `AdminOperate`. |

Everything else — menu, cart, orders, tables — is fetched fresh from REST on every mount.

## Why not React Query / SWR / Redux?

The reconciliation logic is intentionally simple and lives at the view layer, one useEffect per screen. React Query would compress this — but at the cost of a hidden cache that competes with the REST-is-truth rule. The current setup makes every network call visible in the source of the screen that needs it, which is a much better default when debugging live-updating UIs.
