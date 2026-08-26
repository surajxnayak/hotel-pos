import React from "react";

/**
 * A single small badge indicating a dish's dietary type.
 * `type` is one of "VEG" | "NON_VEG" | "EGG" | null | undefined.
 * Renders nothing when the field is missing so untagged items stay clean.
 */
export function DietaryBadge({ type, size = "sm", showLabel = false }) {
  if (!type) return null;
  const cfg = DIETARY_CFG[type];
  if (!cfg) return null;
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span
      data-testid={`dietary-${type}`}
      title={cfg.label}
      className={`inline-flex items-center gap-1 shrink-0 ${
        showLabel ? "text-[10px] uppercase tracking-widest font-semibold" : ""
      }`}
    >
      <span
        className={`${dim} grid place-items-center rounded-[3px] border-2 ${cfg.border}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      </span>
      {showLabel && <span className={cfg.text}>{cfg.label}</span>}
    </span>
  );
}

const DIETARY_CFG = {
  VEG: {
    label: "Veg",
    border: "border-emerald-600",
    dot: "bg-emerald-600",
    text: "text-emerald-700",
  },
  NON_VEG: {
    label: "Non-veg",
    border: "border-red-700",
    dot: "bg-red-700",
    text: "text-red-700",
  },
  EGG: {
    label: "Egg",
    border: "border-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
};

/**
 * Render a compact list of chosen customization options.
 * Accepts either a `selectedOptions` array (from OrderItemResponse) or a
 * `customizationSummary` string (from BillLineItem).
 */
export function SelectedOptions({ options, summary, testId }) {
  if (summary && typeof summary === "string") {
    return (
      <span
        data-testid={testId}
        className="text-[11px] text-ink2 italic block mt-0.5 leading-snug"
      >
        {summary}
      </span>
    );
  }
  if (!Array.isArray(options) || options.length === 0) return null;
  // Group by groupName for readability.
  const byGroup = {};
  options.forEach((o) => {
    (byGroup[o.groupName] ||= []).push(o);
  });
  return (
    <div
      data-testid={testId}
      className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-snug"
    >
      {Object.entries(byGroup).map(([group, opts]) => (
        <span key={group} className="text-ink2">
          <span className="uppercase tracking-wider text-ink2/70 text-[9px] font-semibold mr-1">
            {group}:
          </span>
          <span className="text-ink">
            {opts.map((o) => o.optionName).join(", ")}
          </span>
        </span>
      ))}
    </div>
  );
}
