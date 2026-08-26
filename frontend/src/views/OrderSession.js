import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMenu,
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  submitCart,
  getSessionOrders,
  getOrder,
  requestBill,
  getSessionBill,
  leaveTable,
  customerLogout,
} from "../lib/api";
import { loadSession, clearSession, loadOrderIds, saveOrderIds, clearCustomer, loadCustomer } from "../lib/session";
import { createStompClient } from "../lib/ws";
import { toast } from "sonner";
import { DietaryBadge, SelectedOptions } from "../components/DietaryAndOptions";
import CustomizationModal from "../components/CustomizationModal";
import Receipt from "../components/Receipt";
import {
  Plus,
  Minus,
  Trash2,
  Send,
  Receipt as ReceiptIcon,
  LogOut,
  DoorOpen,
  ShoppingBag,
  ClipboardList,
  ChefHat,
  Bell,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Copy,
  Users,
  UtensilsCrossed,
  MoreVertical,
  AlertTriangle,
  Sliders,
  Printer,
  Search,
  Leaf,
  Ban,
  ArrowDownUp,
  SearchX,
  SlidersHorizontal,
} from "lucide-react";

const STATUS_COLORS = {
  PENDING: "bg-slate-100 text-slate-700",
  PLACED: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-amber-100 text-amber-800",
  READY: "bg-emerald-100 text-emerald-800",
  SERVED: "bg-successc/15 text-successc",
  BILL_REQUESTED: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-red-100 text-red-700 line-through",
};

const STATUS_ICON = {
  PENDING: ClipboardList,
  PLACED: ClipboardList,
  CONFIRMED: CheckCircle2,
  PREPARING: ChefHat,
  READY: Bell,
  SERVED: CheckCircle2,
  BILL_REQUESTED: ReceiptIcon,
  CANCELLED: XCircle,
};

