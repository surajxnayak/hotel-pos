import React, { useEffect, useMemo, useState } from "react";
import { getMenu, waiterPlaceOrder } from "../lib/api";
import { toast } from "sonner";
import CustomizationModal from "./CustomizationModal";
import { SelectedOptions } from "./DietaryAndOptions";
import {
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  Loader2,
  ShoppingBag,
  Sliders,
} from "lucide-react";

/**
 * Compact, tap-fast menu picker for waiters.
 *
 * Left: menu (categories → items, tap "+" to add / bump quantity).
 * Right: local order draft with qty +/- per line.
 *
 * When a menu item exposes `customizationGroups`, tapping it opens the
 * SHARED `CustomizationModal` (the same one the customer uses) — every
 * selection variant becomes its own draft line, so a waiter can add
 * "Large + Extra Cheese × 2" and a plain build of the same dish alongside.
 *
 * On "Place Order", posts to POST /api/waiter/tables/{tableId}/orders
 * with the exact payload the backend expects:
 *   { items: [ { menuItemId, quantity, selectedOptionIds? } ] }
 * (No `notes` field — item notes are set post-placement via the note editor.)
 */
export default function WaiterItemPicker({ tableId, tableNumber, onClose, onPlaced }) {
  const [menu, setMenu] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  // draft: Array<{
  //   draftKey, menuItemId, menuItemName, unitPrice, quantity,
  //   selectedOptionIds: number[],
  //   selectedOptionsPreview: [{ groupName, optionName, priceDelta }] | []
  // }>
  const [draft, setDraft] = useState([]);
  // Item currently being configured in the customization modal (null = closed)
  const [customizeItem, setCustomizeItem] = useState(null);

  useEffect(() => {
    getMenu()
      .then((m) => setMenu(Array.isArray(m) ? m : []))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoadingMenu(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return menu;
    const q = query.toLowerCase();
    return menu
      .map((cat) => ({
        ...cat,
        items: (cat.items || []).filter((it) => it.name?.toLowerCase().includes(q)),
      }))
      .filter((c) => c.items.length > 0);
  }, [menu, query]);

  // Stable draft key so identical configurations merge into one line.
  const keyOf = (menuItemId, optionIds) => {
    const sorted = [...(optionIds || [])].sort((a, b) => a - b);
    return sorted.length ? `${menuItemId}:${sorted.join(",")}` : `${menuItemId}`;
  };

  // Build the "preview" [{ groupName, optionName, priceDelta }] rows for a given
  // set of option ids by walking the menu item's customizationGroups.
  const previewFor = (item, optionIds) => {
    const set = new Set(optionIds || []);
    const rows = [];
    (item.customizationGroups || []).forEach((g) => {
      (g.options || []).forEach((o) => {
        if (set.has(o.id)) {
          rows.push({
            groupName: g.name,
            optionName: o.name,
            priceDelta: Number(o.priceDelta || 0),
          });
        }
      });
    });
    return rows;
  };

  const addPlainItem = (item) => {
    const draftKey = keyOf(item.id, []);
    setDraft((prev) => {
      const idx = prev.findIndex((d) => d.draftKey === draftKey);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          draftKey,
          menuItemId: item.id,
          menuItemName: item.name,
          unitPrice: Number(item.price || 0),
          quantity: 1,
          selectedOptionIds: [],
          selectedOptionsPreview: [],
        },
      ];
    });
  };

  const addCustomizedItem = ({ menuItemId, quantity, selectedOptionIds }) => {
    const item = customizeItem;
    if (!item) return;
    const preview = previewFor(item, selectedOptionIds);
    const unitPrice =
      Number(item.price || 0) +
      preview.reduce((s, o) => s + Number(o.priceDelta || 0), 0);
    const draftKey = keyOf(menuItemId, selectedOptionIds);
    setDraft((prev) => {
      const idx = prev.findIndex((d) => d.draftKey === draftKey);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
        return next;
      }
      return [
        ...prev,
        {
          draftKey,
          menuItemId,
          menuItemName: item.name,
          unitPrice,
          quantity,
          selectedOptionIds: [...selectedOptionIds],
          selectedOptionsPreview: preview,
        },
      ];
    });
    setCustomizeItem(null);
    toast.success("Added to order");
  };

  const handleItemTap = (item) => {
    const hasCustomization =
      Array.isArray(item.customizationGroups) &&
      item.customizationGroups.length > 0;
    if (hasCustomization) {
      setCustomizeItem(item);
    } else {
      addPlainItem(item);
    }
  };

  const setQty = (draftKey, qty) => {
    setDraft((prev) => {
      if (qty <= 0) return prev.filter((d) => d.draftKey !== draftKey);
      return prev.map((d) => (d.draftKey === draftKey ? { ...d, quantity: qty } : d));
    });
  };

  const removeItem = (draftKey) => setQty(draftKey, 0);

  const draftCount = draft.reduce((s, i) => s + i.quantity, 0);
  const draftTotal = draft.reduce((s, i) => s + i.quantity * (i.unitPrice || 0), 0);

  const handlePlace = async () => {
    if (draft.length === 0) return;
    setBusy(true);
    try {
      const payload = draft.map((it) => {
        const row = { menuItemId: it.menuItemId, quantity: it.quantity };
        if (it.selectedOptionIds && it.selectedOptionIds.length > 0) {
          row.selectedOptionIds = it.selectedOptionIds;
        }
        return row;
      });
      const order = await waiterPlaceOrder(tableId, payload);
      toast.success(`Order placed — ${draftCount} item(s) sent to kitchen`);
      onPlaced?.(order);
    } catch (e) {
      const msg = e.message || "Failed to place order";
      if (e.status === 404) {
        toast.error("This table has no active order list — start one first.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  // Aggregate quantity per menu item for the "x N" badge shown on the left list.
  const perMenuItemQty = useMemo(() => {
    const m = new Map();
    draft.forEach((d) => m.set(d.menuItemId, (m.get(d.menuItemId) || 0) + d.quantity));
    return m;
  }, [draft]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="waiter-item-picker"
        className="bg-surface rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-lift animate-fadeUp flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bg2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-ink2 font-semibold">
              New Order · Table {tableNumber}
            </div>
            <div className="font-heading text-lg font-semibold">Pick items</div>
          </div>
          <button
            onClick={onClose}
            data-testid="picker-close"
            className="text-ink2 hover:text-ink p-1.5 rounded-full hover:bg-bg2"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 border-b border-bg2">
          <div className="flex items-center gap-2 bg-bg border border-bg2 rounded-xl px-3 py-2">
            <Search size={14} className="text-ink2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes…"
              data-testid="picker-search"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 overflow-hidden">
          {/* Menu */}
          <div className="overflow-y-auto px-5 py-3 border-b md:border-b-0 md:border-r border-bg2">
            {loadingMenu ? (
              <div className="grid place-items-center py-10">
                <Loader2 className="animate-spin text-brand" size={20} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-ink2 italic py-10 text-sm">
                No dishes match "{query}"
              </div>
            ) : (
              filtered.map((cat) => (
                <section key={cat.id} className="mb-4">
                  <div className="flex items-center gap-2 mb-1.5 text-[10px] uppercase tracking-widest text-ink2 font-semibold">
                    <span>{cat.name}</span>
                    <div className="flex-1 h-px bg-bg2" />
                  </div>
                  {cat.items?.map((it) => {
                    const cur = perMenuItemQty.get(it.id) || 0;
                    const disabled = !it.available;
                    const hasCustomization =
                      Array.isArray(it.customizationGroups) &&
                      it.customizationGroups.length > 0;
                    return (
                      <button
                        key={it.id}
                        onClick={() => !disabled && handleItemTap(it)}
                        disabled={disabled}
                        data-testid={`picker-item-${it.id}`}
                        title={hasCustomization ? "Choose options" : undefined}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left transition ${
                          disabled
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-bg"
                        } ${cur > 0 ? "bg-brand/10" : ""}`}
                      >
                        <span className="flex-1 truncate text-sm text-ink flex items-center gap-1.5">
                          {it.name}
                          {hasCustomization && (
                            <Sliders
                              size={10}
                              className="text-brand shrink-0"
                              strokeWidth={2.5}
                            />
                          )}
                        </span>
                        <span className="text-xs text-ink2 shrink-0 font-mono">
                          ₹{Number(it.price).toFixed(0)}
                        </span>
                        {cur > 0 && (
                          <span className="shrink-0 min-w-[22px] text-center text-xs font-mono font-bold text-brand bg-white rounded-full px-1.5 py-0.5">
                            ×{cur}
                          </span>
                        )}
                        {hasCustomization ? (
                          <Sliders
                            size={14}
                            className={disabled ? "text-ink2" : "text-brand"}
                            strokeWidth={2.5}
                          />
                        ) : (
                          <Plus
                            size={14}
                            className={disabled ? "text-ink2" : "text-brand"}
                          />
                        )}
                      </button>
                    );
                  })}
                </section>
              ))
            )}
          </div>

          {/* Draft */}
          <div className="overflow-y-auto px-5 py-3">
            <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold mb-2">
              Order draft · {draftCount} item{draftCount === 1 ? "" : "s"}
            </div>

            {draft.length === 0 ? (
              <div className="text-center text-ink2 py-10 text-sm border border-dashed border-bg2 rounded-2xl">
                <ShoppingBag className="mx-auto mb-2 text-brand" size={22} />
                Tap a dish on the left to build the order.
              </div>
            ) : (
              <div className="space-y-2">
                {draft.map((it) => (
                  <div
                    key={it.draftKey}
                    data-testid={`picker-draft-${it.draftKey}`}
                    className="bg-bg border border-bg2 rounded-xl p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ink truncate">
                          {it.menuItemName}
                        </div>
                        <div className="text-xs text-ink2 font-mono">
                          ₹{Number(it.unitPrice || 0).toFixed(2)}
                        </div>
                        <SelectedOptions
                          options={it.selectedOptionsPreview}
                          testId={`picker-draft-options-${it.draftKey}`}
                        />
                      </div>
                      <div className="flex items-center gap-0.5 bg-surface rounded-full px-1 py-0.5 border border-bg2">
                        <button
                          onClick={() => setQty(it.draftKey, it.quantity - 1)}
                          disabled={it.quantity <= 1}
                          data-testid={`picker-dec-${it.draftKey}`}
                          className="h-6 w-6 grid place-items-center rounded-full hover:bg-bg disabled:opacity-30"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-5 text-center text-xs font-mono font-bold">
                          {it.quantity}
                        </span>
                        <button
                          onClick={() => setQty(it.draftKey, it.quantity + 1)}
                          data-testid={`picker-inc-${it.draftKey}`}
                          className="h-6 w-6 grid place-items-center rounded-full hover:bg-bg"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(it.draftKey)}
                        data-testid={`picker-remove-${it.draftKey}`}
                        className="h-6 w-6 grid place-items-center rounded-full text-ink2 hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-bg2 px-5 py-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
              Est. Total
            </div>
            <div className="font-heading text-xl font-bold">
              ₹{draftTotal.toFixed(2)}
            </div>
          </div>
          <button
            onClick={handlePlace}
            disabled={busy || draft.length === 0}
            data-testid="picker-place-btn"
            className="flex items-center gap-2 rounded-full bg-brand hover:bg-brandHover text-white font-medium px-5 py-2.5 shadow-lift transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
            Place Order
          </button>
        </div>
      </div>

      {/* Reused customization picker — same modal the customer sees */}
      {customizeItem && (
        <CustomizationModal
          item={customizeItem}
          onClose={() => setCustomizeItem(null)}
          onConfirm={addCustomizedItem}
          busy={false}
        />
      )}
    </div>
  );
}
