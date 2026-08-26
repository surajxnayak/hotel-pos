/* eslint-disable react/no-unstable-nested-components */
import React, { useCallback, useEffect, useState } from "react";
import StaffShell from "../components/StaffShell";
import StaffTabs from "../components/StaffTabs";
import TableGrid from "../components/TableGrid";
import StatusBadge from "../components/StatusBadge";
import OrderList from "../components/OrderList";
import WaiterItemPicker from "../components/WaiterItemPicker";
import StartTableModal from "../components/StartTableModal";
import DetailPanel from "../components/DetailPanel";
import TableNoteView from "../components/TableNoteView";
import { SelectedOptions } from "../components/DietaryAndOptions";
import useTableOverview from "../hooks/useTableOverview";
import useQueueTableNotes from "../hooks/useQueueTableNotes";
import {
  waiterTablesList,
  waiterTableDetail,
  waiterConfirm,
  waiterServeItem,
  waiterRemoveItem,
  waiterUpdateItem,
  waiterRequestBillForTable,
  waiterPending,
  waiterReady,
  waiterSetTableNote,
  waiterSetItemNote,
} from "../lib/api";
import { createStompClient } from "../lib/ws";
import { toast } from "sonner";
import {
  Users,
  KeyRound,
  Loader2,
  Receipt,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle2,
  ClipboardList,
  Bell,
  StickyNote,
  Pencil,
  Save as SaveIcon,
} from "lucide-react";

/**
 * Single-route Waiter workspace. Tables and Queue tabs are swapped in place,
 * so nothing here navigates via the router — this lets Admin embed the same
 * component without route redirects.
 */
export default function WaiterDashboard({ embedded = false }) {
  const [tab, setTab] = useState("tables");
  // The currently-mounted child view registers its refresh handler here so
  // the shared toolbar button always drives the *visible* view.
  const [refreshBundle, setRefreshBundle] = useState({
    fn: null,
    refreshing: false,
  });

  const content = (
    <>
      {tab === "tables" ? (
        <WaiterTablesView registerRefresh={setRefreshBundle} />
      ) : (
        <WaiterQueueView registerRefresh={setRefreshBundle} />
      )}
    </>
  );

  const tabs = (
    <StaffTabs
      current={tab}
      onChange={setTab}
      onRefresh={refreshBundle.fn || undefined}
      refreshing={refreshBundle.refreshing}
    />
  );

  if (embedded) {
    return (
      <div data-testid="waiter-workspace" className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tabs}
        {content}
      </div>
    );
  }
  return (
    <StaffShell title="Waiter" subtitle="WAITER" testId="waiter-dashboard">
      {tabs}
      {content}
    </StaffShell>
  );
}

// ---------------- Tables view ----------------