export default function OrderSession() {
  const nav = useNavigate();
  const sess = loadSession();
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState(null);
  const [orders, setOrders] = useState([]); // submitted orders
  const [activeTab, setActiveTab] = useState("menu"); // menu | cart | track
  const [busyId, setBusyId] = useState(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [showConfirmBill, setShowConfirmBill] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmSignout, setConfirmSignout] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  // Optimistic lock: flips to `true` the instant we successfully request a bill,
  // and back to `false` as soon as the server state shows no BILL_REQUESTED order.
  const [justRequestedBill, setJustRequestedBill] = useState(false);
  const cartRef = useRef(null);
  const ordersIdsRef = useRef(new Set(loadOrderIds()));

  // Detect if a session-close error means we should kick to landing
  const handleSessionEnded = useCallback(
    (err) => {
      const status = err?.status;
      const msg = (err?.message || "").toLowerCase();
      const looksClosed =
        status === 404 ||
        status === 410 ||
        msg.includes("closed") ||
        msg.includes("session over") ||
        msg.includes("no active session") ||
        msg.includes("session not found");
      if (looksClosed) {
        toast.success("Your session has ended. Thanks for visiting!");
        clearSession();
        nav(sess?.qrToken ? `/?qr=${encodeURIComponent(sess.qrToken)}` : "/");
        return true;
      }
      return false;
    },
    [nav, sess?.qrToken]
  );

  const refreshCart = useCallback(async () => {
    if (!sess?.sessionToken) return;
    try {
      const c = await getCart(sess.sessionToken);
      setCart(c);
    } catch (e) {
      if (handleSessionEnded(e)) return;
      toast.error(e.message);
    }
  }, [sess?.sessionToken, handleSessionEnded]);

  const refreshOrders = useCallback(async () => {
    if (!sess?.sessionToken) return;
    // Primary path: single call fetches ALL submitted orders for this session.
    try {
      const list = await getSessionOrders(sess.sessionToken);
      if (Array.isArray(list)) {
        const sorted = [...list].sort((a, b) => b.id - a.id);
        setOrders(sorted);
        const ids = new Set(sorted.map((o) => o.id));
        ordersIdsRef.current = ids;
        saveOrderIds([...ids]);
        return;
      }
    } catch (e) {
      if (handleSessionEnded(e)) return;
      // Fall through to per-id fallback for older backends
    }
    // Fallback: reconcile each known id individually (works even without the new endpoint).
    const ids = ordersIdsRef.current;
    if (ids.size === 0) return;
    try {
      const fresh = await Promise.all([...ids].map((id) => getOrder(id).catch(() => null)));
      const alive = fresh.filter(Boolean).sort((a, b) => b.id - a.id);
      setOrders(alive);
      const aliveIds = new Set(alive.map((o) => o.id));
      ordersIdsRef.current = aliveIds;
      saveOrderIds([...aliveIds]);
    } catch (e) {
      /* handled in interceptor */
    }
  }, [sess?.sessionToken, handleSessionEnded]);

  // Initial load: session guard + menu + cart + hydrate orders from persisted ids
  useEffect(() => {
    if (!sess?.sessionToken) {
      nav("/");
      return;
    }
    getMenu()
      .then(setMenu)
      .catch((e) => toast.error(e.message));
    refreshCart();
    refreshOrders();
  }, [nav, sess?.sessionToken, refreshCart, refreshOrders]);

  // WebSocket subscriptions with REST reconciliation on connect / visibility / online
  useEffect(() => {
    if (!sess?.sessionId) return;

    const reconcile = () => {
      refreshCart();
      refreshOrders();
    };

    const { deactivate } = createStompClient({
      subscriptions: [
        {
          topic: `/topic/cart/${sess.sessionId}`,
          handler: (payload) => {
            if (!payload) return;
            if (payload.status === "CART") {
              setCart(payload);
              cartRef.current?.classList?.remove("animate-pop");
              // trigger reflow to restart animation
              void cartRef.current?.offsetWidth;
              cartRef.current?.classList?.add("animate-pop");
            } else {
              // submitted order broadcast
              ordersIdsRef.current.add(payload.id);
              saveOrderIds([...ordersIdsRef.current]);
              setOrders((prev) => {
                const others = prev.filter((o) => o.id !== payload.id);
                return [payload, ...others].sort((a, b) => b.id - a.id);
              });
            }
          },
        },
        {
          topic: `/topic/table/${sess.sessionId}`,
          handler: (payload) => {
            if (!payload) return;
            ordersIdsRef.current.add(payload.id);
            saveOrderIds([...ordersIdsRef.current]);
            setOrders((prev) => {
              const others = prev.filter((o) => o.id !== payload.id);
              return [payload, ...others].sort((a, b) => b.id - a.id);
            });
            if (payload.status === "READY") {
              toast.success("An item is ready!");
            }
            if (payload.status === "BILL_REQUESTED") {
              toast.info("Bill requested — waiting for the cashier");
            }
            if (payload.status === "SERVED") {
              // Might indicate a revert from BILL_REQUESTED
              toast.success("You can keep ordering — bill request cancelled");
            }
          },
        },
      ],
      onConnect: reconcile,
    });

    const onVisible = () => document.visibilityState === "visible" && reconcile();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", reconcile);

    return () => {
      deactivate();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", reconcile);
    };
  }, [sess?.sessionId, refreshCart, refreshOrders]);

  // Combined: any server-confirmed BILL_REQUESTED order OR our optimistic just-clicked flag.
  const serverBillRequested = orders.some((o) => o.status === "BILL_REQUESTED");
  const billRequested = serverBillRequested || justRequestedBill;

  // Once the server confirms no BILL_REQUESTED order exists (i.e., after revert),
  // clear the optimistic flag so the UI re-enables cleanly.
  useEffect(() => {
    if (!serverBillRequested && justRequestedBill) {
      // Only clear if we have at least one order visible (i.e., a real reconciliation happened,
      // not the empty-array we saw between the click and the first fetch).
      if (orders.length > 0) setJustRequestedBill(false);
    }
  }, [serverBillRequested, justRequestedBill, orders.length]);

  // When bill is requested, force any user viewing the cart tab back to menu.
  useEffect(() => {
    if (billRequested) {
      setActiveTab((tab) => (tab === "cart" ? "menu" : tab));
    }
  }, [billRequested]);

  // Menu item currently being configured in the customization modal (null = closed)
  const [customizeItem, setCustomizeItem] = useState(null);
  const [customizeBusy, setCustomizeBusy] = useState(false);
  const [customizeErr, setCustomizeErr] = useState("");

  // Customer receipt viewer
  const [bill, setBill] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  const [showBill, setShowBill] = useState(false);

  const openBill = useCallback(async () => {
    if (!sess?.sessionToken) return;
    setShowBill(true);
    setBillLoading(true);
    try {
      const b = await getSessionBill(sess.sessionToken);
      setBill(b);
    } catch (e) {
      if (e.status === 404) {
        setBill(null);
        toast.info("Your bill hasn't been generated yet.");
      } else {
        toast.error(e.message);
      }
    } finally {
      setBillLoading(false);
    }
  }, [sess?.sessionToken]);

  if (!sess) return null;

  const cartCount = cart?.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
  const cartTotal = cart?.items?.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0) || 0;

  const handleAdd = async (menuItem) => {
    // If the item has customization groups, open the picker instead of adding directly.
    if (
      Array.isArray(menuItem.customizationGroups) &&
      menuItem.customizationGroups.length > 0
    ) {
      setCustomizeErr("");
      setCustomizeItem(menuItem);
      return;
    }
    setBusyId(`add-${menuItem.id}`);
    try {
      // Client-side dedup: if this menu item is already in the cart with NO
      // customizations, just bump its quantity rather than creating a new line.
      const existing = cart?.items?.find(
        (i) =>
          i.menuItemId === menuItem.id &&
          (!i.selectedOptions || i.selectedOptions.length === 0)
      );
      let updated;
      if (existing) {
        updated = await updateCartItem(sess.sessionToken, existing.id, {
          quantity: (existing.quantity || 0) + 1,
        });
      } else {
        updated = await addCartItem(sess.sessionToken, {
          menuItemId: menuItem.id,
          quantity: 1,
        });
      }
      setCart(updated);
      toast.success(existing ? "Quantity updated" : "Added to cart");
    } catch (e) {
      if (handleSessionEnded(e)) return;
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleAddCustomized = async ({ menuItemId, quantity, selectedOptionIds }) => {
    setCustomizeErr("");
    setCustomizeBusy(true);
    try {
      const updated = await addCartItem(sess.sessionToken, {
        menuItemId,
        quantity,
        selectedOptionIds,
      });
      setCart(updated);
      toast.success("Added to cart");
      setCustomizeItem(null);
    } catch (e) {
      if (handleSessionEnded(e)) return;
      setCustomizeErr(e.message || "Failed to add");
    } finally {
      setCustomizeBusy(false);
    }
  };

  const handleQty = async (item, delta) => {
    const newQty = (item.quantity || 0) + delta;
    if (newQty < 1) return;
    setBusyId(`qty-${item.id}`);
    try {
      const c = await updateCartItem(sess.sessionToken, item.id, { quantity: newQty });
      setCart(c);
    } catch (e) {
      if (handleSessionEnded(e)) return;
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (item) => {
    setBusyId(`rm-${item.id}`);
    try {
      const c = await removeCartItem(sess.sessionToken, item.id);
      setCart(c);
      toast.success("Removed");
    } catch (e) {
      if (handleSessionEnded(e)) return;
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmit = async () => {
    if (!cart?.items?.length) return;
    setSubmitBusy(true);
    try {
      const placed = await submitCart(sess.sessionToken);
      ordersIdsRef.current.add(placed.id);
      saveOrderIds([...ordersIdsRef.current]);
      setOrders((prev) => [placed, ...prev.filter((o) => o.id !== placed.id)]);
      toast.success(`Order #${placed.id} placed!`);
      await refreshCart();
      setActiveTab("track");
    } catch (e) {
      if (handleSessionEnded(e)) return;
      toast.error(e.message);
    } finally {
      setSubmitBusy(false);
    }
  };

  const handleRequestBill = async () => {
    try {
      await requestBill(sess.sessionToken);
      // 1) Instantly lock the UI so no more actions slip through the async gap.
      setJustRequestedBill(true);
      // 2) Force-refresh orders from REST so the state is genuinely in sync,
      //    not just optimistically flipped.
      refreshOrders();
      toast.success("Bill requested. The cashier will bring it shortly.");
      setShowConfirmBill(false);
    } catch (e) {
      if (handleSessionEnded(e)) return;
      toast.error(e.message);
    }
  };

  const handleLeaveTable = async () => {
    setActionBusy(true);
    try {
      await leaveTable();
      toast.success("You've left the table. Your friends can keep ordering.");
    } catch (e) {
      // 409 = wasn't in any session; silently proceed to clear local state.
      if (e.status !== 409) toast.error(e.message);
    } finally {
      clearSession();
      setActionBusy(false);
      setConfirmLeave(false);
      nav("/");
    }
  };

  const handleSignOut = async () => {
    setActionBusy(true);
    try {
      // Best-effort: leave any active table first so the server-side roster stays clean.
      await leaveTable().catch(() => {});
      await customerLogout().catch(() => {});
    } finally {
      clearSession();
      clearCustomer();
      setActionBusy(false);
      setConfirmSignout(false);
      toast.success("Signed out");
      nav("/");
    }
  };

  const copyPin = () => {
    navigator.clipboard?.writeText(sess.pin);
    setPinCopied(true);
    setTimeout(() => setPinCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-bg pb-32">
      {/* Sticky header with PIN badge */}
      <header className="sticky top-0 z-40 glass border-b border-white/40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-ink2 font-semibold">
              Table {sess.tableNumber}
            </div>
            <div className="font-heading text-lg font-semibold">Your shared order</div>
          </div>
          <button
            onClick={copyPin}
            data-testid="pin-badge"
            className="group flex items-center gap-2 bg-brand/10 hover:bg-brand/15 border border-brand/20 rounded-2xl px-3 py-2 transition"
            title="Tap to copy PIN"
          >
            <Users size={14} className="text-brand" />
            <div className="text-left">
              <div className="text-[9px] uppercase tracking-widest text-brand/80 font-semibold">
                PIN
              </div>
              <div className="font-mono font-bold tracking-[0.3em] text-brand text-sm">
                {sess.pin}
              </div>
            </div>
            {pinCopied ? (
              <CheckCircle2 size={14} className="text-successc" />
            ) : (
              <Copy size={12} className="text-brand/60 group-hover:text-brand" />
            )}
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              data-testid="header-menu-btn"
              className="text-ink2 hover:text-ink p-2 rounded-full hover:bg-bg2 transition"
              title="Session menu"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  data-testid="header-menu"
                  className="absolute right-0 mt-2 w-52 z-50 bg-surface border border-bg2 rounded-2xl shadow-lift overflow-hidden animate-fadeUp"
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmLeave(true);
                    }}
                    data-testid="leave-table-btn"
                    className="w-full text-left px-4 py-3 hover:bg-bg text-sm flex items-center gap-2.5 border-b border-bg2"
                  >
                    <DoorOpen size={14} className="text-ink2" />
                    <div>
                      <div className="font-medium text-ink">Leave table</div>
                      <div className="text-[11px] text-ink2">Others keep ordering</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmSignout(true);
                    }}
                    data-testid="signout-btn"
                    className="w-full text-left px-4 py-3 hover:bg-destructive/5 text-sm flex items-center gap-2.5"
                  >
                    <LogOut size={14} className="text-destructive" />
                    <div>
                      <div className="font-medium text-destructive">Sign out</div>
                      <div className="text-[11px] text-ink2">
                        Forget +91 {loadCustomer()?.phoneNumber || ""}
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-1">
          {[
            { id: "menu", label: "Menu", icon: ShoppingBag, disabled: false },
            {
              id: "cart",
              label: `Cart (${cartCount})`,
              icon: ClipboardList,
              disabled: billRequested,
            },
            { id: "track", label: `Orders (${orders.length})`, icon: ChefHat, disabled: false },
          ].map((t) => {
            const Icon = t.icon;
            const isDisabled = t.disabled;
            return (
              <button
                key={t.id}
                onClick={() => !isDisabled && setActiveTab(t.id)}
                disabled={isDisabled}
                data-testid={`tab-${t.id}`}
                title={isDisabled ? "Bill has been requested" : undefined}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === t.id
                    ? "bg-brand text-white shadow-soft"
                    : isDisabled
                    ? "text-ink2/40 cursor-not-allowed"
                    : "text-ink2 hover:bg-bg2/60"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Elegant "bill requested" banner */}
      {billRequested && (
        <div
          data-testid="bill-requested-banner"
          className="sticky top-[104px] z-30 max-w-3xl mx-auto px-4 pt-4 animate-fadeUp"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-soft">
            <div className="h-9 w-9 rounded-full bg-amber-100 grid place-items-center shrink-0">
              <ReceiptIcon size={16} className="text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-semibold text-amber-900">
                Bill on its way
              </div>
              <p className="text-sm text-amber-800/80 leading-snug mt-0.5">
                Your bill has been requested. Ordering is paused while the cashier prepares it —
                feel free to keep browsing the menu. If you'd like to add more, ask a waiter to
                send it back.
              </p>
              <button
                onClick={openBill}
                data-testid="banner-view-bill-btn"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 hover:text-amber-950 rounded-full border border-amber-300 hover:bg-amber-100 px-3 py-1 transition"
              >
                <ReceiptIcon size={12} />
                View bill
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 pt-6">
        {activeTab === "menu" && (
          <MenuView menu={menu} onAdd={handleAdd} busyId={busyId} disabled={billRequested} />
        )}
        {activeTab === "cart" && (
          <CartView
            cartRef={cartRef}
            cart={cart}
            onQty={handleQty}
            onRemove={handleRemove}
            busyId={busyId}
          />
        )}
        {activeTab === "track" && <OrdersView orders={orders} />}
      </main>

      {/* Sticky footer actions */}
      {activeTab === "cart" && !billRequested && cart?.items?.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-white/40">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink2">Total</div>
              <div className="font-heading text-xl font-semibold">₹{cartTotal.toFixed(2)}</div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitBusy}
              data-testid="submit-order-btn"
              className="flex-1 flex items-center justify-center gap-2 rounded-full bg-brand hover:bg-brandHover text-white font-medium py-3 shadow-lift hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {submitBusy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              Submit Order
            </button>
          </div>
        </div>
      )}

      {activeTab === "track" && orders.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-white/40">
          <div className="max-w-3xl mx-auto px-4 py-3 flex gap-2">
            {!billRequested && (
              <button
                onClick={() => setShowConfirmBill(true)}
                data-testid="request-bill-btn"
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-ink hover:bg-black text-white font-medium py-3 shadow-lift hover:-translate-y-0.5 transition-all"
              >
                <ReceiptIcon size={16} />
                Request Bill
              </button>
            )}
            <button
              onClick={openBill}
              data-testid="view-bill-btn"
              className={`${
                billRequested ? "flex-1" : ""
              } flex items-center justify-center gap-2 rounded-full border border-brand text-brand hover:bg-brand/5 font-medium px-5 py-3 transition-all`}
            >
              <ReceiptIcon size={16} />
              View Bill
            </button>
          </div>
        </div>
      )}

      {/* Confirm bill modal */}
      {showConfirmBill && (
        <Modal onClose={() => setShowConfirmBill(false)} title="Request the bill?">
          <p className="text-ink2 mb-6">
            All items must be served before the bill can be generated. Continue?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmBill(false)}
              className="flex-1 rounded-full border border-bg2 py-2.5 hover:bg-bg2/60 transition"
              data-testid="cancel-bill-btn"
            >
              Cancel
            </button>
            <button
              onClick={handleRequestBill}
              data-testid="confirm-bill-btn"
              className="flex-1 rounded-full bg-brand hover:bg-brandHover text-white py-2.5 transition"
            >
              Yes, request bill
            </button>
          </div>
        </Modal>
      )}

      {/* Leave table confirmation */}
      {confirmLeave && (
        <Modal onClose={() => setConfirmLeave(false)} title="Leave this table?">
          <div className="flex items-start gap-3 mb-5">
            <div className="h-9 w-9 rounded-full bg-amber-100 grid place-items-center shrink-0">
              <DoorOpen size={16} className="text-amber-700" />
            </div>
            <p className="text-sm text-ink2 leading-relaxed">
              You'll be removed from Table {sess.tableNumber}. Your friends can keep ordering on
              the same shared cart. You can rejoin any table later by scanning its QR.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmLeave(false)}
              className="flex-1 rounded-full border border-bg2 py-2.5 hover:bg-bg2/60 transition"
              data-testid="cancel-leave-btn"
            >
              Stay
            </button>
            <button
              onClick={handleLeaveTable}
              disabled={actionBusy}
              data-testid="confirm-leave-btn"
              className="flex-1 flex items-center justify-center gap-2 rounded-full bg-ink hover:bg-black text-white py-2.5 transition disabled:opacity-50"
            >
              {actionBusy ? <Loader2 className="animate-spin" size={14} /> : <DoorOpen size={14} />}
              Leave Table
            </button>
          </div>
        </Modal>
      )}

      {/* Sign out confirmation */}
      {confirmSignout && (
        <Modal onClose={() => setConfirmSignout(false)} title="Sign out?">
          <div className="flex items-start gap-3 mb-5">
            <div className="h-9 w-9 rounded-full bg-destructive/10 grid place-items-center shrink-0">
              <AlertTriangle size={16} className="text-destructive" />
            </div>
            <p className="text-sm text-ink2 leading-relaxed">
              This will leave the table and forget your phone number on this device. You'll need
              to enter it again next time.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmSignout(false)}
              className="flex-1 rounded-full border border-bg2 py-2.5 hover:bg-bg2/60 transition"
              data-testid="cancel-signout-btn"
            >
              Cancel
            </button>
            <button
              onClick={handleSignOut}
              disabled={actionBusy}
              data-testid="confirm-signout-btn"
              className="flex-1 flex items-center justify-center gap-2 rounded-full bg-destructive hover:opacity-90 text-white py-2.5 transition disabled:opacity-50"
            >
              {actionBusy ? <Loader2 className="animate-spin" size={14} /> : <LogOut size={14} />}
              Sign out
            </button>
          </div>
        </Modal>
      )}

      {/* Customization picker (opens on tap when a menu item has non-empty
          customizationGroups). */}
      {customizeItem && (
        <CustomizationModal
          item={customizeItem}
          onClose={() => setCustomizeItem(null)}
          onConfirm={handleAddCustomized}
          busy={customizeBusy}
          errorMessage={customizeErr}
        />
      )}

      {/* Customer bill viewer */}
      {showBill && (
        <BillModal
          bill={bill}
          loading={billLoading}
          onClose={() => setShowBill(false)}
          onRefresh={openBill}
        />
      )}
    </div>
  );
}

// ---------- Sub-components ----------

function MenuView({ menu, onAdd, busyId, disabled }) {
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 180);
  const [vegOnly, setVegOnly] = useState(false);
  const [excludedAllergens, setExcludedAllergens] = useState(() => new Set());
  const [sortMode, setSortMode] = useState("default"); // default | priceAsc | priceDesc
  const [activeCategoryId, setActiveCategoryId] = useState(null); // null = all
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Full allergen vocabulary (lowercased, unique, sorted) derived once per menu.
  const allAllergens = useMemo(() => {
    const tags = new Set();
    (menu || []).forEach((cat) => {
      (cat.items || []).forEach((it) => {
        if (typeof it.allergens === "string" && it.allergens.trim()) {
          it.allergens.split(",").forEach((raw) => {
            const t = raw.trim().toLowerCase();
            if (t) tags.add(t);
          });
        }
      });
    });
    return [...tags].sort();
  }, [menu]);

  // Prune stale exclusions if the menu changes and a tag no longer exists.
  useEffect(() => {
    if (excludedAllergens.size === 0) return;
    const valid = new Set(allAllergens);
    const next = new Set([...excludedAllergens].filter((t) => valid.has(t)));
    if (next.size !== excludedAllergens.size) setExcludedAllergens(next);
  }, [allAllergens, excludedAllergens]);

  const toggleAllergen = (tag) =>
    setExcludedAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (vegOnly ? 1 : 0) +
    excludedAllergens.size +
    (activeCategoryId != null ? 1 : 0) +
    (sortMode !== "default" ? 1 : 0);

  const clearAll = () => {
    setRawSearch("");
    setVegOnly(false);
    setExcludedAllergens(new Set());
    setSortMode("default");
    setActiveCategoryId(null);
  };

  // Combined AND filter across every dimension, recomputed only when inputs change.
  const filteredCategories = useMemo(() => {
    if (!menu?.length) return [];
    const q = search.trim().toLowerCase();
    const excluded = [...excludedAllergens];
    const matchesItem = (it) => {
      // 1. Text search — name (primary) + description (secondary).
      if (q) {
        const nm = (it.name || "").toLowerCase();
        const desc = (it.description || "").toLowerCase();
        if (!nm.includes(q) && !desc.includes(q)) return false;
      }
      // 2. Veg toggle — VEG-only. Untagged (null) is deliberately excluded.
      if (vegOnly && it.dietaryType !== "VEG") return false;
      // 3. Allergen exclusion. Items with null allergens are never hidden here.
      if (excluded.length && typeof it.allergens === "string") {
        const raw = it.allergens.toLowerCase();
        for (const tag of excluded) {
          if (raw.includes(tag)) return false;
        }
      }
      return true;
    };
    const sortItems = (items) => {
      if (sortMode === "priceAsc") {
        return [...items].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      }
      if (sortMode === "priceDesc") {
        return [...items].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
      }
      return items;
    };
    return menu
      .filter((cat) => activeCategoryId == null || cat.id === activeCategoryId)
      .map((cat) => ({
        ...cat,
        items: sortItems((cat.items || []).filter(matchesItem)),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [menu, search, vegOnly, excludedAllergens, sortMode, activeCategoryId]);

  if (!menu?.length) {
    return <EmptyState icon={ShoppingBag} title="Loading menu…" />;
  }

  const totalMatched = filteredCategories.reduce((s, c) => s + c.items.length, 0);

  return (
    <div>
      <MenuFilterBar
        allCategories={menu}
        activeCategoryId={activeCategoryId}
        onCategoryChange={setActiveCategoryId}
        search={rawSearch}
        onSearchChange={setRawSearch}
        vegOnly={vegOnly}
        onVegToggle={() => setVegOnly((v) => !v)}
        allAllergens={allAllergens}
        excludedAllergens={excludedAllergens}
        onAllergenToggle={toggleAllergen}
        sortMode={sortMode}
        onSortChange={setSortMode}
        activeFilterCount={activeFilterCount}
        onClearAll={clearAll}
        totalMatched={totalMatched}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
      />

      {filteredCategories.length === 0 ? (
        <div className="text-center py-16 animate-fadeUp">
          <div className="inline-grid place-items-center h-14 w-14 rounded-full bg-brand/10 text-brand mb-4">
            <SearchX size={24} />
          </div>
          <h3 className="font-heading text-xl font-semibold">No items match</h3>
          <p className="text-ink2 mt-2 max-w-sm mx-auto">
            Try a different search term or loosen the filters.
          </p>
          <button
            onClick={clearAll}
            data-testid="menu-clear-filters"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand hover:bg-brandHover text-white text-sm font-medium px-4 py-2 shadow-lift hover:-translate-y-0.5 transition-all"
          >
            <X size={12} />
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {filteredCategories.map((cat) => (
            <section key={cat.id} className="animate-fadeUp">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-heading text-2xl font-semibold tracking-tight">{cat.name}</h2>
                <div className="flex-1 h-px bg-bg2" />
                <span className="text-xs text-ink2">
                  {cat.items.length} item{cat.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cat.items.map((it) => (
                  <MenuItemCard
                    key={it.id}
                    item={it}
                    onAdd={onAdd}
                    busyId={busyId}
                    disabled={disabled}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tiny debounce hook — value re-updates `delayMs` after the last change. */
function useDebouncedValue(value, delayMs = 150) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

function MenuFilterBar({
  allCategories,
  activeCategoryId,
  onCategoryChange,
  search,
  onSearchChange,
  vegOnly,
  onVegToggle,
  allAllergens,
  excludedAllergens,
  onAllergenToggle,
  sortMode,
  onSortChange,
  activeFilterCount,
  onClearAll,
  totalMatched,
  filtersOpen,
  onToggleFilters,
}) {
  const sortLabel =
    sortMode === "priceAsc"
      ? "Price ↑"
      : sortMode === "priceDesc"
      ? "Price ↓"
      : "Sort";

  return (
    <div
      data-testid="menu-filter-bar"
      className="sticky top-[104px] z-20 -mx-4 px-4 pt-2 pb-3 mb-6 bg-bg/95 backdrop-blur border-b border-bg2/60"
    >
      {/* Row 1: search + veg + filters toggle */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-surface border border-bg2 rounded-full px-3.5 py-2 shadow-soft focus-within:border-brand transition">
          <Search size={14} className="text-ink2 shrink-0" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search dishes…"
            data-testid="menu-search-input"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              data-testid="menu-search-clear"
              className="text-ink2 hover:text-ink"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={onVegToggle}
          data-testid="menu-veg-toggle"
          aria-pressed={vegOnly}
          title={vegOnly ? "Showing veg only" : "Show veg only"}
          className={`h-10 shrink-0 flex items-center gap-1.5 rounded-full border px-3 text-xs font-semibold uppercase tracking-wider transition ${
            vegOnly
              ? "bg-emerald-600 text-white border-emerald-600 shadow-soft"
              : "bg-surface text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          }`}
        >
          <Leaf size={12} />
          Veg
        </button>

        <button
          onClick={onToggleFilters}
          data-testid="menu-filters-toggle"
          aria-expanded={filtersOpen}
          className={`h-10 shrink-0 relative flex items-center gap-1.5 rounded-full border px-3 text-xs font-semibold uppercase tracking-wider transition ${
            filtersOpen
              ? "bg-ink text-white border-ink"
              : "bg-surface text-ink border-bg2 hover:border-brand hover:text-brand"
          }`}
        >
          <SlidersHorizontal size={12} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 grid place-items-center min-w-[16px] h-4 px-1 rounded-full bg-brand text-white text-[9px] font-mono font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Category quick-filter */}
      {allCategories.length > 1 && (
        <div
          data-testid="menu-category-quickfilter"
          className="mt-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5"
        >
          <CategoryPill
            active={activeCategoryId == null}
            onClick={() => onCategoryChange(null)}
            testId="menu-cat-all"
          >
            All
          </CategoryPill>
          {allCategories.map((cat) => (
            <CategoryPill
              key={cat.id}
              active={activeCategoryId === cat.id}
              onClick={() => onCategoryChange(cat.id)}
              testId={`menu-cat-${cat.id}`}
            >
              {cat.name}
            </CategoryPill>
          ))}
        </div>
      )}

      {/* Row 3 (collapsible): allergens + sort + clear */}
      {filtersOpen && (
        <div
          data-testid="menu-filters-drawer"
          className="mt-3 rounded-2xl border border-bg2 bg-surface/70 p-3 space-y-3 animate-fadeUp"
        >
          {allAllergens.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold mb-1.5 flex items-center gap-1">
                <Ban size={11} />
                Hide items containing
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allAllergens.map((tag) => {
                  const active = excludedAllergens.has(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => onAllergenToggle(tag)}
                      data-testid={`menu-allergen-${tag}`}
                      aria-pressed={active}
                      className={`text-xs rounded-full border px-3 py-1 capitalize transition ${
                        active
                          ? "bg-destructive text-white border-destructive shadow-soft"
                          : "bg-white text-ink border-bg2 hover:border-destructive/50 hover:text-destructive"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold flex items-center gap-1 mr-1">
                <ArrowDownUp size={11} />
                Sort by price
              </div>
              <SortPill
                active={sortMode === "default"}
                onClick={() => onSortChange("default")}
                testId="menu-sort-default"
              >
                Default
              </SortPill>
              <SortPill
                active={sortMode === "priceAsc"}
                onClick={() => onSortChange("priceAsc")}
                testId="menu-sort-price-asc"
              >
                Low → High
              </SortPill>
              <SortPill
                active={sortMode === "priceDesc"}
                onClick={() => onSortChange("priceDesc")}
                testId="menu-sort-price-desc"
              >
                High → Low
              </SortPill>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={onClearAll}
                data-testid="menu-clear-all-inline"
                className="text-xs text-ink2 hover:text-destructive rounded-full border border-bg2 hover:border-destructive px-3 py-1 flex items-center gap-1 transition"
              >
                <X size={11} />
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Result summary */}
      {(activeFilterCount > 0 || sortMode !== "default") && (
        <div className="mt-2 text-[11px] text-ink2 flex items-center gap-1.5">
          <Sliders size={10} />
          {totalMatched} item{totalMatched === 1 ? "" : "s"} match — showing {sortLabel.toLowerCase()}
        </div>
      )}
    </div>
  );
}

function CategoryPill({ active, onClick, children, testId }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`shrink-0 text-xs font-medium rounded-full px-3 py-1 border transition ${
        active
          ? "bg-brand text-white border-brand shadow-soft"
          : "bg-white text-ink border-bg2 hover:border-brand hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}

function SortPill({ active, onClick, children, testId }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`text-xs rounded-full border px-3 py-1 transition ${
        active
          ? "bg-ink text-white border-ink"
          : "bg-white text-ink2 border-bg2 hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function MenuItemCard({ item, onAdd, busyId, disabled }) {
  const isAdding = busyId === `add-${item.id}`;
  const hasImage = !!item.imageUrl;
  const btnDisabled = !item.available || isAdding || disabled;
  const hasCustomization =
    Array.isArray(item.customizationGroups) &&
    item.customizationGroups.length > 0;
  return (
    <div
      data-testid={`menu-item-${item.id}`}
      className={`group bg-surface border border-bg2 rounded-2xl overflow-hidden hover:shadow-lift hover:-translate-y-0.5 transition-all ${
        !item.available ? "opacity-70" : ""
      }`}
    >
      <div className="relative aspect-[16/10] bg-gradient-to-br from-bg2 to-bg overflow-hidden">
        {hasImage ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className={`absolute inset-0 flex items-center justify-center text-brand/40 ${
            hasImage ? "hidden" : "flex"
          }`}
        >
          <UtensilsCrossed size={40} strokeWidth={1.2} />
        </div>
        {item.dietaryType && (
          <div className="absolute top-2 left-2 bg-white/95 backdrop-blur rounded-md px-1.5 py-1 shadow-soft">
            <DietaryBadge type={item.dietaryType} />
          </div>
        )}
        {!item.available && (
          <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider bg-destructive text-white px-2 py-0.5 rounded-full font-semibold shadow-soft">
            Unavailable
          </div>
        )}
        <button
          onClick={() => onAdd(item)}
          disabled={btnDisabled}
          data-testid={`add-to-cart-btn-${item.id}`}
          title={
            disabled
              ? "Bill has been requested"
              : hasCustomization
              ? "Choose options"
              : undefined
          }
          className="absolute bottom-3 right-3 h-10 w-10 grid place-items-center rounded-full bg-brand hover:bg-brandHover text-white shadow-lift disabled:opacity-40 disabled:cursor-not-allowed transition-all group-hover:scale-110 disabled:group-hover:scale-100"
        >
          {isAdding ? (
            <Loader2 size={16} className="animate-spin" />
          ) : hasCustomization ? (
            <Sliders size={16} strokeWidth={2.5} />
          ) : (
            <Plus size={18} strokeWidth={2.5} />
          )}
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-heading font-medium text-ink truncate">{item.name}</div>
            {item.description && (
              <div className="text-sm text-ink2 mt-1 line-clamp-2 leading-snug">
                {item.description}
              </div>
            )}
            {item.allergens && (
              <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <AlertTriangle size={10} />
                Contains: {item.allergens}
              </div>
            )}
            {hasCustomization && (
              <div className="mt-1.5 text-[10px] uppercase tracking-widest text-brand font-semibold flex items-center gap-1">
                <Sliders size={10} />
                Customizable
              </div>
            )}
          </div>
          <div className="font-heading font-semibold text-brand shrink-0 tabular-nums">
            ₹{Number(item.price).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

function CartView({ cartRef, cart, onQty, onRemove, busyId }) {
  const items = cart?.items || [];
  if (!items.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Your cart is empty"
        subtitle="Add items from the menu — teammates at your table see them instantly."
      />
    );
  }
  return (
    <div ref={cartRef} className="space-y-3">
      {items.map((it) => (
        <div
          key={it.id}
          data-testid={`cart-item-${it.id}`}
          className="bg-surface border border-bg2 rounded-2xl p-4 animate-fadeUp"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-ink">{it.menuItemName || it.name}</span>
                <span className="text-xs text-ink2 font-mono">
                  ₹{Number(it.price ?? it.unitPrice ?? 0).toFixed(2)}
                </span>
              </div>
              <SelectedOptions
                options={it.selectedOptions}
                testId={`cart-item-options-${it.id}`}
              />
            </div>
            <div className="flex items-center gap-1 bg-bg rounded-full px-1 py-1 shrink-0">
              <button
                onClick={() => onQty(it, -1)}
                disabled={busyId === `qty-${it.id}` || it.quantity <= 1}
                title={it.quantity <= 1 ? "Use the trash icon to remove" : undefined}
                data-testid={`decrement-${it.id}`}
                className="h-8 w-8 grid place-items-center rounded-full hover:bg-bg2 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Minus size={14} />
              </button>
              <span className="w-6 text-center font-mono font-semibold" data-testid={`qty-${it.id}`}>
                {it.quantity}
              </span>
              <button
                onClick={() => onQty(it, +1)}
                disabled={busyId === `qty-${it.id}`}
                data-testid={`increment-${it.id}`}
                className="h-8 w-8 grid place-items-center rounded-full hover:bg-bg2 transition disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
            </div>
            <button
              onClick={() => onRemove(it)}
              disabled={busyId === `rm-${it.id}`}
              data-testid={`remove-item-${it.id}`}
              className="text-ink2 hover:text-destructive p-1.5 rounded-full hover:bg-destructive/10 transition shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrdersView({ orders }) {
  if (!orders.length) {
    return (
      <EmptyState
        icon={ChefHat}
        title="No orders yet"
        subtitle="When you submit your cart, it'll appear here with live status updates."
      />
    );
  }
  return (
    <div className="space-y-4">
      {orders.map((o) => (
        <div key={o.id} className="bg-surface border border-bg2 rounded-2xl p-4 animate-fadeUp">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
                Order #{o.id}
              </div>
              <div className="font-heading font-semibold">{o.status}</div>
            </div>
            {o.placedAt && (
              <div className="text-xs text-ink2">
                {new Date(o.placedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {o.items?.map((it) => {
              const Icon = STATUS_ICON[it.itemStatus] || ClipboardList;
              const cancelled = it.itemStatus === "CANCELLED";
              return (
                <div
                  key={it.id}
                  className={`flex items-start justify-between text-sm gap-2 ${
                    cancelled ? "opacity-70" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-ink ${cancelled ? "line-through" : ""}`}
                      >
                        {it.quantity}× {it.menuItemName || it.name}
                      </span>
                      {cancelled && (
                        <span className="text-[10px] uppercase tracking-wider bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">
                          removed by staff
                        </span>
                      )}
                    </div>
                    <SelectedOptions
                      options={it.selectedOptions}
                      testId={`order-item-options-${it.id}`}
                    />
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      STATUS_COLORS[it.itemStatus] || "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <Icon size={10} />
                    {it.itemStatus}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="text-center py-16 animate-fadeUp">
      <div className="inline-grid place-items-center h-14 w-14 rounded-full bg-brand/10 text-brand mb-4">
        <Icon size={24} />
      </div>
      <h3 className="font-heading text-xl font-semibold">{title}</h3>
      {subtitle && <p className="text-ink2 mt-2 max-w-sm mx-auto">{subtitle}</p>}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4 animate-fadeUp">
      <div className="bg-surface rounded-3xl max-w-md w-full p-6 shadow-lift">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-xl font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-ink2 hover:text-ink p-1 rounded-full hover:bg-bg2 transition"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}


function BillModal({ bill, loading, onClose, onRefresh }) {
  const handlePrint = () => window.print();
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto animate-fadeUp"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="customer-bill-modal"
        className="relative max-w-md w-full my-6"
      >
        <div className="rounded-3xl overflow-hidden shadow-lift receipt-print">
          {loading ? (
            <div className="bg-surface grid place-items-center py-20">
              <Loader2 className="animate-spin text-brand" size={28} />
            </div>
          ) : bill ? (
            <Receipt bill={bill} />
          ) : (
            <div className="bg-surface p-8 text-center">
              <ReceiptIcon size={28} className="mx-auto text-ink2 mb-2" />
              <div className="font-heading text-lg font-semibold">Not ready yet</div>
              <p className="text-sm text-ink2 mt-1">
                Your bill hasn&apos;t been generated. It will appear here once the cashier
                creates it.
              </p>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 print:hidden">
          <button
            onClick={onClose}
            data-testid="customer-bill-close"
            className="text-sm rounded-full border border-white/30 bg-white/10 hover:bg-white/20 text-white px-4 py-2 backdrop-blur transition"
          >
            Close
          </button>
          <div className="flex gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              data-testid="customer-bill-refresh"
              className="text-sm rounded-full bg-white/10 hover:bg-white/20 text-white px-4 py-2 backdrop-blur transition disabled:opacity-50"
            >
              Refresh
            </button>
            {bill && (
              <button
                onClick={handlePrint}
                data-testid="customer-bill-print"
                className="flex items-center gap-1.5 text-sm rounded-full bg-brand hover:bg-brandHover text-white px-4 py-2 shadow-lift transition"
              >
                <Printer size={14} />
                Print
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
