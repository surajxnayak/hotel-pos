# API Integration

Every HTTP call the frontend makes goes through `frontend/src/lib/api.js`. It is a single axios instance with two interceptors and one exported helper per backend endpoint.

## The axios instance

```js
export const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "http://localhost:8080",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});
```

- Timeout is 15s. Anything longer will fail with `ECONNABORTED`.
- The default `Content-Type` is JSON. There are no `multipart/form-data` uploads in this app.

## The request interceptor — token attachment

The interceptor decides which token (if any) to attach based on the URL:

| URL pattern                                                             | Attaches                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------- |
| Contains `/waiter/`, `/kitchen/`, `/cashier/`, `/bills`, `/admin/`, `/staff/me` | `Bearer <staff_token>` from `localStorage`     |
| Matches `/api/sessions/(create|join)/…` or `/api/customers/(me|logout)` | `Bearer <customerToken>` from `trattoria_customer` |
| Anything else                                                            | Nothing (endpoint is either public or session-token-in-URL) |

This means:

- Cart endpoints (`/api/cart/{sessionToken}/…`), submitted-order reads (`/api/orders/{orderId}`, `/api/sessions/{sessionToken}/orders`), bill reads (`/api/sessions/{sessionToken}/bill`) and the bill-request POST intentionally do **not** need any bearer header — the `sessionToken` in the URL is the auth.
- `GET /api/menu` is fully public.

## The response interceptor — error normalization

On any non-2xx or network failure, the interceptor rejects with:

```js
{ status, message, raw }
```

- `status` is the HTTP status when there is a response, or `undefined` for network errors.
- `message` is the backend's `ApiErrorResponse.message` when present; otherwise a helpful string (e.g. the "CORS or server down" hint when the browser blocks preflight).
- `raw` is the raw response body for the Debug console.

**Never** access `err.response.data.message` directly. Always destructure from the rejection value:

```js
try { … }
catch (e) { toast.error(e.message); if (e.status === 409) …; }
```

## Endpoint helpers

Every helper is a thin wrapper around one endpoint. They exist for:

- **Type-of-safety**: one place to enforce request shape.
- **Payload sanitization**: e.g. `addCartItem` strips any accidental `notes` field (backend rejects it for customers).
- **Date coercion**: `withIsoInstantRange` converts `YYYY-MM-DD` inputs to full ISO instants for analytics filters.

### Public

```js
getMenu()                   // GET /api/menu
```

### Customer identity

```js
customerLogin(phoneNumber)  // POST /api/customers/login
customerLogout()            // POST /api/customers/logout
getMySession()              // GET /api/customers/me/session
leaveTable()                // POST /api/customers/me/session/leave
```

### Sessions

```js
getSessionStatus(qrToken)   // GET /api/sessions/status/{qrToken}
createSession(qrToken)      // POST /api/sessions/create/{qrToken}
joinSession(qrToken, pin)   // POST /api/sessions/join/{qrToken}
```

### Cart

```js
getCart(sessionToken)                       // GET /api/cart/{sessionToken}
addCartItem(sessionToken, {                 // POST /api/cart/{sessionToken}/items
  menuItemId, quantity, selectedOptionIds?
})
updateCartItem(sessionToken, itemId, {      // PATCH /api/cart/{sessionToken}/items/{itemId}
  quantity
})
removeCartItem(sessionToken, itemId)        // DELETE …
submitCart(sessionToken)                    // POST /api/cart/{sessionToken}/submit
```

