# Architecture

## What this app is

Trattoria POS is a restaurant point-of-sale front-end. Diners scan a table QR code, order collaboratively from a shared cart on their phones, and staff manage the meal through role-specific dashboards. The backend is a separate Spring Boot service; this repo is **only the React frontend**.

## Where it fits

```
                            ┌─────────────────────────────┐
                            │      Spring Boot Backend    │
                            │  REST @ :8080  ·  /ws (WS)  │
                            └────────────┬────────────────┘
                                         │
                       REST (Axios)      │      STOMP over SockJS
                                         │
      ┌──────────────────────────────────┴─────────────────────────────────┐
      │                          React SPA (this repo)                     │
      │                                                                    │
      │  Customer flow                  Staff flow                         │
      │  ─────────────                  ──────────                         │
      │  /?qr=<token>                   /staff/login                       │
      │  /table                         /staff/waiter                      │
      │  /order      ◀── shared cart ──▶ /staff/kitchen                    │
      │                                 /staff/cashier                     │
      │                                 /staff/admin/*                     │
      └────────────────────────────────────────────────────────────────────┘
```

## Tech stack

| Layer            | Choice                          | Why                                                                       |
| ---------------- | ------------------------------- | ------------------------------------------------------------------------- |
| UI framework     | **React 19** (Create React App) | Zero-config, familiar, no server-side needed.                             |
| Language         | **JavaScript** (no TypeScript)  | Deliberate — keeps the surface small; DTOs are documented in `API_REFERENCE.md`. |
| Routing          | **react-router-dom v7**         | Client-side routing only. See [routing.md](./routing.md).                 |
| HTTP             | **axios**                       | Single instance in `lib/api.js` with request/response interceptors.       |
| Real-time        | **@stomp/stompjs + sockjs-client** | Matches the backend's SockJS+STOMP endpoint at `/ws`.                    |
| Styling          | **Tailwind CSS 3**              | Utility-first; a small design token layer lives in `tailwind.config.js` and `index.css`. |
| Icons            | **lucide-react**                | Line-icon set used everywhere; no emoji as UI icons.                      |
| Notifications    | **sonner**                      | Toast messages for both success and error paths.                          |
| State management | **React state + localStorage**  | No Redux/Zustand — component state + hooks; persistent session in localStorage. |

## The mental model

There are exactly three kinds of screens in this app:

1. **Customer screens** (`views/CustomerEntry`, `TablePicker`, `TableAccess`, `OrderSession`) — the diner's phone view.
2. **Role-specific staff dashboards** (`views/WaiterDashboard`, `KitchenDashboard`, `CashierDashboard`) — one route per role.
3. **Admin screens** (`views/Admin*`) — the admin has its own console page and can also *embed* any staff dashboard via `<Route path="/staff/admin/operate" />` (`AdminOperate.js`).

Every dashboard follows the same pattern:

```
StaffShell / AdminShell
  └── StaffTabs (Tables | Queue)
        ├── Tables view: TableGrid + drill-down DetailPanel
        └── Queue view:  role-specific per-item queue
```

## The two most important rules

### 1. REST is the source of truth. WebSockets are only an optimization.

The frontend never assumes it has seen every WS event. On every reconnect, tab focus (`visibilitychange`), and browser `online` event, it **re-fetches from REST**. See [data-flow.md](./data-flow.md).

### 2. The frontend never invents state the backend doesn't know about.

If it isn't in `API_REFERENCE.md`, it isn't real. Optimistic UI is used sparingly (see `justRequestedBill` in `OrderSession.js` for the one deliberate exception, and it explicitly self-heals when the server disagrees).

## Data direction summary

| Action                                | Direction                                            |
| ------------------------------------- | ---------------------------------------------------- |
| Customer views cart / adds item       | REST (`GET/POST /api/cart/...`) + WS `/topic/cart/{sessionId}` echoes updates. |
| Waiter confirms an order              | REST (`PATCH /api/waiter/orders/{id}/confirm`); triggers `/topic/kitchen` for the kitchen. |
| Kitchen marks item READY              | REST (`PATCH /api/kitchen/order-items/{id}/status`); triggers `/topic/waiter` (ready-to-serve) and `/topic/table/{sessionId}` (customer). |
| Cashier generates bill                | REST (`POST /api/bills/{sessionId}/generate`); triggers `/topic/cashier` `BILL_GENERATED`. |
| Any table changes (session/orders)    | WS `/topic/tables` broadcasts one refreshed `TableSummaryResponse`. |

## What the frontend does **not** own

- Order state transitions (`PLACED → CONFIRMED → PREPARING → READY → SERVED → BILL_REQUESTED → PAID/CANCELLED`) — all server-side.
- Price calculation — `unitPrice` on `OrderItemResponse` already bakes in every `priceDelta` from customization selections.
- Session PIN, `qrToken`, or `sessionToken` — issued by the backend on `create`/`join`; the client just stores + echoes them.
