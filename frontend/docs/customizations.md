# Customizations

Some menu items (portion size, add-ons, dietary swaps) let the diner pick options that adjust the price. This document traces the customization system end-to-end.

## The domain model

From the API reference:

```
CustomizationGroup {
  id, name,
  type: "RADIO" | "CHECKBOX",
  required: boolean,
  options: [ CustomizationOption { id, name, priceDelta } ]
}
```

Rules:
- Every `required: true` group must have exactly **one** selection (409 if missing).
- `RADIO` groups (required or not) accept **at most one** selection (409 if two are sent).
- `CHECKBOX` groups accept any number, including zero.
- Selections are locked at add-time. You cannot change a size on an already-added item — remove it and re-add with different options.
- `unitPrice` on the returned order/cart item already includes every selected `priceDelta`. No client-side math needed.

## Where the data appears

`MenuItemResponse.customizationGroups` is populated **only** when the admin has configured groups for that item. For most items it's an empty array — treat that as "no customization, add directly".

## The shared picker

`components/CustomizationModal.js` is the single UI for choosing options. Both the customer's menu (`views/OrderSession.js`) and the waiter's walk-in composer (`components/WaiterItemPicker.js`) reuse this exact component.

Its `onConfirm` payload is the same in both call-sites:

```js
{ menuItemId, quantity, selectedOptionIds }
```

The parent decides what to do with it:
- Customer → `addCartItem(sessionToken, payload)` → `POST /api/cart/{sessionToken}/items`.
- Waiter → append to the local order draft; on "Place Order" → `waiterPlaceOrder(tableId, items)` → `POST /api/waiter/tables/{tableId}/orders`.

## Backend payload shape

Both endpoints accept the same per-item shape:

```json
{ "menuItemId": 1, "quantity": 2, "selectedOptionIds": [3, 4] }
```

- `selectedOptionIds` is optional (omit or send `[]` for an item with no groups).
- Order matters not — the backend groups them internally by their configured group.

## Rendering selected options in staff views

Anywhere an item is shown after it's been ordered, we render its selections via `components/DietaryAndOptions.js → SelectedOptions`:

- `OrderList.js` (used by every table drill-down)
- `WaiterDashboard.js → ItemList` (queue view: Pending + Ready to Serve columns)
- `KitchenDashboard.js` queue view (per-item cards) — critical, since the kitchen needs the exact variant to cook.
- `OrderSession.js` cart + orders tabs (customer sees their own selections, without staff notes)
- `WaiterItemPicker.js` draft column (waiter reviews what's about to be sent)

Bills use a flat `customizationSummary` string ("Large, Extra Cheese") in `BillLineItem`, not the structured list — `SelectedOptions` handles both via its `summary` prop.

## Handling failures

The most common 409 errors:

| Message                                            | Fix                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| "Missing selection for required group '…'."        | The user submitted without picking a RADIO option for a required group. `CustomizationModal` gates its submit button on this — this 409 usually means a race with an admin editing groups mid-order. |
| "Group '…' is RADIO but multiple options given."   | Frontend bug — `RADIO` toggling in the modal should have cleared the set. Check `toggleOption` in `CustomizationModal.js`. |
| "Menu item unavailable."                           | Admin toggled the item off between menu load and submit. Refresh the menu. |

## Adding a new customization group (admin flow)

1. Open `/staff/admin/menu` and pick the item.
2. `CustomizationBuilder.js` opens; add a group (`RADIO` / `CHECKBOX`, `required` boolean, options with `priceDelta`).
3. Submit — the frontend calls `adminCreateCustomizationGroups(itemId, pin, groups)` → `POST /api/admin/menu/items/{itemId}/customization-groups`.
4. From the next `GET /api/menu` refresh, the item's card will render a "Customizable" pill and the tap will open `CustomizationModal` instead of adding directly.

Deleting a group later is safe — historic orders and bills keep a permanent snapshot (`OrderItemResponse.selectedOptions`, `BillLineItem.customizationSummary`), so removing the live group never rewrites history.
