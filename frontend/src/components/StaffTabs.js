import React, { useState } from "react";
import { LayoutGrid, ListChecks, RefreshCw } from "lucide-react";

const DEFAULT_TABS = [
  { key: "tables", label: "Tables", Icon: LayoutGrid },
  { key: "queue", label: "Queue", Icon: ListChecks },
];

/**
 * Controlled tab strip. Does not touch the router — the parent owns the
 * active-tab state and swaps content in-place. That lets Admin embed the
 * same workspace without triggering a route change (and getting bounced
 * by ProtectedStaffRoute).
 *
 * The refresh button (when `onRefresh` is provided) lives immediately to the
 * right of the pill switcher. It plays a one-shot rotary spin on every click
 * (even if the network call finishes instantly) so the interaction always
 * feels responsive; the spinner keeps going while `refreshing` is true.
 */
export default function StaffTabs({
  current,
  onChange,
  tabs = DEFAULT_TABS,
  refreshing,
  onRefresh,
}) {
  const [clickSpin, setClickSpin] = useState(0);

  const handleRefresh = () => {
    setClickSpin((n) => n + 1);
    onRefresh?.();
  };

  return (
    <div className="mb-4 flex items-center gap-2 flex-wrap">
      <div className="inline-flex rounded-full bg-bg2/60 p-1">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            data-testid={`tab-${key}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition ${
              current === key
                ? "bg-white shadow-soft text-ink"
                : "text-ink2 hover:text-ink"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      {onRefresh && (
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          data-testid="staff-refresh-btn"
          title="Refresh"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink hover:text-brand rounded-full border border-bg2 hover:border-brand bg-surface px-3 py-1.5 shadow-soft transition disabled:opacity-50"
        >
          {/* key bump restarts the CSS animation on every click */}
          <RefreshCw
            key={clickSpin}
            size={13}
            className={
              refreshing
                ? "animate-spin"
                : clickSpin === 0
                ? ""
                : "animate-[spin_0.5s_ease-out_1]"
            }
          />
          <span>{refreshing ? "…" : "Refresh"}</span>
        </button>
      )}
    </div>
  );
}
