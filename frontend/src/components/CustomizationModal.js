import React, { useMemo, useState } from "react";
import { X, Plus, Minus, Loader2, ShoppingBag, AlertTriangle } from "lucide-react";
import { DietaryBadge } from "./DietaryAndOptions";

/**
 * Modal that lets the diner configure a menu item before adding it to cart.
 * Only opened when `item.customizationGroups` is non-empty.
 *
 * Props:
 *   item                 — the MenuItemResponse
 *   onClose()            — dismiss
 *   onConfirm(selection) — called with { menuItemId, quantity, selectedOptionIds }
 *                          Server computes final unitPrice; we only PREVIEW here.
 *   busy                 — parent-controlled disable/spinner
 *   errorMessage         — 409 / server message to surface inline (optional)
 */
export default function CustomizationModal({
  item,
  onClose,
  onConfirm,
  busy,
  errorMessage,
}) {
  const groups = Array.isArray(item.customizationGroups)
    ? item.customizationGroups
    : [];
  const [quantity, setQuantity] = useState(1);
  // Selection state: { [groupId]: Set<optionId> } (Set works for both RADIO
  // and CHECKBOX; RADIO groups are just constrained to size 1).
  const [selection, setSelection] = useState(() => {
    const init = {};
    groups.forEach((g) => (init[g.id] = new Set()));
    return init;
  });

  const toggleOption = (group, optionId) => {
    setSelection((prev) => {
      const next = { ...prev };
      const set = new Set(prev[group.id] || []);
      if (group.type === "RADIO") {
        // Single-select — clicking an already-selected radio doesn't deselect
        set.clear();
        set.add(optionId);
      } else {
        if (set.has(optionId)) set.delete(optionId);
        else set.add(optionId);
      }
      next[group.id] = set;
      return next;
    });
  };

  const { totalUnitPrice, allRequiredSatisfied, selectedOptionIds } = useMemo(() => {
    const ids = [];
    let delta = 0;
    let ok = true;
    groups.forEach((g) => {
      const chosen = selection[g.id] || new Set();
      if (g.type === "RADIO" && g.required && chosen.size !== 1) ok = false;
      g.options.forEach((o) => {
        if (chosen.has(o.id)) {
          ids.push(o.id);
          delta += Number(o.priceDelta || 0);
        }
      });
    });
    return {
      totalUnitPrice: Number(item.price || 0) + delta,
      allRequiredSatisfied: ok,
      selectedOptionIds: ids,
    };
  }, [groups, selection, item.price]);

  const canConfirm = allRequiredSatisfied && quantity > 0 && !busy;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      menuItemId: item.id,
      quantity,
      selectedOptionIds,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-end sm:place-items-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="customization-modal"
        className="bg-surface w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-lift max-h-[90vh] overflow-hidden flex flex-col animate-fadeUp"
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-bg2">
          {item.imageUrl && (
            <div className="h-16 w-16 rounded-xl overflow-hidden bg-bg2 shrink-0">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <DietaryBadge type={item.dietaryType} />
              <h3 className="font-heading text-xl font-semibold truncate">
                {item.name}
              </h3>
            </div>
            {item.description && (
              <p className="text-xs text-ink2 line-clamp-2 leading-snug">
                {item.description}
              </p>
            )}
            <div className="mt-1 text-xs text-ink2">
              Base price:{" "}
              <span className="font-mono text-ink font-semibold">
                ₹{Number(item.price).toFixed(2)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink2 hover:text-ink p-1 rounded-full hover:bg-bg2 shrink-0"
            data-testid="customization-close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {item.allergens && (
            <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">Contains:</span> {item.allergens}
              </span>
            </div>
          )}
          {groups.map((g) => (
            <GroupBlock
              key={g.id}
              group={g}
              selection={selection[g.id] || new Set()}
              onToggle={(optionId) => toggleOption(g, optionId)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-bg2 px-5 py-4 space-y-3">
          {errorMessage && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {errorMessage}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center bg-bg rounded-full p-1">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                data-testid="customization-qty-dec"
                className="h-8 w-8 grid place-items-center rounded-full hover:bg-bg2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Minus size={14} />
              </button>
              <span
                className="w-8 text-center font-mono font-semibold"
                data-testid="customization-qty"
              >
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                data-testid="customization-qty-inc"
                className="h-8 w-8 grid place-items-center rounded-full hover:bg-bg2"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
                Per item
              </div>
              <div className="font-heading text-lg font-semibold text-brand tabular-nums">
                ₹{totalUnitPrice.toFixed(2)}
              </div>
            </div>
          </div>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            data-testid="customization-confirm"
            className="w-full flex items-center justify-center gap-2 rounded-full bg-brand hover:bg-brandHover text-white font-medium py-3 shadow-lift hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {busy ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <ShoppingBag size={16} />
            )}
            {allRequiredSatisfied
              ? `Add ${quantity} to cart · ₹${(totalUnitPrice * quantity).toFixed(2)}`
              : "Select required options"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupBlock({ group, selection, onToggle }) {
  const isRadio = group.type === "RADIO";
  const requiredUnmet = isRadio && group.required && selection.size !== 1;

  return (
    <div data-testid={`customization-group-${group.id}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="font-heading text-sm font-semibold">{group.name}</div>
        {group.required && (
          <span className="text-[9px] uppercase tracking-widest font-semibold text-destructive">
            Required
          </span>
        )}
        <span className="text-[10px] uppercase tracking-widest text-ink2 ml-auto">
          {isRadio ? "Pick one" : "Pick any"}
        </span>
      </div>
      <div className="space-y-1.5">
        {(group.options || []).map((o) => {
          const checked = selection.has(o.id);
          const delta = Number(o.priceDelta || 0);
          return (
            <label
              key={o.id}
              data-testid={`customization-option-${o.id}`}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition ${
                checked
                  ? "border-brand bg-brand/5"
                  : "border-bg2 hover:border-brand/40"
              }`}
            >
              <input
                type={isRadio ? "radio" : "checkbox"}
                name={`group-${group.id}`}
                checked={checked}
                onChange={() => onToggle(o.id)}
                className="accent-brand shrink-0"
              />
              <span className="flex-1 text-sm text-ink">{o.name}</span>
              <span className="text-xs font-mono text-ink2 shrink-0">
                {delta > 0
                  ? `+ ₹${delta.toFixed(2)}`
                  : delta < 0
                  ? `− ₹${Math.abs(delta).toFixed(2)}`
                  : "free"}
              </span>
            </label>
          );
        })}
      </div>
      {requiredUnmet && (
        <div className="mt-1.5 text-[11px] text-destructive">Please pick one.</div>
      )}
    </div>
  );
}
