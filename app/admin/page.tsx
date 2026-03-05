"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LegendPayload,
} from "recharts";
import {
  RefreshCw,
  Package,
  Boxes,
  PlusCircle,
  MinusCircle,
  Pencil,
  Trash2,
  Ban,
  Clock,
} from "lucide-react";
import { auth } from "@/src/lib/firebase/client";
import { useToast } from "@/src/hooks/useToast";
import { onAuthStateChanged } from "firebase/auth";

type ApiOk<T> = { ok: true; data: T } | { ok: false; error: string };

function safeNum(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function tsToMs(ts: any): number | null {
  if (!ts) return null;

  const sec = ts.seconds ?? ts._seconds;
  if (typeof sec === "number") return sec * 1000;

  if (typeof ts === "string") {
    const d = new Date(ts);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  if (ts instanceof Date) return ts.getTime();
  return null;
}

function fmtMaybeTs(v: any) {
  if (!v) return "—";
  if (typeof v === "string") return v;

  const ms = tsToMs(v);
  if (!ms) return "—";

  return new Date(ms).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortDate(dateStr: any) {
  const s = String(dateStr ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(5); // MM-DD
  return s;
}

/** Detect container width for compact mode */
function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width ?? 0;
      setW(width);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, w };
}

function CardShell({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border bg-white p-4 shadow-sm",
        "transition hover:shadow-md",
        className,
      ].join(" ")}
    >
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {right ? <div className="text-xs text-slate-500">{right}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "primary",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  tone?: "primary" | "warn" | "danger" | "neutral";
}) {
  const toneClasses =
    tone === "primary"
      ? "group-hover:bg-sky-600 group-hover:text-white"
      : tone === "warn"
        ? "group-hover:bg-amber-500 group-hover:text-white"
        : tone === "danger"
          ? "group-hover:bg-rose-600 group-hover:text-white"
          : "group-hover:bg-slate-700 group-hover:text-white";

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm",
        "transition hover:shadow-md",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {value}
          </div>
          {sub ? (
            <div className="mt-1 text-[11px] leading-4 text-slate-500">
              {sub}
            </div>
          ) : null}
        </div>

        <div
          className={[
            "flex h-11 w-11 items-center justify-center rounded-xl",
            "bg-slate-100 text-slate-700 transition",
            toneClasses,
          ].join(" ")}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="animate-pulse">
        <div className="h-3 w-28 rounded bg-slate-200" />
        <div className="mt-3 h-8 w-20 rounded bg-slate-200" />
        <div className="mt-3 h-3 w-40 rounded bg-slate-200" />
      </div>
    </div>
  );
}

