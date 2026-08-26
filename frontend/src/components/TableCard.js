import React from "react";
import StatusBadge, { OVERVIEW_STATUS } from "./StatusBadge";
import { Users, ChefHat, Bell, AlertCircle } from "lucide-react";

/**
 * Compute what THIS role needs to act on for this table.
 * Returns null when nothing is actionable for the role (i.e. the tile stays
 * neutral even if another role would consider it urgent).
 *
 * Waiter cares about ordersAwaitingConfirmation / itemsReadyToServe.
 * Kitchen cares about itemsInKitchen (CONFIRMED + PREPARING).
 * Cashier cares about a bill request.
 * Admin sees a union of the above (Operate-mode picks its own role separately).
 */
function computeRoleAlert(table, role) {
  const status = table.overviewStatus;
  const waiterNeedsConfirm = (table.ordersAwaitingConfirmation || 0) > 0;
  const waiterNeedsServe = (table.itemsReadyToServe || 0) > 0;
  const kitchenBusy = (table.itemsInKitchen || 0) > 0;
  const cashierBillPending =
    !!table.billRequested || status === "BILL_REQUESTED";

  if (role === "waiter") {
    if (waiterNeedsConfirm) return "NEEDS_CONFIRMATION";
    if (waiterNeedsServe) return "READY_TO_SERVE";
    return null;
  }
  if (role === "kitchen") {
    if (kitchenBusy) return "PREPARING";
    return null;
  }
  if (role === "cashier") {
    if (cashierBillPending) return "BILL_REQUESTED";
    return null;
  }
  if (role === "admin") {
    if (waiterNeedsConfirm) return "NEEDS_CONFIRMATION";
    if (waiterNeedsServe) return "READY_TO_SERVE";
    if (cashierBillPending) return "BILL_REQUESTED";
    if (kitchenBusy) return "PREPARING";
    return null;
  }
  return null;
}

/**
 * A single tile representing one table.
 *
 * Highlight rules (Feb 2026):
 * - AVAILABLE: dimmed, dashed border, "disabled-looking".
 * - Occupied but nothing for this role to act on: neutral surface tile.
 * - Occupied AND this role needs to act: coloured tone + ring + pulsing dot.
 */
export default function TableCard({ table, role = "waiter", onClick, active }) {
  const status = table.overviewStatus || "AVAILABLE";
  const isAvailable = status === "AVAILABLE";
  // Waiter can open AVAILABLE tables (to start a walk-in session).
  const clickable = !isAvailable || role === "waiter";

  const alertStatus = isAvailable ? null : computeRoleAlert(table, role);
  const cfg = alertStatus ? OVERVIEW_STATUS[alertStatus] : null;

  // Build the wrapper classes based on state.
  let wrapperClasses;
  if (isAvailable) {
    wrapperClasses = clickable
      ? "bg-bg/40 border-dashed border-bg2 hover:border-brand hover:bg-brand/5 opacity-90 cursor-pointer"
      : "bg-bg/40 border-bg2 opacity-60 cursor-not-allowed";
  } else if (cfg) {
    // Actionable for this role — coloured tone
    wrapperClasses = `${cfg.tone.replace("text-", "border-").replace("border-red-700", "border-red-200")} ${cfg.tone} hover:-translate-y-0.5 hover:shadow-lift cursor-pointer`;
  } else {
    // Occupied but nothing for this role to do — neutral tile
    wrapperClasses =
      "bg-surface border-bg2 hover:-translate-y-0.5 hover:shadow-lift cursor-pointer";
  }

  const ringClasses = active
    ? "ring-2 ring-brand ring-offset-2 ring-offset-bg shadow-lift"
    : cfg
    ? `ring-2 ${cfg.ring} ring-offset-2 ring-offset-bg`
    : "hover:ring-2 hover:ring-bg2 ring-offset-2 ring-offset-bg";

  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      data-testid={`table-card-${table.tableId}`}
      className={`group relative text-left rounded-2xl border transition-all p-4 min-h-[130px] ${wrapperClasses} ${ringClasses}`}
    >
      {/* Urgency accent — pulsing dot only when THIS role needs to act */}
      {cfg && (
        <div
          data-testid={`table-card-alert-dot-${table.tableId}`}
          className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${cfg.dot} animate-pulse ring-2 ring-white`}
        />
      )}

      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
            Table
          </div>
          <div
            className={`font-heading text-3xl font-bold leading-none tracking-tight ${
              isAvailable ? "text-ink2" : "text-ink"
            }`}
          >
            {table.tableNumber || "—"}
          </div>
        </div>
        {cfg ? (
          <StatusBadge status={alertStatus} />
        ) : !isAvailable ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border border-bg2 bg-bg/60 text-ink2">
            <span className="h-1.5 w-1.5 rounded-full bg-ink2/50" />
            {OVERVIEW_STATUS[status]?.label || "Occupied"}
          </span>
        ) : null}
      </div>

      {!isAvailable && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink2">
          {table.participantCount != null && (
            <span className="inline-flex items-center gap-1">
              <Users size={11} />
              {table.participantCount}
            </span>
          )}

          {role === "waiter" && cfg && (
            <>
              {!!table.ordersAwaitingConfirmation && (
                <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                  <AlertCircle size={11} />
                  {table.ordersAwaitingConfirmation}
                </span>
              )}
              {!!table.itemsReadyToServe && (
                <span className="inline-flex items-center gap-1 text-orange-700 font-semibold">
                  <Bell size={11} />
                  {table.itemsReadyToServe}
                </span>
              )}
            </>
          )}

          {role === "kitchen" && cfg && !!table.itemsInKitchen && (
            <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
              <ChefHat size={11} />
              {table.itemsInKitchen}
            </span>
          )}

          {role === "admin" && cfg && (
            <>
              {!!table.ordersAwaitingConfirmation && (
                <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                  <AlertCircle size={11} />
                  {table.ordersAwaitingConfirmation}
                </span>
              )}
              {!!table.itemsInKitchen && (
                <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                  <ChefHat size={11} />
                  {table.itemsInKitchen}
                </span>
              )}
              {!!table.itemsReadyToServe && (
                <span className="inline-flex items-center gap-1 text-orange-700 font-semibold">
                  <Bell size={11} />
                  {table.itemsReadyToServe}
                </span>
              )}
            </>
          )}

          {role === "cashier" && table.orderCount != null && (
            <span className="text-ink2">{table.orderCount} orders</span>
          )}
        </div>
      )}

      {isAvailable && (
        <div className="mt-6 text-xs italic">
          {role === "waiter" ? (
            <span className="text-brand font-medium">Tap to start table</span>
          ) : (
            <span className="text-ink2/70">No active session</span>
          )}
        </div>
      )}
    </button>
  );
}
