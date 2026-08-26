import React, { useCallback, useEffect, useState } from "react";
import StaffShell from "../components/StaffShell";
import StaffTabs from "../components/StaffTabs";
import TableGrid from "../components/TableGrid";
import StatusBadge from "../components/StatusBadge";
import OrderList from "../components/OrderList";
import DetailPanel from "../components/DetailPanel";
import TableNoteView from "../components/TableNoteView";
import useTableOverview from "../hooks/useTableOverview";
import useQueueTableNotes from "../hooks/useQueueTableNotes";
import {
  kitchenQueue,
  kitchenSetItemStatus,
  kitchenTablesList,
  kitchenTableDetail,
} from "../lib/api";
import { createStompClient } from "../lib/ws";
import { toast } from "sonner";
import { SelectedOptions } from "../components/DietaryAndOptions";
import { ChefHat, Bell, Loader2, PlayCircle, Users, ClipboardList } from "lucide-react";

/**
 * Single-route Kitchen workspace. Now has both a restaurant-floor view and
 * the classic item queue — both switched via internal tab state.
 */
export default function KitchenDashboard({ embedded = false }) {
  const [tab, setTab] = useState("tables");
  const [refreshBundle, setRefreshBundle] = useState({
    fn: null,
    refreshing: false,
  });

  const content =
    tab === "tables" ? (
      <KitchenTablesView registerRefresh={setRefreshBundle} />
    ) : (
      <KitchenQueueView registerRefresh={setRefreshBundle} />
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
      <div data-testid="kitchen-workspace" className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tabs}
        {content}
      </div>
    );
  }
  return (
    <StaffShell title="Kitchen" subtitle="KITCHEN" testId="kitchen-dashboard">
      {tabs}
      {content}
    </StaffShell>
  );
}

// ---------------- Tables view ----------------

function KitchenTablesView({ registerRefresh }) {
  const { tables, loading, refresh } = useTableOverview(kitchenTablesList);
  const [active, setActive] = useState(null);

  useEffect(() => {
    registerRefresh({ fn: refresh, refreshing: loading });
  }, [refresh, loading, registerRefresh]);

  return (
    <div data-testid="kitchen-tables-page">
      <TableGrid
        tables={tables}
        role="kitchen"
        activeTableId={active?.tableId}
        loading={loading}
        onSelect={(t) => t.overviewStatus !== "AVAILABLE" && setActive(t)}
      />
      {active && (
        <KitchenTableDetail
          summary={active}
          onClose={() => setActive(null)}
          onChange={refresh}
        />
      )}
    </div>
  );
}