function WaiterTablesView({ registerRefresh }) {
  const { tables, loading, refresh } = useTableOverview(waiterTablesList);
  const [active, setActive] = useState(null);
  const [startFor, setStartFor] = useState(null);

  useEffect(() => {
    registerRefresh({ fn: refresh, refreshing: loading });
  }, [refresh, loading, registerRefresh]);

  const handleSelect = (table) => {
    if (table.overviewStatus === "AVAILABLE") setStartFor(table);
    else setActive(table);
  };

  return (
    <div data-testid="waiter-tables-page">
      <TableGrid
        tables={tables}
        role="waiter"
        activeTableId={active?.tableId ?? startFor?.tableId}
        loading={loading}
        onSelect={handleSelect}
      />
      {active && <WaiterTableDetail summary={active} onClose={() => setActive(null)} />}
      {startFor && (
        <StartTableModal
          tableId={startFor.tableId}
          tableNumber={startFor.tableNumber}
          onClose={() => setStartFor(null)}
          onStarted={() => {
            setStartFor(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function WaiterTableDetail({ summary, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [itemNoteFor, setItemNoteFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await waiterTableDetail(summary.tableId));
    } catch (e) {
      toast.error(e.message);
      onClose();
    } finally {
      setLoading(false);
    }
  }, [summary.tableId, onClose]);

  useEffect(() => {
    load();
  }, [load, summary.overviewStatus, summary.ordersAwaitingConfirmation, summary.itemsReadyToServe]);

  const confirmOrder = async (orderId) => {
    setBusy(`c-${orderId}`);
    try { await waiterConfirm(orderId); toast.success(`Order #${orderId} confirmed`); load(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };
  const serveItem = async (itemId) => {
    setBusy(`s-${itemId}`);
    try { await waiterServeItem(itemId); toast.success("Item served"); load(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };
  const requestBill = async () => {
    setBusy("bill");
    try { await waiterRequestBillForTable(summary.tableId); toast.success("Bill requested"); load(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };
  const saveItemNote = async (itemId, note) => {
    try {
      await waiterSetItemNote(itemId, note);
      toast.success(note ? "Note saved" : "Note cleared");
      setItemNoteFor(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const canRequestBill = detail?.overviewStatus === "SERVED_AWAITING_BILL";
  const canAddOrder = detail && detail.sessionId && detail.overviewStatus !== "BILL_REQUESTED";

  return (
    <DetailPanel onClose={onClose} testId="waiter-table-detail">
      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-brand" size={24} /></div>
      ) : !detail ? null : (
        <>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">Table</div>
              <div className="font-heading text-4xl font-bold tracking-tight">{detail.tableNumber}</div>
              <div className="mt-2"><StatusBadge status={detail.overviewStatus} /></div>
            </div>
            {detail.pin && (
              <div className="bg-brand/10 border border-brand/20 rounded-2xl px-3 py-2 text-right">
                <div className="text-[9px] uppercase tracking-widest text-brand/80 font-semibold flex items-center gap-1 justify-end"><KeyRound size={10} />PIN</div>
                <div className="font-mono font-bold tracking-[0.3em] text-brand text-base">{detail.pin}</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-ink2 mb-4">
            <span className="inline-flex items-center gap-1.5"><Users size={12} />{detail.participantCount} {detail.participantCount === 1 ? "person" : "people"}</span>
            {detail.openedAt && <span>Opened {new Date(detail.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>

          <TableNoteEditor
            tableId={detail.tableId}
            initial={detail.note}
            onSaved={(newNote) => setDetail((d) => ({ ...d, note: newNote }))}
          />

          {canAddOrder && (
            <button onClick={() => setShowPicker(true)} data-testid="add-order-btn" className="mb-4 w-full flex items-center justify-center gap-2 rounded-full border-2 border-dashed border-brand/50 text-brand hover:bg-brand/5 font-medium py-2.5 transition">
              <Plus size={14} />Add Order
            </button>
          )}
          <OrderList
            orders={detail.orders}
            onConfirmOrder={confirmOrder}
            onServeItem={serveItem}
            onEditItemNote={(item) => setItemNoteFor(item)}
            busy={busy}
          />
          {canRequestBill && !detail.billRequested && (
            <button onClick={requestBill} disabled={busy === "bill"} data-testid="waiter-request-bill-btn" className="mt-5 w-full flex items-center justify-center gap-2 rounded-full bg-ink hover:bg-black text-white font-medium py-3 shadow-lift transition disabled:opacity-50">
              {busy === "bill" ? <Loader2 className="animate-spin" size={14} /> : <Receipt size={14} />}
              Request Bill
            </button>
          )}
          {detail.billRequested && (
            <div className="mt-5 text-center rounded-2xl border border-yellow-300 bg-yellow-50 text-yellow-800 py-3 text-sm font-medium">
              Bill already requested — waiting for cashier.
            </div>
          )}
          {showPicker && (
            <WaiterItemPicker tableId={detail.tableId} tableNumber={detail.tableNumber} onClose={() => setShowPicker(false)} onPlaced={() => { setShowPicker(false); load(); }} />
          )}
          {itemNoteFor && (
            <ItemNotePrompt
              item={itemNoteFor}
              onClose={() => setItemNoteFor(null)}
              onSave={(n) => saveItemNote(itemNoteFor.id, n)}
            />
          )}
        </>
      )}
    </DetailPanel>
  );
}

function TableNoteEditor({ tableId, initial, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(initial || "");
  }, [initial]);

  const save = async () => {
    setBusy(true);
    try {
      const clean = value.trim();
      await waiterSetTableNote(tableId, clean || null);
      toast.success(clean ? "Table note saved" : "Table note cleared");
      onSaved(clean || null);
      setEditing(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div
        data-testid="table-note-view"
        className={`mb-4 flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 ${
          initial
            ? "border-amber-200 bg-amber-50/70"
            : "border-dashed border-bg2 bg-bg/40"
        }`}
      >
        <StickyNote
          size={14}
          className={`mt-0.5 shrink-0 ${initial ? "text-amber-700" : "text-ink2"}`}
        />
        <div className="flex-1 min-w-0 text-sm">
          <div className="text-[9px] uppercase tracking-widest text-ink2 font-semibold">
            Table note
          </div>
          <div className={`mt-0.5 ${initial ? "text-amber-900" : "text-ink2 italic"}`}>
            {initial || "No note yet — tap to add one (e.g. anniversary, high-chair, VIP)"}
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          data-testid="table-note-edit"
          className="text-ink2 hover:text-brand p-1 rounded-full hover:bg-brand/10 shrink-0"
        >
          <Pencil size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50/70 p-3 space-y-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-amber-900 font-semibold">
        <StickyNote size={12} />
        Edit table note
      </div>
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        maxLength={280}
        placeholder="e.g. Anniversary table, bring candle at dessert"
        data-testid="table-note-input"
        className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 resize-none"
      />
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => { setValue(initial || ""); setEditing(false); }}
          disabled={busy}
          data-testid="table-note-cancel"
          className="text-xs rounded-full border border-bg2 hover:bg-white px-3 py-1 transition disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          data-testid="table-note-save"
          className="text-xs flex items-center gap-1 rounded-full bg-amber-700 hover:bg-amber-800 text-white px-3 py-1 transition disabled:opacity-50"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <SaveIcon size={11} />}
          Save
        </button>
      </div>
    </div>
  );
}

function ItemNotePrompt({ item, onClose, onSave }) {
  const [value, setValue] = useState(item.notes || "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await onSave(value.trim() || null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="item-note-prompt"
        className="bg-surface rounded-3xl max-w-sm w-full p-5 shadow-lift animate-fadeUp"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-heading font-semibold text-base">Note for item</h3>
            <p className="text-xs text-ink2 mt-0.5">
              {item.quantity}× {item.menuItemName || item.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink2 hover:text-ink p-1 rounded-full hover:bg-bg2"
          >
            <X size={14} />
          </button>
        </div>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          maxLength={280}
          placeholder="e.g. Extra spicy, allergy: nuts, no onions"
          data-testid="item-note-input"
          className="w-full bg-bg border border-bg2 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand resize-none"
        />
        <p className="text-[10px] text-ink2 mt-1">
          Visible to kitchen &amp; other staff only. Leave empty to remove.
        </p>
        <div className="mt-4 flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={busy}
            data-testid="item-note-cancel"
            className="text-sm rounded-full border border-bg2 hover:bg-bg2/60 px-4 py-1.5 transition"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            data-testid="item-note-save"
            className="text-sm flex items-center gap-1.5 rounded-full bg-brand hover:bg-brandHover text-white px-4 py-1.5 transition disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <SaveIcon size={12} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Queue view ----------------

function WaiterQueueView({ registerRefresh }) {
  const [pending, setPending] = useState([]);
  const [ready, setReady] = useState([]);
  const [busy, setBusy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [p, r] = await Promise.all([waiterPending(), waiterReady()]);
      setPending(p); setReady(r);
    } catch (e) { toast.error(e.message); }
    finally { setRefreshing(false); }
  }, []);

  // Table notes for every session shown in the queue — visible on each order card.
  const allOrders = React.useMemo(() => [...pending, ...ready], [pending, ready]);
  const notesBySessionId = useQueueTableNotes(
    allOrders,
    waiterTablesList,
    waiterTableDetail
  );

  useEffect(() => {
    registerRefresh({ fn: refresh, refreshing });
  }, [refresh, refreshing, registerRefresh]);

  useEffect(() => {
    refresh();
    const { deactivate } = createStompClient({
      subscriptions: [{ topic: "/topic/waiter", handler: () => refresh() }],
      onConnect: refresh,
    });
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", refresh);
    return () => {
      deactivate();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  const confirm = async (orderId) => {
    setBusy(`c-${orderId}`);
    try { await waiterConfirm(orderId); toast.success(`Order #${orderId} confirmed`); refresh(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };
  const serveItem = async (itemId) => {
    setBusy(`s-${itemId}`);
    try { await waiterServeItem(itemId); toast.success("Item served"); refresh(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };
  const removeItem = async (orderId, itemId) => {
    setBusy(`r-${itemId}`);
    try { await waiterRemoveItem(orderId, itemId); toast.success("Item removed"); refresh(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };
  const changeQty = async (orderId, item, delta) => {
    const newQty = (item.quantity || 0) + delta;
    if (newQty < 1) return;
    setBusy(`q-${item.id}`);
    try { await waiterUpdateItem(orderId, item.id, { quantity: newQty }); refresh(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };
  const confirmAndRemove = async () => {
    if (!confirmRemove) return;
    const { orderId, item } = confirmRemove;
    setConfirmRemove(null);
    await removeItem(orderId, item.id);
  };

  return (
    <div data-testid="waiter-queue-view">
      <div className="text-ink2 mb-4">{pending.length} pending · {ready.length} ready to serve</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Column title="Pending" count={pending.length} Icon={ClipboardList} color="bg-blue-100 text-blue-700" empty="No pending orders — well done!">
          {pending.map((o) => (
            <div key={o.id} data-testid={`pending-order-${o.id}`} className="bg-surface border border-bg2 rounded-2xl p-4 animate-fadeUp">
              <OrderHeader order={o} />
              <TableNoteView note={notesBySessionId[o.tableSessionId]} />
              <ItemList items={o.items} actions={(it) => (
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5 bg-bg rounded-full px-1 py-0.5">
                    <button onClick={() => changeQty(o.id, it, -1)} disabled={busy === `q-${it.id}` || it.quantity <= 1} title={it.quantity <= 1 ? "Use trash icon to remove" : undefined} data-testid={`w-dec-${it.id}`} className="h-6 w-6 grid place-items-center rounded-full hover:bg-bg2 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"><Minus size={12} /></button>
                    <span className="w-5 text-center text-xs font-mono">{it.quantity}</span>
                    <button onClick={() => changeQty(o.id, it, +1)} disabled={busy === `q-${it.id}`} data-testid={`w-inc-${it.id}`} className="h-6 w-6 grid place-items-center rounded-full hover:bg-bg2 disabled:opacity-30"><Plus size={12} /></button>
                  </div>
                  <button onClick={() => setConfirmRemove({ orderId: o.id, item: it })} disabled={busy === `r-${it.id}`} data-testid={`w-remove-${it.id}`} className="h-6 w-6 grid place-items-center rounded-full text-ink2 hover:text-destructive hover:bg-destructive/10"><Trash2 size={12} /></button>
                </div>
              )} />
              <button onClick={() => confirm(o.id)} disabled={busy === `c-${o.id}`} data-testid={`confirm-order-${o.id}`} className="mt-3 w-full flex items-center justify-center gap-2 rounded-full bg-brand hover:bg-brandHover text-white font-medium py-2.5 transition-all disabled:opacity-50">
                {busy === `c-${o.id}` ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}Confirm Order
              </button>
            </div>
          ))}
        </Column>
        <Column title="Ready to Serve" count={ready.length} Icon={Bell} color="bg-emerald-100 text-emerald-800" empty="Nothing ready yet.">
          {ready.map((o) => (
            <div key={o.id} data-testid={`ready-order-${o.id}`} className="bg-surface border border-bg2 rounded-2xl p-4 animate-fadeUp">
              <OrderHeader order={o} />
              <TableNoteView note={notesBySessionId[o.tableSessionId]} />
              <ItemList items={o.items} actions={(it) => it.itemStatus === "READY" ? (
                <button onClick={() => serveItem(it.id)} disabled={busy === `s-${it.id}`} data-testid={`serve-item-${it.id}`} className="text-xs bg-successc hover:opacity-90 text-white rounded-full px-3 py-1 flex items-center gap-1 disabled:opacity-50">
                  {busy === `s-${it.id}` ? <Loader2 className="animate-spin" size={10} /> : <CheckCircle2 size={10} />}Serve
                </button>
              ) : null} />
            </div>
          ))}
        </Column>
      </div>
      {confirmRemove && (
        <ConfirmRemoveModal item={confirmRemove.item} orderId={confirmRemove.orderId} onCancel={() => setConfirmRemove(null)} onConfirm={confirmAndRemove} />
      )}
    </div>
  );
}

// ---------------- Shared ----------------

function ConfirmRemoveModal({ item, orderId, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] grid place-items-center p-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} data-testid="waiter-confirm-remove" className="bg-surface rounded-2xl w-full max-w-sm p-5 shadow-lift animate-fadeUp">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-destructive/10 grid place-items-center shrink-0"><AlertTriangle size={16} className="text-destructive" /></div>
          <div className="flex-1">
            <h3 className="font-heading font-semibold text-base">Remove this item?</h3>
            <p className="text-sm text-ink2 mt-1"><span className="text-ink font-medium">{item.quantity}× {item.menuItemName || item.name}</span> from order #{orderId}.</p>
          </div>
          <button onClick={onCancel} className="text-ink2 hover:text-ink p-1 rounded-full hover:bg-bg2"><X size={14} /></button>
        </div>
        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onCancel} data-testid="waiter-cancel-remove" className="text-sm rounded-full border border-bg2 hover:bg-bg2/60 px-4 py-1.5 transition">Cancel</button>
          <button onClick={onConfirm} data-testid="waiter-confirm-remove-btn" className="text-sm rounded-full bg-destructive hover:opacity-90 text-white px-4 py-1.5 transition">Remove</button>
        </div>
      </div>
    </div>
  );
}

function Column({ title, count, Icon, color, empty, children }) {
  const items = React.Children.toArray(children);
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className={`h-7 w-7 grid place-items-center rounded-full ${color}`}><Icon size={13} /></div>
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        <span className="text-xs text-ink2 font-mono">({count})</span>
      </div>
      <div className="space-y-3">
        {items.length ? items : <div className="text-center py-10 text-ink2 border border-dashed border-bg2 rounded-2xl">{empty}</div>}
      </div>
    </section>
  );
}

function OrderHeader({ order }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">Table {order.tableNumber} · Order #{order.id}</div>
        <div className="font-heading font-semibold">{order.status}</div>
      </div>
      {order.placedAt && <div className="text-xs text-ink2">{new Date(order.placedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
    </div>
  );
}

function ItemList({ items, actions }) {
  return (
    <div className="space-y-1.5">
      {items?.map((it) => (
        <div key={it.id} className={`flex items-start justify-between text-sm py-1 gap-2 ${it.itemStatus === "CANCELLED" ? "opacity-50" : ""}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className={`text-ink font-medium ${it.itemStatus === "CANCELLED" ? "line-through" : ""}`}>{it.quantity}× {it.menuItemName || it.name}</span>
              {it.notes && <span className="text-xs text-ink2 italic truncate">— {it.notes}</span>}
            </div>
            <SelectedOptions
              options={it.selectedOptions}
              testId={`queue-item-options-${it.id}`}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${itemColor(it.itemStatus)}`}>{it.itemStatus}</span>
            {actions?.(it)}
          </div>
        </div>
      ))}
    </div>
  );
}

function itemColor(s) {
  return ({
    PENDING: "bg-slate-100 text-slate-700",
    CONFIRMED: "bg-blue-100 text-blue-700",
    PREPARING: "bg-amber-100 text-amber-800",
    READY: "bg-emerald-100 text-emerald-800",
    SERVED: "bg-successc/15 text-successc",
    CANCELLED: "bg-red-100 text-red-700",
  }[s] || "bg-slate-100 text-slate-700");
}
