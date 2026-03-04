"use client";

import { useEffect, useMemo, useState } from "react";
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

import { exportStockInLogsCsv } from "@/src/reports/stockInReport";
import StockTrendAreaChart from "@/components/analytics/StockTrendAreaChart";

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
  supplier: string | null;
  at: any;

  stockInByName?: string | null; // may be missing in old logs
  stockInByEmail?: string | null; // may be missing in old logs

  // legacy
  createdBy?: string | null; // UID in your current logs
};

function safeNum(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function toLocale(v: any) {
  return v?.toDate ? v.toDate().toLocaleString() : "—";
}

export default function StockInPage() {
  const [idToken, setIdToken] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const [qText, setQText] = useState("");
  const [cat, setCat] = useState<string | undefined>(undefined);

  const [chartIn, setChartIn] = useState<{ day: string; stockInQty: number }[]>(
    [],
  );

  // uid -> {name,email}
  const [userMap, setUserMap] = useState<
    Record<string, { name: string; email: string }>
  >({});

  // auth token
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return setIdToken(null);
      setIdToken(await u.getIdToken());
    });
    return () => unsub();
  }, []);

  // products (includes imageUrl for fallback)
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

  // stock_in_logs (table)
  useEffect(() => {
    const qy = query(
      collection(db, "stock_in_logs"),
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
              supplier: v.supplier ?? null,
              at: v.at,

              stockInByName: v.stockInByName ?? null,
              stockInByEmail: v.stockInByEmail ?? null,

              createdBy: v.createdBy ?? v.createdByUid ?? null,
            };
          }),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );

    return () => unsub();
  }, []);

  // analytics_daily (chart) — stockIn only
  useEffect(() => {
    const qy = query(
      collection(db, "analytics_daily"),
      orderBy("day", "desc"),
      limit(30),
    );
    return onSnapshot(qy, (snap) => {
      const rows = snap.docs
        .map((d) => d.data() as any)
        .map((v) => ({ day: String(v.day), stockInQty: safeNum(v.stockInQty) }))
        .reverse();
      setChartIn(rows);
    });
  }, []);

  // categories
  const categories = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => s.add(p.category || "Uncategorized"));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [products]);

  // productId -> product (for image fallback)
  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  // resolve missing user info for old logs (createdBy UID)
  useEffect(() => {
    if (!idToken) return;

    const need = Array.from(
      new Set(
        logs
          .filter((r) => {
            const hasName = Boolean((r.stockInByName ?? "").trim());
            const hasEmail = Boolean((r.stockInByEmail ?? "").trim());
            const uid = (r.createdBy ?? "").trim();
            return uid && (!hasName || !hasEmail) && !userMap[uid];
          })
          .map((r) => String(r.createdBy || "").trim())
          .filter(Boolean),
      ),
    );

    if (need.length === 0) return;

    (async () => {
      try {
        const res = await fetch("/api/admin/users/resolve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ uids: need }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Resolve failed");

        setUserMap((prev) => ({ ...prev, ...(data.users || {}) }));
      } catch (e: any) {
        // don't spam UI; just keep fallback as —
        console.error(e);
      }
    })();
  }, [logs, idToken, userMap]);

  // filtered
  const filtered = useMemo(() => {
    const needle = qText.trim().toLowerCase();
    return logs.filter((r) => {
      const uid = (r.createdBy ?? "").trim();
      const fallbackUser = uid ? userMap[uid] : null;
      const name = (r.stockInByName ?? fallbackUser?.name ?? "").toLowerCase();
      const email = (
        r.stockInByEmail ??
        fallbackUser?.email ??
        ""
      ).toLowerCase();

      const matchQ =
        !needle ||
        r.productName.toLowerCase().includes(needle) ||
        r.category.toLowerCase().includes(needle) ||
        String(r.supplier ?? "")
          .toLowerCase()
          .includes(needle) ||
        name.includes(needle) ||
        email.includes(needle);

      const matchCat = !cat || r.category === cat;
      return matchQ && matchCat;
    });
  }, [logs, qText, cat, userMap]);

  // enrich rows for CSV (apply same fallbacks)
  const enrichedForExport = useMemo(() => {
    return filtered.map((r) => {
      const uid = (r.createdBy ?? "").trim();
      const fallbackUser = uid ? userMap[uid] : null;

      const stockInByName =
        (r.stockInByName ?? "").trim() || fallbackUser?.name || "";
      const stockInByEmail =
        (r.stockInByEmail ?? "").trim() || fallbackUser?.email || "";

      const fallbackImage = productMap.get(r.productId)?.imageUrl ?? null;
      const productImageUrl = r.productImageUrl ?? fallbackImage ?? null;

      return { ...r, stockInByName, stockInByEmail, productImageUrl };
    });
  }, [filtered, userMap, productMap]);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* CHART CARD */}
      <Card className="rounded-2xl border-black/10">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-bold text-gray-900">Stock-In Analytics</div>
            <div className="text-xs text-gray-500">
              Last 30 days (Stock-In only)
            </div>
          </div>

          <Button
            onClick={() => {
              if (!idToken) return message.error("Not authenticated");
              exportStockInLogsCsv(enrichedForExport);
            }}
          >
            Download CSV
          </Button>
        </div>

        <StockTrendAreaChart
          title="Stock-In Trend"
          subtitle="Daily Quantity"
          data={chartIn}
          dataKey="stockInQty"
          label="Stock-In Qty"
          strokeColor="#22c55e"
          fillColor="#bbf7d0"
        />
      </Card>

      {/* TABLE CARD */}
      <Card className="rounded-2xl border-black/10">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">
            Stock-In <span className="text-green-600">History</span>
          </div>
          <Tag color="green" className="m-0">
            Stock-In Logs
          </Tag>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <Input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            prefix={<SearchOutlined />}
            placeholder="Search stock-in logs..."
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
          scroll={{ x: 1200 }}
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
              title: "Supplier",
              dataIndex: "supplier",
              key: "supplier",
              render: (v: any) => (v ? String(v) : "—"),
            },
            {
              title: "Stock-In By",
              key: "stockInBy",
              width: 280,
              render: (_: any, r: Log) => {
                const uid = (r.createdBy ?? "").trim();
                const fallbackUser = uid ? userMap[uid] : null;

                const name =
                  (r.stockInByName ?? "").trim() || fallbackUser?.name || "";
                const email =
                  (r.stockInByEmail ?? "").trim() || fallbackUser?.email || "";

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
