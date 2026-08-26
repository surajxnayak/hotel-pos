import React, { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import Receipt from "../components/Receipt";
import { adminBills, voidBill } from "../lib/api";
import { toast } from "sonner";
import { Loader2, Eye, Calendar, Ban, AlertTriangle } from "lucide-react";

export default function AdminBillsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(null);
  const [voidFor, setVoidFor] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setList(await adminBills({ from, to })); } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const totalRevenue = (list || [])
    .filter((b) => b.paidAt && !b.voidedAt)
    .reduce((s, b) => s + Number(b.total || 0), 0);

  return (
    <AdminShell title="Bill History">
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <label className="block"><span className="text-[10px] uppercase tracking-widest text-ink2 font-semibold flex items-center gap-1"><Calendar size={10} />From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 bg-bg border border-bg2 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand" /></label>
        <label className="block"><span className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 bg-bg border border-bg2 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand" /></label>
        <button onClick={load} data-testid="bills-apply" className="rounded-full bg-brand hover:bg-brandHover text-white text-sm px-5 py-2 shadow-soft">Apply</button>
        <div className="flex-1" />
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">Total collected</div>
          <div className="font-heading text-2xl font-bold text-brand">₹{totalRevenue.toFixed(2)}</div>
        </div>
      </div>

      {loading ? <Loader2 className="animate-spin text-brand mx-auto mt-10" size={24} /> : (
        <div className="bg-surface border border-bg2 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg text-[10px] uppercase tracking-widest text-ink2 font-semibold">
              <tr><th className="text-left px-4 py-2">Bill #</th><th className="text-left px-4 py-2">Table</th><th className="text-left px-4 py-2">Generated</th><th className="text-right px-4 py-2">Total</th><th className="text-left px-4 py-2">Status</th><th className="text-right px-4 py-2"></th></tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} className="border-t border-bg2" data-testid={`bill-row-${b.id}`}>
                  <td className="px-4 py-2 font-mono">#{b.id}</td>
                  <td className="px-4 py-2">{b.tableNumber}</td>
                  <td className="px-4 py-2 text-xs">{b.generatedAt ? new Date(b.generatedAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-2 text-right font-mono">₹{Number(b.total || 0).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    {b.voidedAt || b.status === "VOIDED" ? (
                      <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">Voided</span>
                    ) : (
                      <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full ${b.paidAt ? "bg-successc/15 text-successc" : "bg-amber-100 text-amber-800"}`}>{b.paidAt ? `Paid · ${b.paymentMethod || ""}` : "Unpaid"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right"><button onClick={() => setView(b)} className="text-brand hover:underline text-xs flex items-center gap-1 ml-auto" data-testid={`view-bill-${b.id}`}><Eye size={11} />Receipt</button></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={6} className="text-center py-8 text-ink2">No bills in this range.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {view && (
        <div className="fixed inset-0 z-[60] bg-black/60 grid place-items-center p-4 overflow-y-auto" onClick={() => setView(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-w-md w-full my-8">
            <div className="rounded-3xl overflow-hidden shadow-lift receipt-print"><Receipt bill={view} /></div>
            <div className="mt-3 flex justify-between gap-2 flex-wrap">
              <button onClick={() => setView(null)} className="rounded-full border border-white/30 bg-white/10 text-white px-4 py-2 text-sm">Close</button>
              <div className="flex gap-2">
                {view.paidAt && !view.voidedAt && view.status !== "VOIDED" && (
                  <button
                    onClick={() => { setVoidFor(view); setView(null); }}
                    data-testid={`bill-void-${view.id}`}
                    className="flex items-center gap-1.5 rounded-full bg-destructive/90 hover:bg-destructive text-white px-4 py-2 text-sm shadow-soft"
                  >
                    <Ban size={13} />Void bill
                  </button>
                )}
                <button onClick={() => window.print()} className="rounded-full bg-brand text-white px-4 py-2 text-sm">Print</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {voidFor && (
        <VoidPrompt
          bill={voidFor}
          onClose={() => setVoidFor(null)}
          onDone={() => { setVoidFor(null); load(); }}
        />
      )}
    </AdminShell>
  );
}

function VoidPrompt({ bill, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!reason.trim()) return setErr("A reason is required.");
    setBusy(true);
    setErr("");
    try {
      await voidBill(bill.id, reason.trim());
      toast.success("Bill voided");
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="admin-void-modal"
        className="bg-surface rounded-3xl max-w-md w-full p-6 shadow-lift animate-fadeUp"
      >
        <h3 className="font-heading text-xl font-semibold mb-2">
          Void Bill #{bill.id}?
        </h3>
        <div className="flex items-start gap-2 rounded-xl bg-destructive/5 border border-destructive/20 p-3 text-xs text-ink2 leading-snug mb-3">
          <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
          Voiding marks this bill as reversed in the ledger. It does <span className="text-destructive font-semibold">not</span> reopen the session or refund customers automatically. This is permanent and audited.
        </div>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
            Reason (required)
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            data-testid="admin-void-reason"
            placeholder="e.g. Duplicate payment, wrong bill amount…"
            className="mt-1 w-full bg-bg border border-bg2 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-destructive resize-none"
          />
        </label>
        {err && (
          <div className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {err}
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-bg2 hover:bg-bg2/60 py-2.5 text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !reason.trim()}
            data-testid="admin-void-confirm"
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-destructive hover:opacity-90 text-white py-2.5 text-sm font-medium transition disabled:opacity-40"
          >
            {busy ? <Loader2 className="animate-spin" size={14} /> : <Ban size={14} />}
            Void Bill
          </button>
        </div>
      </div>
    </div>
  );
}
