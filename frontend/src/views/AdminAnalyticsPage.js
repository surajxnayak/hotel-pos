import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "../components/AdminShell";
import {
  adminRevenue,
  adminTopItems,
  adminTiming,
  adminVoidDiscountReport,
  adminStaffPerformanceWaiters,
  adminStaffPerformanceCashiers,
  adminCustomerRetention,
  adminTablePerformance,
  adminPeakHours,
  adminTipSummary,
  adminDietaryMix,
  adminUpsellPerformance,
} from "../lib/api";
import { toast } from "sonner";
import {
  Loader2,
  TrendingUp,
  Trophy,
  Timer,
  Calendar,
  Users,
  Wallet,
  Coins,
  Ban,
  UtensilsCrossed,
  Flame,
  Building2,
  RefreshCw,
  Leaf,
  Sparkles,
  Receipt as ReceiptIcon,
  AlertTriangle,
  UserCheck,
} from "lucide-react";

// ---------- Formatting helpers ----------

const money = (n) => {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `₹${Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
const compactMoney = (n) => {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
  return `₹${v.toFixed(0)}`;
};
const num = (n) => (n == null ? "—" : Number(n).toLocaleString("en-IN"));
const pct = (n) => (n == null ? "—" : `${Number(n).toFixed(1)}%`);
const secondsToText = (s) => {
  if (s == null) return "—";
  const v = Number(s);
  if (v < 60) return `${v.toFixed(0)}s`;
  if (v < 3600) return `${(v / 60).toFixed(1)}m`;
  return `${(v / 3600).toFixed(1)}h`;
};

const DAY_LABEL = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};
const DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

// ---------- Main page ----------

export default function AdminAnalyticsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [range, setRange] = useState({ from: monthAgo, to: today });

  const [loading, setLoading] = useState(true);
  const [rev, setRev] = useState(null);
  const [top, setTop] = useState([]);
  const [timing, setTiming] = useState(null);
  const [voids, setVoids] = useState(null);
  const [waiters, setWaiters] = useState(null);
  const [cashiers, setCashiers] = useState(null);
  const [retention, setRetention] = useState(null);
  const [tables, setTables] = useState([]);
  const [peaks, setPeaks] = useState([]);
  const [tips, setTips] = useState(null);
  const [diet, setDiet] = useState(null);
  const [upsells, setUpsells] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const p = { from: range.from, to: range.to };
    try {
      const [
        r, t, ti, vd, sw, sc, cr, tp, ph, ts, dm, up,
      ] = await Promise.all([
        adminRevenue(p).catch(() => null),
        adminTopItems({ ...p, limit: 10 }).catch(() => []),
        adminTiming(p).catch(() => null),
        adminVoidDiscountReport(p).catch(() => null),
        adminStaffPerformanceWaiters(p).catch(() => null),
        adminStaffPerformanceCashiers(p).catch(() => null),
        adminCustomerRetention(p).catch(() => null),
        adminTablePerformance(p).catch(() => []),
        adminPeakHours(p).catch(() => []),
        adminTipSummary(p).catch(() => null),
        adminDietaryMix(p).catch(() => null),
        adminUpsellPerformance(p).catch(() => []),
      ]);
      setRev(r);
      setTop(Array.isArray(t) ? t : []);
      setTiming(ti);
      setVoids(vd);
      setWaiters(sw);
      setCashiers(sc);
      setRetention(cr);
      setTables(Array.isArray(tp) ? tp : []);
      setPeaks(Array.isArray(ph) ? ph : []);
      setTips(ts);
      setDiet(dm);
      setUpsells(Array.isArray(up) ? up : []);
    } catch (e) {
      toast.error(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = () => setRange({ from, to });

  const setPreset = (days) => {
    const toISO = new Date().toISOString().slice(0, 10);
    const fromISO = new Date(Date.now() - (days - 1) * 86400e3)
      .toISOString()
      .slice(0, 10);
    setFrom(fromISO);
    setTo(toISO);
    setRange({ from: fromISO, to: toISO });
  };

  return (
    <AdminShell title="Analytics">
      <RangeBar
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        onApply={apply}
        onPreset={setPreset}
        onRefresh={load}
        loading={loading}
      />

      {loading ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="animate-spin text-brand" size={28} />
        </div>
      ) : (
        <div className="space-y-8" data-testid="analytics-content">
          <KpiStrip
            rev={rev}
            tips={tips}
            retention={retention}
            voids={voids}
          />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <RevenueCard rev={rev} className="xl:col-span-2" />
            <TipsCard tips={tips} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <PeakHoursCard peaks={peaks} className="xl:col-span-2" />
            <RetentionCard retention={retention} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            <TopItemsCard top={top} />
            <UpsellCard upsells={upsells} />
            <DietaryMixCard diet={diet} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <TimingCard timing={timing} />
            <TablePerformanceCard tables={tables} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <WaitersCard waiters={waiters} />
            <CashiersCard cashiers={cashiers} />
          </div>

          <VoidDiscountCard voids={voids} />
        </div>
      )}
    </AdminShell>
  );
}

// ---------- Chrome ----------

function RangeBar({ from, to, onFrom, onTo, onApply, onPreset, onRefresh, loading }) {
  const presets = [
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
    { label: "90d", days: 90 },
  ];
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 bg-surface border border-bg2 rounded-2xl p-4 shadow-soft">
      <label className="block">
        <span className="text-[10px] uppercase tracking-widest text-ink2 font-semibold flex items-center gap-1">
          <Calendar size={10} />
          From
        </span>
        <input
          type="date"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          data-testid="analytics-from"
          className="mt-1 bg-bg border border-bg2 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">To</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onTo(e.target.value)}
          data-testid="analytics-to"
          className="mt-1 bg-bg border border-bg2 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
      </label>
      <button
        onClick={onApply}
        data-testid="analytics-apply"
        className="rounded-full bg-brand hover:bg-brandHover text-white text-sm font-medium px-5 py-2 shadow-soft transition"
      >
        Apply
      </button>
      <div className="flex items-center gap-1 ml-1">
        {presets.map((p) => (
          <button
            key={p.days}
            onClick={() => onPreset(p.days)}
            data-testid={`analytics-preset-${p.days}`}
            className="text-xs rounded-full border border-bg2 hover:border-brand hover:text-brand px-3 py-1 transition"
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        data-testid="analytics-refresh"
        className="ml-auto text-xs rounded-full border border-bg2 hover:border-brand hover:text-brand px-3 py-1.5 flex items-center gap-1.5 transition disabled:opacity-50"
      >
        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        Refresh
      </button>
    </div>
  );
}

function Section({ title, subtitle, Icon, tone = "brand", right, className = "", children, testId }) {
  const tones = {
    brand: "text-brand",
    ink: "text-ink",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    destructive: "text-destructive",
    blue: "text-blue-700",
  };
  return (
    <section
      data-testid={testId}
      className={`bg-surface border border-bg2 rounded-2xl p-5 shadow-soft ${className}`}
    >
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={16} className={tones[tone] || tones.brand} />}
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {subtitle && (
          <span className="text-xs text-ink2 hidden sm:inline">· {subtitle}</span>
        )}
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ text = "No data in this range." }) {
  return <p className="text-ink2 text-sm py-6 text-center italic">{text}</p>;
}

// ---------- KPI strip ----------

function KpiStrip({ rev, tips, retention, voids }) {
  const cards = [
    {
      key: "revenue",
      label: "Revenue",
      value: money(rev?.totalRevenue),
      hint: `${num(rev?.billCount)} bills`,
      Icon: TrendingUp,
      tint: "brand",
    },
    {
      key: "avg-bill",
      label: "Avg Bill",
      value: money(rev?.averageBillValue),
      hint: rev?.totalTax != null ? `tax ${money(rev.totalTax)}` : null,
      Icon: Wallet,
      tint: "ink",
    },
    {
      key: "tips",
      label: "Total Tips",
      value: money(tips?.totalTips),
      hint: `${num(tips?.entryCount)} entries`,
      Icon: Coins,
      tint: "emerald",
    },
    {
      key: "customers",
      label: "Customers",
      value: num(retention?.uniqueCustomers),
      hint:
        retention?.returningRate != null
          ? `${pct(retention.returningRate)} returning`
          : "unique in range",
      Icon: Users,
      tint: "blue",
    },
    {
      key: "discount",
      label: "Discounts Given",
      value: money(voids?.totalDiscountGiven),
      hint:
        voids?.discountAsPercentOfRevenue != null
          ? `${pct(voids.discountAsPercentOfRevenue)} of revenue`
          : `${num(voids?.discountCount)} times`,
      Icon: Sparkles,
      tint: "amber",
    },
    {
      key: "voids",
      label: "Voided",
      value: money(voids?.totalVoidedAmount),
      hint: `${num(voids?.voidCount)} bills`,
      Icon: Ban,
      tint: "destructive",
    },
  ];
  return (
    <div
      data-testid="kpi-strip"
      className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3"
    >
      {cards.map((c) => (
        <KpiTile key={c.key} {...c} />
      ))}
    </div>
  );
}

function KpiTile({ label, value, hint, Icon, tint }) {
  const bg = {
    brand: "bg-brand/10 text-brand",
    ink: "bg-ink/10 text-ink",
    emerald: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-800",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <div
      data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className="bg-surface border border-bg2 rounded-2xl p-4 hover:shadow-lift hover:-translate-y-0.5 transition-all"
    >
      <div className={`h-8 w-8 rounded-full grid place-items-center mb-2 ${bg[tint] || bg.brand}`}>
        <Icon size={14} />
      </div>
      <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
        {label}
      </div>
      <div className="font-heading text-xl font-bold tabular-nums mt-0.5">{value}</div>
      {hint && <div className="text-[11px] text-ink2 mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

// ---------- Revenue trend ----------

function RevenueCard({ rev, className = "" }) {
  const series = Array.isArray(rev?.dailyBreakdown) ? rev.dailyBreakdown : [];
  const max = Math.max(...series.map((d) => Number(d.revenue || 0)), 1);
  return (
    <Section
      title="Revenue Trend"
      subtitle="Daily bill revenue"
      Icon={TrendingUp}
      tone="brand"
      className={className}
      testId="revenue-card"
      right={
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
            Total
          </div>
          <div className="font-heading text-lg font-bold text-brand tabular-nums">
            {money(rev?.totalRevenue)}
          </div>
        </div>
      }
    >
      {series.length === 0 ? (
        <EmptyRow />
      ) : (
        <BarChart series={series} max={max} accessor="revenue" labelKey="date" />
      )}
      {series.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          <MicroStat label="Tax" value={money(rev?.totalTax)} />
          <MicroStat label="Discount" value={money(rev?.totalDiscount)} />
          <MicroStat label="Avg / Bill" value={money(rev?.averageBillValue)} />
        </div>
      )}
    </Section>
  );
}

function TipsCard({ tips }) {
  const series = Array.isArray(tips?.dailyBreakdown) ? tips.dailyBreakdown : [];
  const max = Math.max(...series.map((d) => Number(d.totalTips || 0)), 1);
  return (
    <Section
      title="Tips"
      subtitle="Daily tips collected"
      Icon={Coins}
      tone="emerald"
      testId="tips-card"
      right={
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
            Total
          </div>
          <div className="font-heading text-lg font-bold text-emerald-700 tabular-nums">
            {money(tips?.totalTips)}
          </div>
        </div>
      }
    >
      {series.length === 0 ? (
        <EmptyRow />
      ) : (
        <BarChart
          series={series}
          max={max}
          accessor="totalTips"
          labelKey="date"
          color="emerald"
        />
      )}
      {series.length > 0 && (
        <div className="mt-3 text-xs text-ink2">
          {num(tips?.entryCount)} tip{tips?.entryCount === 1 ? "" : "s"} logged
        </div>
      )}
    </Section>
  );
}

function BarChart({ series, max, accessor, labelKey, color = "brand" }) {
  const barCls =
    color === "emerald"
      ? "bg-emerald-500/80 group-hover:bg-emerald-600"
      : "bg-brand/80 group-hover:bg-brand";
  return (
    <div className="flex items-end gap-1 h-40" data-testid="bar-chart">
      {series.map((d, i) => {
        const v = Number(d[accessor] || 0);
        const h = (v / max) * 100;
        const lbl = String(d[labelKey] || "").slice(5); // MM-DD
        return (
          <div key={i} className="flex-1 group relative flex flex-col items-center">
            <div
              className={`w-full rounded-t transition-all ${barCls}`}
              style={{ height: `${h}%` }}
              title={`${d[labelKey]}: ${money(v)}`}
            />
            <div className="text-[8px] text-ink2 mt-1 h-3 rotate-45 origin-top-left whitespace-nowrap">
              {lbl}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MicroStat({ label, value }) {
  return (
    <div className="bg-bg rounded-xl p-2.5 border border-bg2">
      <div className="text-[9px] uppercase tracking-widest text-ink2 font-semibold">
        {label}
      </div>
      <div className="font-heading text-sm font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

// ---------- Peak hours heatmap ----------

function PeakHoursCard({ peaks, className = "" }) {
  // Build a lookup {day: {hour: count}} + max count
  const { grid, maxCount, totalBills, revenueByDay } = useMemo(() => {
    const g = {};
    let mx = 0;
    let total = 0;
    const rev = {};
    DAY_ORDER.forEach((d) => (g[d] = {}));
    (peaks || []).forEach((p) => {
      const d = p.dayOfWeek;
      const h = p.hourOfDay;
      if (!g[d]) g[d] = {};
      const c = Number(p.billCount || 0);
      g[d][h] = { billCount: c, revenue: Number(p.revenue || 0) };
      if (c > mx) mx = c;
      total += c;
      rev[d] = (rev[d] || 0) + Number(p.revenue || 0);
    });
    return { grid: g, maxCount: mx, totalBills: total, revenueByDay: rev };
  }, [peaks]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Section
      title="Peak Hours"
      subtitle="Day × hour heatmap"
      Icon={Flame}
      tone="amber"
      className={className}
      testId="peak-hours-card"
      right={
        <div className="text-xs text-ink2">
          {num(totalBills)} bills mapped
        </div>
      }
    >
      {(!peaks || peaks.length === 0) ? (
        <EmptyRow />
      ) : (
        <div className="overflow-x-auto -mx-2 px-2" data-testid="peak-hours-heatmap">
          <div className="min-w-[560px]">
            {/* Hour axis */}
            <div className="flex items-center gap-0.5 pl-10 mb-1">
              {hours.map((h) => (
                <div
                  key={h}
                  className="flex-1 text-center text-[8px] text-ink2 font-mono"
                >
                  {h % 3 === 0 ? h.toString().padStart(2, "0") : ""}
                </div>
              ))}
            </div>
            {DAY_ORDER.map((day) => (
              <div key={day} className="flex items-center gap-0.5 mb-0.5">
                <div className="w-9 text-[10px] uppercase tracking-widest text-ink2 font-semibold shrink-0">
                  {DAY_LABEL[day]}
                </div>
                <div className="flex-1 grid grid-cols-24 gap-0.5" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
                  {hours.map((h) => {
                    const cell = grid[day]?.[h];
                    const c = cell?.billCount || 0;
                    const intensity = maxCount > 0 ? c / maxCount : 0;
                    // Interpolate opacity for a nice orange-to-red heat.
                    const bg =
                      c === 0
                        ? "bg-bg2/40"
                        : intensity > 0.75
                        ? "bg-destructive"
                        : intensity > 0.5
                        ? "bg-amber-500"
                        : intensity > 0.25
                        ? "bg-amber-300"
                        : "bg-amber-200";
                    return (
                      <div
                        key={h}
                        className={`h-5 rounded-sm ${bg} transition-transform hover:scale-125 hover:z-10 relative cursor-help`}
                        title={
                          c === 0
                            ? `${DAY_LABEL[day]} ${h}:00 — no bills`
                            : `${DAY_LABEL[day]} ${h}:00 — ${c} bill${c === 1 ? "" : "s"} · ${money(cell?.revenue)}`
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-3 flex items-center gap-3 pl-10">
              <span className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
                Fewer
              </span>
              <div className="flex gap-0.5">
                <div className="h-3 w-4 rounded-sm bg-bg2/40" />
                <div className="h-3 w-4 rounded-sm bg-amber-200" />
                <div className="h-3 w-4 rounded-sm bg-amber-300" />
                <div className="h-3 w-4 rounded-sm bg-amber-500" />
                <div className="h-3 w-4 rounded-sm bg-destructive" />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
                More
              </span>
              <span className="ml-auto text-[11px] text-ink2">
                Highest cell: {num(maxCount)} bills
              </span>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

// ---------- Retention ----------

function RetentionCard({ retention }) {
  const rate = retention?.returningRate;
  const unique = retention?.uniqueCustomers ?? 0;
  const returningPct = rate == null ? 0 : Math.max(0, Math.min(100, Number(rate)));
  const newCount = retention?.newCustomers ?? 0;
  const retCount = retention?.returningCustomers ?? 0;
  return (
    <Section
      title="Customer Retention"
      Icon={UserCheck}
      tone="blue"
      testId="retention-card"
    >
      {!retention ? (
        <EmptyRow />
      ) : unique === 0 ? (
        <EmptyRow text="No customers in this range." />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <RingDial value={returningPct} color="#3b82f6" />
          <div className="grid grid-cols-2 gap-3 w-full">
            <MicroStat label="Unique" value={num(unique)} />
            <MicroStat label="New" value={num(newCount)} />
            <MicroStat label="Returning" value={num(retCount)} />
            <MicroStat label="Returning Rate" value={pct(rate)} />
          </div>
        </div>
      )}
    </Section>
  );
}

function RingDial({ value, color = "#D45D3F", label }) {
  // Simple SVG donut with a big centered percentage.
  const size = 140;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Number(value || 0)));
  const dash = (clamped / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#EAE3D9"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c - dash}`}
        strokeDashoffset={c / 4}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 500ms ease-out" }}
      />
      <text
        x="50%"
        y="46%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="font-heading fill-current text-ink"
        style={{ fontSize: 26, fontWeight: 700 }}
      >
        {clamped.toFixed(0)}%
      </text>
      <text
        x="50%"
        y="62%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="fill-current text-ink2"
        style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}
      >
        {label || "Returning"}
      </text>
    </svg>
  );
}