function KitchenTableDetail({ summary, onClose, onChange }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDetail(await kitchenTableDetail(summary.tableId)); }
    catch (e) { toast.error(e.message); onClose(); }
    finally { setLoading(false); }
  }, [summary.tableId, onClose]);

  useEffect(() => {
    load();
  }, [load, summary.overviewStatus, summary.itemsInKitchen, summary.itemsReadyToServe]);

  const advanceItem = async (itemId, next) => {
    setBusy(`a-${itemId}`);
    try {
      await kitchenSetItemStatus(itemId, next);
      toast.success(
        next === "PREPARING" ? "Started preparing" : "Marked ready"
      );
      load();
      onChange?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <DetailPanel onClose={onClose} testId="kitchen-table-detail">
      {loading || !detail ? (
        <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-brand" size={24} /></div>
      ) : (
        <>
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">Table</div>
            <div className="font-heading text-4xl font-bold tracking-tight">{detail.tableNumber}</div>
            <div className="mt-2"><StatusBadge status={detail.overviewStatus} /></div>
          </div>
          <div className="flex items-center gap-4 text-xs text-ink2 mb-5">
            {detail.participantCount != null && (
              <span className="inline-flex items-center gap-1.5">
                <Users size={12} />{detail.participantCount} {detail.participantCount === 1 ? "person" : "people"}
              </span>
            )}
            {detail.openedAt && (
              <span>Opened {new Date(detail.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </div>
          {detail.billRequested && (
            <div className="mb-5 text-center rounded-2xl border border-yellow-300 bg-yellow-50 text-yellow-800 py-3 text-sm font-medium">
              Bill requested — no new items expected.
            </div>
          )}
          <TableNoteView note={detail.note} />
          {detail.orders && detail.orders.length > 0 ? (
            <OrderList
              orders={detail.orders}
              onAdvanceItem={advanceItem}
              busy={busy}
            />
          ) : (
            <div className="text-center py-8 text-ink2 italic">No orders on this table yet.</div>
          )}
        </>
      )}
    </DetailPanel>
  );
}

// ---------------- Queue view ----------------

function KitchenQueueView({ registerRefresh }) {
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { setQueue(await kitchenQueue()); }
    catch (e) { toast.error(e.message); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    registerRefresh({ fn: refresh, refreshing });
  }, [refresh, refreshing, registerRefresh]);

  useEffect(() => {
    refresh();
    const { deactivate } = createStompClient({
      subscriptions: [{ topic: "/topic/kitchen", handler: () => refresh() }],
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

  const advance = async (itemId, next) => {
    setBusy(`a-${itemId}`);
    try { await kitchenSetItemStatus(itemId, next); toast.success(`Marked ${next}`); refresh(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  // Table notes for every session shown in the queue — the SAME note is repeated on
  // both column-groups of the same order (Confirmed / Preparing) by design: when
  // items of one order split across columns, both groups need the note.
  const notesBySessionId = useQueueTableNotes(
    queue,
    kitchenTablesList,
    kitchenTableDetail
  );

  // Build the two per-order buckets. An order that has items in both statuses
  // will produce two groups — one in each column — carrying the same order id.
  const confirmedGroups = [];
  const preparingGroups = [];
  queue.forEach((o) => {
    const conf = (o.items || []).filter((it) => it.itemStatus === "CONFIRMED");
    const prep = (o.items || []).filter((it) => it.itemStatus === "PREPARING");
    if (conf.length) confirmedGroups.push({ order: o, items: conf });
    if (prep.length) preparingGroups.push({ order: o, items: prep });
  });

  const totalItems =
    confirmedGroups.reduce((s, g) => s + g.items.length, 0) +
    preparingGroups.reduce((s, g) => s + g.items.length, 0);

  return (
    <div data-testid="kitchen-queue-view">
      <p className="text-ink2 mb-4">
        {totalItems} item{totalItems === 1 ? "" : "s"} in queue ·{" "}
        {confirmedGroups.length} to start · {preparingGroups.length} in progress
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QueueColumn
          title="To Start"
          count={confirmedGroups.reduce((s, g) => s + g.items.length, 0)}
          Icon={ClipboardList}
          color="bg-blue-100 text-blue-700"
          empty="Nothing waiting to be started."
        >
          {confirmedGroups.map(({ order, items }) => (
            <OrderGroupCard
              key={`c-${order.id}`}
              order={order}
              items={items}
              note={notesBySessionId[order.tableSessionId]}
              testIdPrefix="k-confirmed"
              renderAction={(item) => (
                <button
                  onClick={() => advance(item.id, "PREPARING")}
                  disabled={busy === `a-${item.id}`}
                  data-testid={`k-start-${item.id}`}
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-full px-3 py-1 flex items-center gap-1 disabled:opacity-50"
                >
                  {busy === `a-${item.id}` ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <PlayCircle size={10} />
                  )}
                  Start
                </button>
              )}
            />
          ))}
        </QueueColumn>
        <QueueColumn
          title="In Progress"
          count={preparingGroups.reduce((s, g) => s + g.items.length, 0)}
          Icon={ChefHat}
          color="bg-amber-100 text-amber-800"
          empty="Nothing being prepared right now."
        >
          {preparingGroups.map(({ order, items }) => (
            <OrderGroupCard
              key={`p-${order.id}`}
              order={order}
              items={items}
              note={notesBySessionId[order.tableSessionId]}
              testIdPrefix="k-preparing"
              tint="amber"
              renderAction={(item) => (
                <button
                  onClick={() => advance(item.id, "READY")}
                  disabled={busy === `a-${item.id}`}
                  data-testid={`k-ready-${item.id}`}
                  className="text-xs bg-successc hover:opacity-90 text-white rounded-full px-3 py-1 flex items-center gap-1 disabled:opacity-50"
                >
                  {busy === `a-${item.id}` ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Bell size={10} />
                  )}
                  Ready
                </button>
              )}
            />
          ))}
        </QueueColumn>
      </div>
      {totalItems === 0 && (
        <div className="mt-6 text-center py-16 text-ink2 border border-dashed border-bg2 rounded-3xl">
          <ChefHat size={32} className="mx-auto mb-3 text-brand" />
          <p className="font-heading text-lg">All caught up.</p>
          <p className="text-sm mt-1">New orders will appear here.</p>
        </div>
      )}
    </div>
  );
}

function QueueColumn({ title, count, Icon, color, empty, children }) {
  const items = React.Children.toArray(children);
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className={`h-7 w-7 grid place-items-center rounded-full ${color}`}>
          <Icon size={13} />
        </div>
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        <span className="text-xs text-ink2 font-mono">({count})</span>
      </div>
      <div className="space-y-3">
        {items.length ? items : (
          <div className="text-center py-10 text-ink2 border border-dashed border-bg2 rounded-2xl">
            {empty}
          </div>
        )}
      </div>
    </section>
  );
}

function OrderGroupCard({ order, items, note, renderAction, tint, testIdPrefix }) {
  return (
    <div
      data-testid={`${testIdPrefix}-order-${order.id}`}
      className={`rounded-2xl p-4 border animate-fadeUp ${
        tint === "amber" ? "bg-amber-50 border-amber-200" : "bg-surface border-bg2"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
            Table {order.tableNumber} · Order #{order.id}
          </div>
          <div className="font-heading font-semibold">{order.status}</div>
        </div>
        {order.placedAt && (
          <div className="text-xs text-ink2">
            {new Date(order.placedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
      <TableNoteView note={note} />
      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.id}
            data-testid={`kitchen-item-${it.id}`}
            className="flex items-start justify-between gap-2 py-1"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-ink">
                {it.quantity}× {it.menuItemName || it.name}
              </div>
              <SelectedOptions
                options={it.selectedOptions}
                testId={`kitchen-item-options-${it.id}`}
              />
              {it.notes && (
                <div className="mt-0.5 text-xs text-ink2 italic">
                  &ldquo;{it.notes}&rdquo;
                </div>
              )}
            </div>
            <div className="shrink-0">{renderAction(it)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
