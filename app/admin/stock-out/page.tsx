"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Card, Table, Input, Select, Button, Tag, message } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/src/lib/firebase/client";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";

import { exportStockOutLogsCsv } from "@/src/reports/stockOutReport";
import StockTrendAreaChart from "@/components/analytics/StockTrendAreaChart";
import { ArrowDownToLine } from "lucide-react";

type Product = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  imageUrl?: string | null;
};

type Log = {
  id: string;
  productId: string;
  productName: string;
  category: string;

  productImageUrl?: string | null; // may be missing in old logs

  quantity: number;
  releasedTo: string | null;
  purpose: string | null;
  at: any;

  // new
  stockOutByName?: string | null;
  stockOutByEmail?: string | null;
  stockOutByUid?: string | null;

  // legacy fallbacks
  performedByName?: string | null;
  performedByEmail?: string | null;
  performedByUid?: string | null;
  createdBy?: string | null; // UID in old docs
};

function safeNum(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function toLocale(v: any) {
  return v?.toDate ? v.toDate().toLocaleString() : "—";
}

function purposeColor(purpose: string) {
  const x = purpose.toLowerCase();
  if (x.includes("sold")) return "green";
  if (x.includes("donat")) return "blue";
  if (x.includes("damage") || x.includes("expired") || x.includes("waste"))
    return "red";
  if (x.includes("issue") || x.includes("use")) return "purple";
  return "gold";
}

export default function StockOutPage() {
  const [idToken, setIdToken] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const [qText, setQText] = useState("");
  const [cat, setCat] = useState<string | undefined>(undefined);

  const [chartOut, setChartOut] = useState<
    { day: string; stockOutQty: number }[]
  >([]);

  // uid -> {name,email}
  const [userMap, setUserMap] = useState<
    Record<string, { name: string; email: string }>
  >({});
  const attemptedUserResolvesRef = useRef<Record<string, true>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return setIdToken(null);
      setIdToken(await u.getIdToken());
    });
    return () => unsub();
  }, []);

  // products (for categories + image fallback)
  useEffect(() => {
    const qy = query(collection(db, "products"), orderBy("name", "asc"));
    return onSnapshot(qy, (snap) => {
      setProducts(
        snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            id: d.id,
            name: String(v.name ?? ""),
            category: String(v.category ?? "Uncategorized"),
            quantity: safeNum(v.quantity),
            imageUrl: v.imageUrl ?? null,
          };
        }),
      );
    });
  }, []);

  // stock_out_logs
  useEffect(() => {
    const qy = query(
      collection(db, "stock_out_logs"),
      orderBy("createdAt", "desc"),
      limit(200),
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        setLogs(
          snap.docs.map((d) => {
            const v = d.data() as any;
            return {
              id: d.id,
              productId: String(v.productId),
              productName: String(v.productName ?? ""),
              category: String(v.category ?? "Uncategorized"),

              productImageUrl: v.productImageUrl ?? null,

              quantity: safeNum(v.quantity),
              releasedTo: v.releasedTo ?? null,
              purpose: v.purpose ?? null,
              at: v.at,

              stockOutByName: v.stockOutByName ?? null,
              stockOutByEmail: v.stockOutByEmail ?? null,
              stockOutByUid: v.stockOutByUid ?? null,

              performedByName: v.performedByName ?? null,
              performedByEmail: v.performedByEmail ?? null,
              performedByUid: v.performedByUid ?? null,
              createdBy: v.createdBy ?? null,
            };
          }),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  // analytics_daily chart (stockOut only)
  useEffect(() => {
    const qy = query(
      collection(db, "analytics_daily"),
      orderBy("day", "desc"),
      limit(30),
    );
    return onSnapshot(qy, (snap) => {
      const rows = snap.docs
        .map((d) => d.data() as any)
        .map((v) => ({
          day: String(v.day),
          stockOutQty: safeNum(v.stockOutQty),
        }))
        .reverse();
      setChartOut(rows);
    });
  }, []);

  const categories = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => s.add(p.category || "Uncategorized"));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  // resolve missing user info (old logs that only have UID)
  useEffect(() => {
    if (!idToken) return;

    const needUids = Array.from(
      new Set(
        logs
          .map((r) => {
            // pick the best UID field we can
            const uid =
              (r.stockOutByUid ?? "").trim() ||
              (r.performedByUid ?? "").trim() ||
              (r.createdBy ?? "").trim();
            if (!uid) return "";
            const hasName = Boolean(
              (r.stockOutByName ?? r.performedByName ?? "").trim(),
            );
            const hasEmail = Boolean(
              (r.stockOutByEmail ?? r.performedByEmail ?? "").trim(),
            );
            return (!hasName || !hasEmail) &&
              !userMap[uid] &&
              !attemptedUserResolvesRef.current[uid]
              ? uid
              : "";
          })
          .filter(Boolean),
      ),
    );

    if (needUids.length === 0) return;

    (async () => {
      needUids.forEach((uid) => {
        attemptedUserResolvesRef.current[uid] = true;
      });

      try {
        const res = await fetch("/api/admin/users/resolve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ uids: needUids }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Resolve failed");

        setUserMap((prev) => ({ ...prev, ...(data.users || {}) }));
      } catch (e) {
        console.error(e);
      }
    })();
  }, [logs, idToken, userMap]);

  const filtered = useMemo(() => {
    const needle = qText.trim().toLowerCase();
    return logs.filter((r) => {
      const uid =
        (r.stockOutByUid ?? "").trim() ||
        (r.performedByUid ?? "").trim() ||
        (r.createdBy ?? "").trim();
      const fallbackUser = uid ? userMap[uid] : null;

      const name = (
        r.stockOutByName ??
        r.performedByName ??
        fallbackUser?.name ??
        ""
      ).toLowerCase();
      const email = (
        r.stockOutByEmail ??
        r.performedByEmail ??
        fallbackUser?.email ??
        ""
      ).toLowerCase();

      const matchQ =
        !needle ||
        r.productName.toLowerCase().includes(needle) ||
        r.category.toLowerCase().includes(needle) ||
        String(r.releasedTo ?? "")
          .toLowerCase()
          .includes(needle) ||
        String(r.purpose ?? "")
          .toLowerCase()
          .includes(needle) ||
        name.includes(needle) ||
        email.includes(needle);

      const matchCat = !cat || r.category === cat;
      return matchQ && matchCat;
    });
  }, [logs, qText, cat, userMap]);

  // enrich for CSV export (apply same fallbacks)
  const enrichedForExport = useMemo(() => {
    return filtered.map((r) => {
      const uid =
        (r.stockOutByUid ?? "").trim() ||
        (r.performedByUid ?? "").trim() ||
        (r.createdBy ?? "").trim();
      const fallbackUser = uid ? userMap[uid] : null;

      const stockOutByName =
        (r.stockOutByName ?? r.performedByName ?? "").trim() ||
        fallbackUser?.name ||
        "";
      const stockOutByEmail =
        (r.stockOutByEmail ?? r.performedByEmail ?? "").trim() ||
        fallbackUser?.email ||
        "";

      const fallbackImage = productMap.get(r.productId)?.imageUrl ?? null;
      const productImageUrl = r.productImageUrl ?? fallbackImage ?? null;

      return { ...r, stockOutByName, stockOutByEmail, productImageUrl };
    });
  }, [filtered, userMap, productMap]);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* CHART */}
      <Card
        className="mt-6 rounded-2xl shadow-none"
        style={{ borderColor: "#17335e", borderWidth: 1 }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-bold text-gray-900">Stock-Out Analytics</div>
            <div className="text-xs text-gray-500">
              Last 30 days (Stock-Out only)
            </div>
          </div>

          <Button
            onClick={() => {
              if (!idToken) return message.error("Not authenticated");
              exportStockOutLogsCsv(enrichedForExport);
            }}
            className="flex items-center gap-2 border-0! text-white! shadow-sm"
            style={{
              background: "linear-gradient(90deg, #17335e 0%, #29b6e8 100%)",
              color: "#ffffff",
            }}
          >
            <ArrowDownToLine size={15} />
            <span className="hidden sm:inline">Stock Out Report</span>
          </Button>
        </div>

        <StockTrendAreaChart
          title="Stock-Out Trend"
          subtitle="Daily Quantity"
          data={chartOut}
          dataKey="stockOutQty"
          label="Stock-Out Qty"
          strokeColor="#ef4444"
          fillColor="#fecaca"
        />
      </Card>

      <div className="h-6" />

      {/* TABLE */}
      <Card
        className="rounded-2xl shadow-none"
        style={{ borderColor: "#17335e", borderWidth: 1 }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">
            Stock-Out <span className="text-red-600">History</span>
          </div>
          <Tag color="red" className="m-0">
            Stock-Out Logs
          </Tag>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <Input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            prefix={<SearchOutlined />}
            placeholder="Search stock-out logs..."
            className="sm:max-w-sm"
            allowClear
          />

          <div className="flex items-center gap-2">
            <Select
              value={cat}
              onChange={(v) => setCat(v)}
              placeholder="All categories"
              allowClear
              className="min-w-45"
              options={categories.map((c) => ({ label: c, value: c }))}
            />
            <div className="text-xs text-gray-500">
              {filtered.length} log(s)
            </div>
          </div>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1400 }}
          className="
            [&_.ant-table-thead>tr>th]:bg-gray-100!
            [&_.ant-table-thead>tr>th]:text-[#17335e]!
            [&_.ant-table-thead>tr>th]:!font-black
            [&_.ant-table-thead_.ant-table-column-title]:!font-black
            [&_.ant-table-thead>tr>th]:border-y-[#17335e]!
            [&_.ant-table-thead>tr>th:first-child]:border-l-[#17335e]!
            [&_.ant-table-thead>tr>th:last-child]:border-r-[#17335e]!
            [&_.ant-table-thead>tr>th+th]:border-l-[#17335e]/30!
            [&_.ant-table-tbody>tr>td]:text-[#17335e]!
          "
          columns={[
            {
              title: "Product",
              key: "product",
              render: (_: any, r: Log) => {
                const fallbackImage =
                  productMap.get(r.productId)?.imageUrl ?? null;
                const img = r.productImageUrl ?? fallbackImage;

                return (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/5 shrink-0">
                      {img ? (
                        <Image
                          src={img}
                          alt={r.productName}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-black/30">
                          —
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">
                        {r.productName}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {r.category}
                      </div>
                    </div>
                  </div>
                );
              },
            },
            {
              title: "Qty",
              dataIndex: "quantity",
              key: "quantity",
              width: 90,
              render: (v: number) => <span className="font-semibold">{v}</span>,
            },
            {
              title: "Released To",
              dataIndex: "releasedTo",
              key: "releasedTo",
              render: (v: any) => (v ? String(v) : "—"),
            },
            {
              title: "Purpose",
              dataIndex: "purpose",
              key: "purpose",
              render: (v: any) =>
                v ? (
                  <Tag color={purposeColor(String(v))}>{String(v)}</Tag>
                ) : (
                  "—"
                ),
            },
            {
              title: "Stock-Out By",
              key: "stockOutBy",
              width: 280,
              render: (_: any, r: Log) => {
                const uid =
                  (r.stockOutByUid ?? "").trim() ||
                  (r.performedByUid ?? "").trim() ||
                  (r.createdBy ?? "").trim();
                const fallbackUser = uid ? userMap[uid] : null;

                const name =
                  (r.stockOutByName ?? r.performedByName ?? "").trim() ||
                  fallbackUser?.name ||
                  "";
                const email =
                  (r.stockOutByEmail ?? r.performedByEmail ?? "").trim() ||
                  fallbackUser?.email ||
                  "";

                if (name && email) return `${name} (${email})`;
                if (name) return name;
                if (email) return email;
                return "—";
              },
            },
            {
              title: "Date",
              dataIndex: "at",
              key: "at",
              width: 180,
              render: (v: any) => toLocale(v),
            },
          ]}
        />
      </Card>
    </div>
  );
}