// ---------- Top items ----------

function TopItemsCard({ top }) {
  const maxQty = Math.max(...top.map((t) => Number(t.quantitySold || 0)), 1);
  return (
    <Section title="Top Items" subtitle="By quantity sold" Icon={Trophy} tone="brand" testId="top-items-card">
      {top.length === 0 ? (
        <EmptyRow />
      ) : (
        <div className="space-y-2.5" data-testid="top-items-list">
          {top.slice(0, 10).map((it, i) => (
            <div key={`${it.menuItemName}-${i}`} className="flex items-center gap-3">
              <div className="w-5 text-center font-mono text-ink2 text-xs">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {it.menuItemName || "—"}
                </div>
                <div className="h-1.5 bg-bg2 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-brand"
                    style={{
                      width: `${(Number(it.quantitySold || 0) / maxQty) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-semibold">
                  {num(it.quantitySold)}
                </div>
                <div className="text-[10px] text-ink2">{compactMoney(it.revenue)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ---------- Upsell performance ----------

function UpsellCard({ upsells }) {
  const maxRev = Math.max(...upsells.map((u) => Number(u.totalRevenue || 0)), 1);
  return (
    <Section
      title="Upsell Performance"
      subtitle="Add-ons & portion sizes"
      Icon={Sparkles}
      tone="amber"
      testId="upsell-card"
    >
      {upsells.length === 0 ? (
        <EmptyRow text="No customization selections yet." />
      ) : (
        <div className="space-y-2.5" data-testid="upsell-list">
          {upsells.slice(0, 10).map((u, i) => (
            <div key={`${u.optionName}-${i}`} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {u.optionName || "—"}
                </div>
                <div className="h-1.5 bg-bg2 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{
                      width: `${(Number(u.totalRevenue || 0) / maxRev) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-semibold text-amber-800">
                  {compactMoney(u.totalRevenue)}
                </div>
                <div className="text-[10px] text-ink2">
                  ×{num(u.timesSelected)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ---------- Dietary mix ----------

function DietaryMixCard({ diet }) {
  const total =
    (Number(diet?.vegRevenue || 0) +
      Number(diet?.nonVegRevenue || 0) +
      Number(diet?.eggRevenue || 0) +
      Number(diet?.untaggedRevenue || 0)) || 0;

  const buckets = [
    {
      key: "veg",
      label: "Veg",
      value: Number(diet?.vegRevenue || 0),
      pct: diet?.vegPercent,
      color: "#4A6B53",
      bg: "bg-emerald-600",
    },
    {
      key: "non_veg",
      label: "Non-veg",
      value: Number(diet?.nonVegRevenue || 0),
      pct: diet?.nonVegPercent,
      color: "#A63C2E",
      bg: "bg-red-700",
    },
    {
      key: "egg",
      label: "Egg",
      value: Number(diet?.eggRevenue || 0),
      pct: diet?.eggPercent,
      color: "#E29547",
      bg: "bg-amber-500",
    },
    {
      key: "untagged",
      label: "Untagged",
      value: Number(diet?.untaggedRevenue || 0),
      pct: null, // untagged percent isn't returned; derive if total > 0
      color: "#94a3b8",
      bg: "bg-slate-400",
    },
  ];

  return (
    <Section
      title="Dietary Mix"
      subtitle="Revenue by category"
      Icon={Leaf}
      tone="emerald"
      testId="dietary-mix-card"
    >
      {total === 0 ? (
        <EmptyRow />
      ) : (
        <div className="space-y-4">
          {/* Stacked bar */}
          <div className="h-3 rounded-full overflow-hidden flex bg-bg2">
            {buckets.map((b) => {
              const w = total > 0 ? (b.value / total) * 100 : 0;
              if (w <= 0) return null;
              return (
                <div
                  key={b.key}
                  className={b.bg}
                  style={{ width: `${w}%` }}
                  title={`${b.label}: ${money(b.value)}`}
                />
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {buckets.map((b) => {
              const derivedPct =
                b.pct != null
                  ? Number(b.pct)
                  : total > 0
                  ? (b.value / total) * 100
                  : null;
              return (
                <div
                  key={b.key}
                  data-testid={`dietary-${b.key}`}
                  className="flex items-center gap-2 bg-bg rounded-xl p-2.5 border border-bg2"
                >
                  <div className={`h-2.5 w-2.5 rounded-full ${b.bg}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
                      {b.label}
                    </div>
                    <div className="font-heading font-bold text-sm tabular-nums">
                      {compactMoney(b.value)}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-ink2 shrink-0">
                    {derivedPct == null ? "—" : `${derivedPct.toFixed(1)}%`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Section>
  );
}

// ---------- Timing ----------

function TimingCard({ timing }) {
  return (
    <Section title="Operational Timing" Icon={Timer} tone="brand" testId="timing-card">
      {!timing ? (
        <EmptyRow />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TimingStat
            label="Avg time to confirm"
            value={secondsToText(timing.averageTimeToConfirmSeconds)}
            sub="PLACED → CONFIRMED"
          />
          <TimingStat
            label="Avg time to serve"
            value={secondsToText(timing.averageTimeToServeSeconds)}
            sub="CONFIRMED → SERVED"
          />
          <TimingStat
            label="Orders sampled"
            value={num(timing.ordersSampled)}
            sub="in this range"
          />
        </div>
      )}
    </Section>
  );
}

function TimingStat({ label, value, sub }) {
  return (
    <div className="bg-bg rounded-xl p-3 border border-bg2">
      <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
        {label}
      </div>
      <div className="font-heading text-2xl font-bold tabular-nums mt-1">{value}</div>
      <div className="text-[10px] text-ink2 mt-0.5">{sub}</div>
    </div>
  );
}

// ---------- Table performance ----------

function TablePerformanceCard({ tables }) {
  const maxRev = Math.max(...tables.map((t) => Number(t.revenue || 0)), 1);
  const sorted = [...tables].sort(
    (a, b) => Number(b.revenue || 0) - Number(a.revenue || 0)
  );
  return (
    <Section
      title="Table Performance"
      subtitle="By revenue"
      Icon={Building2}
      tone="brand"
      testId="table-performance-card"
    >
      {sorted.length === 0 ? (
        <EmptyRow />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-ink2 font-semibold border-b border-bg2">
                <th className="text-left py-2 pr-2">Table</th>
                <th className="text-right py-2 px-2">Sessions</th>
                <th className="text-right py-2 px-2">Avg Duration</th>
                <th className="text-right py-2 pl-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const w = (Number(t.revenue || 0) / maxRev) * 100;
                return (
                  <tr
                    key={t.tableNumber}
                    data-testid={`table-perf-${t.tableNumber}`}
                    className="border-b border-bg2/60 last:border-0"
                  >
                    <td className="py-2 pr-2 font-mono font-semibold">
                      {t.tableNumber}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {num(t.sessionCount)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink2">
                      {t.avgSessionDurationMinutes == null
                        ? "—"
                        : `${Number(t.avgSessionDurationMinutes).toFixed(0)}m`}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="h-1 w-16 bg-bg2 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-brand"
                            style={{ width: `${w}%` }}
                          />
                        </div>
                        <span className="font-mono font-semibold tabular-nums">
                          {compactMoney(t.revenue)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ---------- Staff cards ----------

function WaitersCard({ waiters }) {
  const rows = waiters?.waiters || [];
  return (
    <Section
      title="Waiter Performance"
      Icon={UtensilsCrossed}
      tone="brand"
      testId="waiters-card"
      right={
        <span className="text-xs text-ink2">
          {num(rows.length)} active
        </span>
      }
    >
      {rows.length === 0 ? (
        <EmptyRow />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-ink2 font-semibold border-b border-bg2">
                <th className="text-left py-2 pr-2">Waiter</th>
                <th className="text-right py-2 px-2">Confirmed</th>
                <th className="text-right py-2 px-2">Avg&nbsp;Confirm</th>
                <th className="text-right py-2 px-2">Served</th>
                <th className="text-right py-2 pl-2">Avg&nbsp;Serve</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr
                  key={w.staffId}
                  data-testid={`waiter-perf-${w.staffId}`}
                  className="border-b border-bg2/60 last:border-0"
                >
                  <td className="py-2 pr-2 font-medium truncate">{w.staffName}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {num(w.ordersConfirmed)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-ink2">
                    {secondsToText(w.avgConfirmSeconds)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {num(w.ordersServed)}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums text-ink2">
                    {secondsToText(w.avgServeSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function CashiersCard({ cashiers }) {
  const rows = cashiers?.cashiers || [];
  return (
    <Section
      title="Cashier Performance"
      Icon={ReceiptIcon}
      tone="ink"
      testId="cashiers-card"
      right={
        <span className="text-xs text-ink2">
          {num(rows.length)} active
        </span>
      }
    >
      {rows.length === 0 ? (
        <EmptyRow />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-ink2 font-semibold border-b border-bg2">
                <th className="text-left py-2 pr-2">Cashier</th>
                <th className="text-right py-2 px-2">Bills</th>
                <th className="text-right py-2 px-2">Avg&nbsp;Value</th>
                <th className="text-right py-2 px-2">Voids</th>
                <th className="text-right py-2 pl-2">Voided ₹</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.staffId}
                  data-testid={`cashier-perf-${c.staffId}`}
                  className="border-b border-bg2/60 last:border-0"
                >
                  <td className="py-2 pr-2 font-medium truncate">{c.staffName}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {num(c.billsClosed)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {compactMoney(c.avgBillValue)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-destructive">
                    {num(c.voidsIssued)}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums text-destructive">
                    {compactMoney(c.totalVoidedAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ---------- Void & discount report ----------

function VoidDiscountCard({ voids }) {
  const byReason = voids?.voidsByReason || [];
  const byStaff = voids?.voidsByStaff || [];
  const maxReasonAmt = Math.max(
    ...byReason.map((r) => Number(r.totalAmount || 0)),
    1
  );
  const maxStaffAmt = Math.max(...byStaff.map((s) => Number(s.totalAmount || 0)), 1);

  return (
    <Section
      title="Loss Prevention"
      subtitle="Voids & discounts"
      Icon={AlertTriangle}
      tone="destructive"
      testId="void-discount-card"
    >
      {!voids ? (
        <EmptyRow />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MicroStat
              label="Total Voided"
              value={money(voids.totalVoidedAmount)}
            />
            <MicroStat label="Void Count" value={num(voids.voidCount)} />
            <MicroStat
              label="Discounts Given"
              value={money(voids.totalDiscountGiven)}
            />
            <MicroStat
              label="Discount % of Rev."
              value={pct(voids.discountAsPercentOfRevenue)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold mb-2 flex items-center gap-1">
                <Ban size={11} className="text-destructive" />
                Voids by reason
              </div>
              {byReason.length === 0 ? (
                <EmptyRow text="No voids in range." />
              ) : (
                <div className="space-y-2">
                  {byReason.map((r, i) => {
                    const w = (Number(r.totalAmount || 0) / maxReasonAmt) * 100;
                    return (
                      <div
                        key={`${r.reason}-${i}`}
                        data-testid={`void-reason-${i}`}
                        className="flex items-center gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">
                            {r.reason || "—"}
                          </div>
                          <div className="h-1 bg-bg2 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-destructive"
                              style={{ width: `${w}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-semibold text-destructive">
                            {compactMoney(r.totalAmount)}
                          </div>
                          <div className="text-[10px] text-ink2">
                            {num(r.count)} × 
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold mb-2 flex items-center gap-1">
                <Users size={11} className="text-destructive" />
                Voids by staff
              </div>
              {byStaff.length === 0 ? (
                <EmptyRow text="No voids in range." />
              ) : (
                <div className="space-y-2">
                  {byStaff.map((s, i) => {
                    const w = (Number(s.totalAmount || 0) / maxStaffAmt) * 100;
                    return (
                      <div
                        key={`${s.staffName}-${i}`}
                        data-testid={`void-staff-${i}`}
                        className="flex items-center gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">
                            {s.staffName || "—"}
                          </div>
                          <div className="h-1 bg-bg2 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-destructive"
                              style={{ width: `${w}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-semibold text-destructive">
                            {compactMoney(s.totalAmount)}
                          </div>
                          <div className="text-[10px] text-ink2">
                            {num(s.count)} × 
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
