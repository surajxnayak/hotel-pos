# WebSockets

Real-time updates are delivered via **STOMP over SockJS**, connecting to the backend's public `/ws` endpoint. Wrapping happens in `frontend/src/lib/ws.js`; every subscription in the app calls the same `createStompClient` factory.

## The factory

```js
const { deactivate } = createStompClient({
  subscriptions: [
    { topic: "/topic/waiter", handler: (payload) => … },
    { topic: `/topic/table/${sessionId}`, handler: (payload) => … },
  ],
  onConnect: () => refresh(), // called on FIRST connect AND every reconnect
});
```

Behavior:

- **Automatic reconnect**: `reconnectDelay: 3000` (3s) — the STOMP client keeps retrying forever until `deactivate()` is called.
- **Heartbeats**: `heartbeatIncoming` and `heartbeatOutgoing` are both 10s. If the backend is behind a proxy that idles out silent sockets, this prevents zombie connections.
- **Re-subscribe on reconnect**: `onConnect` unsubscribes previously-registered subs (from a dropped connection) before re-subscribing to avoid duplicate handlers.
- **`onConnect` fires on every reconnect, not just the first.** This is exactly where you want to hook REST reconciliation.

## Topics used by this app

| Topic                          | Payload                       | Subscribed by                       | Fires when                                                                 |
| ------------------------------ | ----------------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| `/topic/waiter`                | `OrderResponse`               | Waiter queue view                   | A new order transitions `CART → PLACED`.                                   |
| `/topic/kitchen`               | `OrderResponse`               | Kitchen queue view                  | An order becomes `CONFIRMED` / `PREPARING` / `READY`.                      |
| `/topic/cashier`               | `CashierNotice` (see below)   | Cashier queue view                  | Bill requested / reverted / generated / paid.                              |
| `/topic/table/{sessionId}`     | `OrderResponse`               | Customer's `OrderSession`           | Any status change on this session's orders (waiter confirm, kitchen progress, revert). |
| `/topic/cart/{sessionId}`      | `OrderResponse` (status `CART`)| Customer's `OrderSession`           | Any participant adds/edits/removes a cart item, or a new cart opens post-submit. |
| `/topic/tables`                | `TableSummaryResponse`        | Every staff role's table grid (via `useTableOverview`) | One table's overview changed — session create/join/leave, submit, confirm, item progress, bill events, free-session. |

`CashierNotice` shape (see API_REFERENCE.md):
```json
{ "event": "BILL_REQUESTED"|"BILL_REQUEST_REVERTED"|"BILL_GENERATED"|"BILL_PAID",
  "tableSessionId": 1, "tableNumber": "T1", "bill": BillResponse|null }
```

`/topic/tables` is a **single global channel** — not per-table. Every connected staff dashboard subscribes to the same topic and picks out the one tile matching the incoming `tableId`. Everything else is per-session (`{sessionId}` in the topic path).

## `{sessionId}` is the numeric session id, not the token

The topic path takes the numeric `sessionId` from `SessionResponse`, not the `sessionToken` string. Confusingly, cart/order endpoints in REST use the token; WS topics use the numeric id. Follow the API reference literally.

## Reliability requirement

A subscription does not survive a dropped connection, and reconnecting does **not** replay missed messages. That's why every view treats REST as the source of truth and re-fetches on every reconnect / tab focus / online event.

## When to add a new subscription

Only when the payload comes for free (same broadcast the backend is already sending). Never trigger extra backend work from the client just to get an update — poll REST or wait for the existing topic.

To subscribe from a new view, follow this shape:

```js
useEffect(() => {
  const refresh = () => { /* REST fetch */ };
  refresh();
  const { deactivate } = createStompClient({
    subscriptions: [{ topic: "/topic/whatever", handler: () => refresh() }],
    onConnect: refresh,
  });
  const onVis = () => document.visibilityState === "visible" && refresh();
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("online", refresh);
  return () => {
    deactivate();
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("online", refresh);
  };
}, [refresh]);
```

## Debugging

Every WS event is logged to `debugStore` with category `ws`. Open the Debug panel (bottom-right button) and filter by `ws` to see subscribes, messages, disconnects, and errors in order.
