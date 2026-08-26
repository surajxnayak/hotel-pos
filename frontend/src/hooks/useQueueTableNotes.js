import { useCallback, useEffect, useState } from "react";

/**
 * Resolves session-note strings for a set of orders in a queue view.
 *
 * Backend fact: `OrderResponse` carries `tableSessionId` and `tableNumber` but NOT
 * the session's free-text `note`. The note only appears on `waiterTableDetail` /
 * `kitchenTableDetail`. This hook does the two-step reconciliation:
 *
 *   1. Fetch `tablesList()` once — has {tableId, sessionId} pairs.
 *   2. For every unique tableSessionId in `orders`, look up its tableId and fetch
 *      `tableDetail(tableId)` in parallel; keep the `.note` field.
 *
 * Result: `notesBySessionId` — a plain object keyed by `tableSessionId` so callers
 * can display the note next to any order in the queue, including orders that
 * split across columns (e.g. kitchen: some items PREPARING, others CONFIRMED —
 * both groups should show the same note).
 *
 * The hook is deliberately best-effort and silent on individual failures — a
 * missing note for one table should never break the whole queue.
 *
 * @param {OrderResponse[]} orders          List currently displayed in the queue.
 * @param {() => Promise}   tablesListFn    e.g. `waiterTablesList` or `kitchenTablesList`.
 * @param {(tid) => Promise} tableDetailFn  e.g. `waiterTableDetail` or `kitchenTableDetail`.
 */
export default function useQueueTableNotes(orders, tablesListFn, tableDetailFn) {
  const [notesBySessionId, setNotes] = useState({});

  // Comma-joined stable key so effect only re-runs when the set of table
  // sessions changes, not on every reference change of `orders`.
  const sessionIdsKey = Array.from(
    new Set((orders || []).map((o) => o.tableSessionId).filter(Boolean))
  )
    .sort((a, b) => a - b)
    .join(",");

  const load = useCallback(async () => {
    const ids = sessionIdsKey ? sessionIdsKey.split(",").map(Number) : [];
    if (ids.length === 0) {
      setNotes({});
      return;
    }
    try {
      const tables = (await tablesListFn()) || [];
      const tableIdBySessionId = {};
      tables.forEach((t) => {
        if (t.sessionId != null) tableIdBySessionId[t.sessionId] = t.tableId;
      });
      const entries = await Promise.all(
        ids.map(async (sid) => {
          const tid = tableIdBySessionId[sid];
          if (!tid) return [sid, null];
          try {
            const d = await tableDetailFn(tid);
            return [sid, d?.note || null];
          } catch {
            return [sid, null];
          }
        })
      );
      const next = {};
      entries.forEach(([sid, note]) => {
        next[sid] = note;
      });
      setNotes(next);
    } catch {
      // Fail silent — queue rendering must not depend on notes being available.
    }
  }, [sessionIdsKey, tablesListFn, tableDetailFn]);

  useEffect(() => {
    load();
  }, [load]);

  return notesBySessionId;
}