Notes:
- Customer cart calls **never** send a `notes` field — item notes are staff-only. `addCartItem` and `updateCartItem` explicitly strip it before sending.
- `selectedOptionIds` is only included when the array is non-empty (matches the API's expectation for plain items).

### Orders & bill

```js
getSessionOrders(sessionToken)              // GET /api/sessions/{sessionToken}/orders
getOrder(orderId)                           // GET /api/orders/{orderId}
requestBill(sessionToken)                   // POST /api/orders/bill-request/{sessionToken}
getSessionBill(sessionToken)                // GET /api/sessions/{sessionToken}/bill
```

### Staff auth + profile

```js
login(username, password)                   // POST /api/auth/login
getMyProfile() / updateMyProfile(body)      // GET/PATCH /api/staff/me
changeMyPassword({ currentPassword, newPassword }) // PATCH /api/staff/me/password
```

### Waiter

```js
waiterTablesList()                          // GET /api/waiter/tables
waiterTableDetail(tableId)                  // GET /api/waiter/tables/{tableId}
waiterStartTableSession(tableId)            // POST /api/waiter/tables/{tableId}/session
waiterPlaceOrder(tableId, items)            // POST /api/waiter/tables/{tableId}/orders
                                            // items: [{menuItemId, quantity, selectedOptionIds?}]
waiterRequestBillForTable(tableId)          // POST /api/waiter/tables/{tableId}/request-bill
waiterPending() / waiterReady()             // GET /api/waiter/orders/(pending|ready-to-serve)
waiterConfirm(orderId)                      // PATCH /api/waiter/orders/{orderId}/confirm
waiterServeItem(itemId)                     // PATCH /api/waiter/order-items/{itemId}/serve
waiterRemoveItem(orderId, itemId)           // DELETE /api/waiter/orders/{orderId}/items/{itemId}
waiterUpdateItem(orderId, itemId, {qty})    // PATCH …/items/{itemId}
waiterSetTableNote(tableId, note)           // PATCH /api/waiter/tables/{tableId}/note
waiterSetItemNote(itemId, note)             // PATCH /api/waiter/order-items/{itemId}/note
```

The walk-in order payload is **strictly** `{ items: [{ menuItemId, quantity, selectedOptionIds? }] }`. No `notes`. Item notes are set post-placement via `waiterSetItemNote`.

### Kitchen

```js
kitchenQueue()                              // GET /api/kitchen/queue
kitchenSetItemStatus(itemId, itemStatus)    // PATCH /api/kitchen/order-items/{itemId}/status
                                            // itemStatus is "PREPARING" or "READY"
kitchenTablesList()                         // GET /api/kitchen/tables
kitchenTableDetail(tableId)                 // GET /api/kitchen/tables/{tableId}
```

### Cashier

```js
cashierTablesList() / cashierTableDetail(tableId)
cashierRequested() / cashierPending()       // GET /api/bills/(requested|pending)
revertBillRequest(sessionId)                // PATCH /api/bills/{sessionId}/revert
generateBill(sessionId, {taxRatePercent, discount, tip?, tipRecipientStaffId?})
payBill(billId, paymentMethod, tip)         // PATCH /api/bills/{billId}/pay
payBillSplit(billId, payments, tip)         // PATCH /api/bills/{billId}/pay-split
voidBill(billId, reason)                    // PATCH /api/bills/{billId}/void
```

### Admin

`adminMe`, `adminSetPin`, `admin*Tables*`, `admin*Staff*`, `admin*Menu*`, `admin*Customization*`, `adminBills`, `admin(Revenue|TopItems|Timing)` — one helper per admin endpoint. All PIN-gated writes accept `pin` as their first meaningful positional argument (e.g. `adminCreateTable(pin, tables)`). See `lib/api.js` for the exact signature list.

## Adding a new endpoint

1. Add the helper to `lib/api.js` near its role's section.
2. Return `.then((r) => r.data)` so the caller sees the body directly.
3. Sanitize payload if the backend rejects extra fields (see `addCartItem` for the pattern).
4. Handle the specific error codes the endpoint can return where you call the helper — don't build generic error handlers.

## Debugging

Every request and every error is written to `debugStore` via `logInfo` / `logError`. Open the Debug console (floating button, bottom-right) and filter by `api` to see the timeline. For WebSocket events, filter by `ws`.