// ---------------- Events helpers ----------------
function eventMeta(type: string) {
  const t = String(type || "");
  if (t === "product_create")
    return {
      label: "Product Added",
      icon: <PlusCircle size={16} />,
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  if (t === "stock_in")
    return {
      label: "Stock In",
      icon: <PlusCircle size={16} />,
      badge: "bg-sky-50 text-sky-700 border-sky-200",
    };
  if (t === "stock_out")
    return {
      label: "Stock Out",
      icon: <MinusCircle size={16} />,
      badge: "bg-amber-50 text-amber-800 border-amber-200",
    };
  if (t === "product_update")
    return {
      label: "Product Updated",
      icon: <Pencil size={16} />,
      badge: "bg-slate-50 text-slate-700 border-slate-200",
    };
  if (t === "product_delete")
    return {
      label: "Product Deleted",
      icon: <Trash2 size={16} />,
      badge: "bg-rose-50 text-rose-700 border-rose-200",
    };

  return {
    label: t || "Event",
    icon: <Clock size={16} />,
    badge: "bg-slate-50 text-slate-700 border-slate-200",
  };
}

// CompactLegend Component Definition
function CompactLegend({
  payload,
  compact,
}: {
  payload?: ReadonlyArray<LegendPayload>;
  compact: boolean;
}) {
  if (!payload?.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {payload.map((entry) => {
        const color = (entry as any)?.color ?? "#999";
        const label = String((entry as any)?.value ?? "");

        return (
          <div key={label} className="flex items-center gap-1" title={label}>
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: color }}
            />
            {!compact ? (
              <span className="text-[11px] text-slate-600">{label}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminPage() {
  const [global, setGlobal] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const { ref: containerRef, w } = useContainerWidth<HTMLDivElement>();
  const compact = w > 0 && w < 448;
  const [deletingAllEvents, setDeletingAllEvents] = useState(false);

  async function onDeleteAllEvents() {
    if (!isSuperAdmin) return;

    const ok = window.confirm("Delete ALL events?\n\nThis cannot be undone.");
    if (!ok) return;

    try {
      setDeletingAllEvents(true);

      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");

      const token = await current.getIdToken(true);

      const res = await fetch("/api/admin/delete-all-events", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete events");

      showToast({
        type: "success",
        message: "Events deleted",
        description: `Deleted ${data.deleted ?? 0} event(s).`,
      });
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Delete failed",
        description: e?.message ?? "Something went wrong",
      });
    } finally {
      setDeletingAllEvents(false);
    }
  }

  // get Firebase ID token (for admin API routes)
  async function getIdToken() {
    const { auth } = await import("@/src/lib/firebase/client");
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken(true);
  }

  // fetch helper that adds Authorization header
  async function authedJson<T>(url: string): Promise<T> {
    const token = await getIdToken();
    const res = await fetch(url, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    return (await res.json()) as T;
  }

  async function loadAll() {
    setLoading(true);
    setErr(null);

    try {
      const [g, d, ev] = await Promise.all([
        authedJson<ApiOk<any>>("/api/admin/analytics/global"),
        authedJson<ApiOk<any[]>>("/api/admin/analytics/daily?days=30"),
        authedJson<ApiOk<any[]>>("/api/admin/analytics/events?take=12"),
      ]);

      if (!g.ok) throw new Error(g.error);
      if (!d.ok) throw new Error(d.error);
      if (!ev.ok) throw new Error(ev.error);

      setGlobal(g.data ?? null);
      setDaily(Array.isArray(d.data) ? d.data : []);
      setEvents(Array.isArray(ev.data) ? ev.data : []);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsSuperAdmin(false);
        return;
      }

      const token = await user.getIdTokenResult(true);
      setIsSuperAdmin(Boolean(token?.claims?.superadmin));
    });

    return () => unsub();
  }, []);
  // DAILY CHART (used for totals + graph)
  const dailyChart = useMemo(() => {
    return daily
      .filter((x: any) => {
        const today = new Date().setHours(0, 0, 0, 0);
        const date = tsToMs(x.day ?? x.date);
        return date && new Date(date).setHours(0, 0, 0, 0) === today;
      })
      .map((x: any) => ({
        date: x.day ?? x.id ?? x.date ?? "",
        stockInQty: safeNum(x.stockInQty),
        stockOutQty: safeNum(x.stockOutQty),
      }));
  }, [daily]);
  const periodTotals = useMemo(() => {
    let stockInTotal = 0;
    let stockOutTotal = 0;

    for (const r of dailyChart) {
      stockInTotal += safeNum(r.stockInQty);
      stockOutTotal += safeNum(r.stockOutQty);
    }

    return {
      stockInTotal,
      stockOutTotal,
      netTotal: stockInTotal - stockOutTotal,
    };
  }, [dailyChart]);

  // Inventory Trend: based on stockInQty and stockOutQty
  const inventoryTrend = useMemo(() => {
    const endQty = safeNum(global?.totalStockQty);
    const rows = [...dailyChart];
    if (!rows.length) return [];

    const nets = rows.map(
      (r) => safeNum(r.stockInQty) - safeNum(r.stockOutQty),
    );
    const suffix = new Array(nets.length).fill(0);

    for (let i = nets.length - 2; i >= 0; i--) {
      suffix[i] = suffix[i + 1] + nets[i + 1];
    }

    return rows.map((r, i) => ({
      date: r.date,
      inventoryQty: Math.max(0, endQty - suffix[i]),
    }));
  }, [dailyChart, global?.totalStockQty]);

  // TOP CARDS
  const topCards = useMemo(() => {
    const g = global || {};
    const totalProducts = safeNum(g.totalProducts);
    const totalStockQty = safeNum(g.totalStockQty);

    return {
      totalProducts,
      totalStockQty,

      stockInTotal: periodTotals.stockInTotal,
      stockOutTotal: periodTotals.stockOutTotal,
      netTotal: periodTotals.netTotal,

      lastEventAt: g.lastEventAt,
      lastEventType: g.lastEventType ?? "—",
    };
  }, [global, periodTotals]);

  // Map events to eventRows
  // Modify the eventRows to include 'byEmail'
  const eventRows = useMemo(() => {
    return events.map((e: any, idx: number) => {
      const type = String(e.type ?? "");
      const meta = eventMeta(type);

      return {
        key: String(e.id ?? e.eventId ?? idx),
        type,
        typeLabel: meta.label,
        badgeClass: meta.badge,
        icon: meta.icon,

        at: e.at,
        atLabel: fmtMaybeTs(e.at),

        productName: e.productName ? String(e.productName) : null,
        productId: e.productId ? String(e.productId) : null,

        // qty change
        deltaQuantity:
          e.deltaQuantity === undefined || e.deltaQuantity === null
            ? null
            : safeNum(e.deltaQuantity),

        by: e.by ? String(e.by) : null,
        byEmail: e.by ? e.byEmail || "Unknown" : "Unknown",
      };
    });
  }, [events]);

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full bg-slate-50 @container"
    >
      <div className="w-full px-4 py-4 md:px-6 md:py-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Stockify Dashboard
            </h1>
            <div className="mt-1 text-xs text-slate-500">
              {loading ? "Loading…" : "Live inventory analytics"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadAll}
              className={[
                "inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2",
                "text-xs font-medium text-slate-700 transition",
                "hover:bg-sky-600 hover:text-white hover:border-sky-600",
                "active:scale-[0.99]",
              ].join(" ")}
              type="button"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <div className="rounded-full border bg-white px-3 py-2 text-xs text-slate-600">
              {loading ? "Syncing…" : "Live"}
            </div>
          </div>
        </div>

        {err ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        ) : null}

        {/* KPI row */}
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <StatCard
                label="Total Products"
                value={topCards.totalProducts}
                sub="All SKUs"
                icon={<Package size={20} />}
                tone="neutral"
              />
              <StatCard
                label="Total Stock Quantity"
                value={topCards.totalStockQty}
                sub="All items combined"
                icon={<Boxes size={20} />}
                tone="primary"
              />

              <StatCard
                label="Stock In Total"
                value={topCards.stockInTotal}
                sub="Total received today"
                icon={<PlusCircle size={20} />}
                tone="primary"
              />

              <StatCard
                label="Stock Out Total"
                value={topCards.stockOutTotal}
                sub="Total released today"
                icon={<MinusCircle size={20} />}
                tone="warn"
              />

              <StatCard
                label="Last Update"
                value={<span className="text-base font-semibold">Recent</span>}
                sub={
                  <span className="block leading-5">
                    {fmtMaybeTs(topCards.lastEventAt)}
                    <br />
                    <span className="text-slate-500">
                      Event: {String(topCards.lastEventType ?? "—")}
                    </span>
                  </span>
                }
                icon={<Clock size={20} />}
                tone="neutral"
              />
            </>
          )}
        </div>

        {/* Inventory-focused graphs + events */}
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <CardShell
            title="Inventory Quantity Trend"
            right="Estimated (last 30 days)"
            className="lg:col-span-3"
          >
            <div className=" h-70 w-full">
              <ResponsiveContainer>
                <LineChart
                  data={inventoryTrend}
                  margin={{
                    top: 10,
                    right: compact ? 6 : 20,
                    left: compact ? -10 : 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickMargin={8}
                    minTickGap={compact ? 24 : 16}
                    tickFormatter={(v) => (compact ? shortDate(v) : String(v))}
                  />
                  <YAxis width={compact ? 38 : 48} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="inventoryQty"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={false}
                    name="Inventory Qty"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 text-[11px] text-slate-500">
              Uses <code className="px-1">global.totalStockQty</code> as the
              ending value and applies daily net changes (
              <code className="px-1">stockInQty - stockOutQty</code>) to
              estimate the trend.
            </div>
          </CardShell>

          <CardShell
            title="Stock In vs Stock Out"
            right="Daily (today)"
            className="lg:col-span-2"
          >
            <div className="h-70 w-full">
              <ResponsiveContainer>
                <AreaChart
                  data={dailyChart}
                  margin={{
                    top: 10,
                    right: compact ? 6 : 20,
                    left: compact ? -10 : 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickMargin={8}
                    minTickGap={compact ? 24 : 16}
                    tickFormatter={(v) => (compact ? shortDate(v) : String(v))}
                  />
                  <YAxis width={compact ? 34 : 40} />
                  <Tooltip />
                  <Legend
                    content={(props) => (
                      <CompactLegend {...props} compact={compact} />
                    )}
                  />

                  <Area
                    type="monotone"
                    dataKey="stockInQty"
                    stroke="#0284c7"
                    fill="#0284c7"
                    fillOpacity={0.14}
                    name="Stock In"
                  />
                  <Area
                    type="monotone"
                    dataKey="stockOutQty"
                    stroke="#f97316"
                    fill="#f97316"
                    fillOpacity={0.1}
                    name="Stock Out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 text-[11px] text-slate-500">
              Totals on the cards are computed from the same{" "}
              <code className="px-1">analytics_daily</code> data (sum of{" "}
              <code className="px-1">stockInQty</code> and{" "}
              <code className="px-1">stockOutQty</code>) so they stay synced
              with this chart.
            </div>
          </CardShell>

          <CardShell
            title="Recent Inventory Events"
            right={
              <div className="flex items-center gap-2">
                <span>From analytics_events</span>

                {isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={onDeleteAllEvents}
                    disabled={deletingAllEvents}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Super admin only"
                  >
                    <Trash2 size={14} />
                    {deletingAllEvents ? "Deleting..." : "Delete all"}
                  </button>
                ) : null}
              </div>
            }
            className="lg:col-span-1"
          >
            <div className="max-h-70 space-y-2 overflow-y-auto pr-1">
              {loading ? (
                <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Loading events…
                </div>
              ) : eventRows.length ? (
                eventRows.map((ev) => (
                  <div
                    key={ev.key}
                    className="rounded-xl border bg-white px-3 py-2 transition hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              ev.badgeClass,
                            ].join(" ")}
                          >
                            {ev.icon}
                            {ev.typeLabel}
                          </span>
                        </div>

                        {/* Product Name */}
                        <div className="mt-1 text-xs text-slate-600">
                          <span className="font-medium text-slate-800">
                            {ev.productName ?? "Unknown Product"}
                          </span>
                        </div>

                        {/* Quantity */}
                        {ev.deltaQuantity !== null ? (
                          <div className="mt-1 text-[11px] text-slate-500">
                            Qty:{" "}
                            <span className="font-semibold text-slate-700">
                              {ev.deltaQuantity > 0
                                ? `+${ev.deltaQuantity}`
                                : ev.deltaQuantity}
                            </span>
                          </div>
                        ) : null}

                        {/* Email of the user who performed the action */}
                        {ev.byEmail ? (
                          <div className="mt-1 text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700">
                              Performed By:
                            </span>{" "}
                            {ev.byEmail}
                          </div>
                        ) : null}
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] font-semibold text-slate-700">
                          {ev.atLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  No events yet.
                </div>
              )}
            </div>

            <div className="mt-2 text-[11px] text-slate-500">
              This list reads the latest events ordered by{" "}
              <code className="px-1">at</code>.
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  );
}
