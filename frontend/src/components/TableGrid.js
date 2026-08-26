import React from "react";
import TableCard from "./TableCard";
import { OVERVIEW_STATUS } from "./StatusBadge";
import { Loader2 } from "lucide-react";

/**
 * Role-aware urgency: only counts a status as urgent if the current role
 * would actually be highlighted by it. This keeps a kitchen viewer from
 * seeing a READY_TO_SERVE (waiter-only) table floated to the top.
 */
function urgencyFor(table, role) {
  const status = table.overviewStatus;
  const waiterNeedsConfirm = (table.ordersAwaitingConfirmation || 0) > 0;
  const waiterNeedsServe = (table.itemsReadyToServe || 0) > 0;
  const kitchenBusy = (table.itemsInKitchen || 0) > 0;
  const cashierBillPending =
    !!table.billRequested || status === "BILL_REQUESTED";

  const baseline = OVERVIEW_STATUS[status]?.urgency ?? 0;

  if (role === "waiter") {
    if (waiterNeedsConfirm) return 4;
    if (waiterNeedsServe) return 4;
    return status === "AVAILABLE" ? 0 : 1;
  }
  if (role === "kitchen") {
    if (kitchenBusy) return 3;
    return status === "AVAILABLE" ? 0 : 1;
  }
  if (role === "cashier") {
    if (cashierBillPending) return 3;
    return status === "AVAILABLE" ? 0 : 1;
  }
  // Admin — fall back to raw overview urgency
  return baseline;
}

/**
 * Renders a responsive grid of TableCards, sorted so that tables the current
 * role needs to act on float to the top; AVAILABLE tables sink to the bottom.
 */
export default function TableGrid({ tables, role, activeTableId, onSelect, loading }) {
  if (loading && !tables?.length) {
    return (
      <div className="grid place-items-center py-20 text-ink2">
        <Loader2 className="animate-spin text-brand" size={28} />
      </div>
    );
  }

  if (!tables?.length) {
    return (
      <div className="text-center py-20 text-ink2 border border-dashed border-bg2 rounded-3xl">
        No tables configured.
      </div>
    );
  }

  const sorted = [...tables].sort((a, b) => {
    const ua = urgencyFor(a, role);
    const ub = urgencyFor(b, role);
    if (ub !== ua) return ub - ua;
    return String(a.tableNumber).localeCompare(String(b.tableNumber), undefined, {
      numeric: true,
    });
  });

  return (
    <div
      data-testid="table-grid"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
    >
      {sorted.map((t) => (
        <TableCard
          key={t.tableId}
          table={t}
          role={role}
          active={activeTableId === t.tableId}
          onClick={() => onSelect(t)}
        />
      ))}
    </div>
  );
}
