"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Boxes, Calendar, Minus, Plus } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/src/lib/firebase/client";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
} from "firebase/firestore";
import type { UploadFile } from "antd";
import { uploadProductImage } from "@/src/lib/cloudinary/uploadProductImage";
import ProductUpsertModal from "@/components/modals/ProductUpsertModal";
import StockOutModal from "@/components/modals/StockOutModal";

type Product = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  maxStock: number; // Add maxStock here
  expirationDate: string | null;
  supplier?: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  imageFolder: string | null;
  createdAt?: any;
  updatedAt?: any;
};

function safeNum(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function isLowStock(p: Product) {
  return safeNum(p.quantity) <= safeNum(p.minStock);
}

// ===== Expiry helpers (2 weeks) =====
const EXPIRY_WARNING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseExpiryMs(v: any): number | null {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate().getTime();

  const d = new Date(String(v));
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function expiryInfo(p: Product): { days: number | null; isSoon: boolean } {
  const ms = parseExpiryMs(p.expirationDate);
  if (!ms) return { days: null, isSoon: false };
  const days = Math.ceil((ms - Date.now()) / DAY_MS);
  const isSoon = days >= 0 && days <= EXPIRY_WARNING_DAYS;
  return { days, isSoon };
}

export default function AdminProductsPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | undefined>(undefined);

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const [form, setForm] = useState({
    name: "",
    category: "Uncategorized",
    quantity: 0,
    minStock: 0,
    maxStock: 0, // Add maxStock here
    expirationDate: "" as string,
    supplier: "" as string,
  });

  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [saving, setSaving] = useState(false);

  // StockOut modal state
  const [openStockOut, setOpenStockOut] = useState(false);
  const [stockOutProduct, setStockOutProduct] = useState<Product | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  const primaryBtnClass =
    "bg-primary hover:bg-hover border-primary hover:border-hover text-white";

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUid(null);
        setIdToken(null);
        setUserName("");
        setUserEmail("");
        return;
      }

      setUid(u.uid);
      setIdToken(await u.getIdToken());

      const email = (u.email || "").trim().toLowerCase();
      const name = (u.displayName || "").trim();

      setUserEmail(email);
      setUserName(name || email || "Unknown");
    });

    return () => unsub();
  }, []);

  // Live products list
  useEffect(() => {
    const qy = query(collection(db, "products"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const data: Product[] = snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            id: d.id,
            name: String(v.name ?? ""),
            category: String(v.category ?? "Uncategorized"),
            quantity: safeNum(v.quantity),
            minStock: safeNum(v.minStock),
            maxStock: safeNum(v.maxStock), // Add maxStock here
            expirationDate: v.expirationDate ?? null,
            supplier: v.supplier ?? null,
            imageUrl: v.imageUrl ?? null,
            imagePublicId: v.imagePublicId ?? null,
            imageFolder: v.imageFolder ?? null,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
          };
        });
        setRows(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        message.error("Failed to load products");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.category || "Uncategorized"));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const matchQ =
        !needle ||
        r.name.toLowerCase().includes(needle) ||
        r.category.toLowerCase().includes(needle) ||
        String(r.supplier ?? "")
          .toLowerCase()
          .includes(needle);
      const matchCat = !cat || r.category === cat;
      return matchQ && matchCat;
    });
  }, [rows, q, cat]);

  function resetForm() {
    setForm({
      name: "",
      category: "Uncategorized",
      quantity: 0,
      minStock: 0,
      maxStock: 0, // Reset maxStock
      expirationDate: "",
      supplier: "",
    });
    setFileList([]);
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setOpenModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category || "Uncategorized",
      quantity: safeNum(p.quantity),
      minStock: safeNum(p.minStock),
      maxStock: safeNum(p.maxStock), // Set maxStock
      expirationDate: p.expirationDate ?? "",
      supplier: String(p.supplier ?? ""),
    });
    setFileList([]);
    setOpenModal(true);
  }

  async function runCreateOrUpdate() {
    if (!uid || !idToken) return message.error("Not authenticated");

    const name = form.name.trim();
    if (!name) return message.error("Product name is required");

    const quantity = safeNum(form.quantity);
    const minStock = safeNum(form.minStock);
    const maxStock = safeNum(form.maxStock); // Add maxStock here
    if (quantity < 0 || minStock < 0 || maxStock < 0)
      return message.error("Quantity and minimum stock must be 0 or higher");

    const supplier = form.supplier.trim();

    setSaving(true);
    try {
      const file = fileList?.[0]?.originFileObj as File | undefined;

      let imagePatch: {
        imageUrl?: string;
        imagePublicId?: string;
        imageFolder?: string;
      } = {};

      if (file && !editing?.id) {
        const tempId = `temp_${Date.now()}`;
        const up = await uploadProductImage({
          idToken,
          productId: tempId,
          file,
        });

        imagePatch = {
          imageUrl: up.imageUrl,
          imagePublicId: up.publicId,
          imageFolder: up.folder,
        };
      }

      if (!editing?.id) {
        const res = await fetch("/api/admin/products/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            name,
            category: form.category || "Uncategorized",
            quantity,
            minStock,
            maxStock, // Add maxStock
            expirationDate: form.expirationDate ? form.expirationDate : null,
            supplier: supplier ? supplier : null,
            ...imagePatch,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Create failed");

        message.success("Product created");
      } else {
        const productId = editing.id;

        const patch: any = {
          name,
          category: form.category || "Uncategorized",
          quantity,
          minStock,
          maxStock, // Add maxStock
          expirationDate: form.expirationDate ? form.expirationDate : null,
          supplier: supplier ? supplier : null,
        };

        const file = fileList?.[0]?.originFileObj as File | undefined;
        if (file) {
          const up = await uploadProductImage({ idToken, productId, file });
          patch.imageUrl = up.imageUrl;
          patch.imagePublicId = up.publicId;
          patch.imageFolder = up.folder;

          if (editing?.imagePublicId && editing.imagePublicId !== up.publicId) {
            await fetch("/api/admin/cloudinary/delete", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ publicId: editing.imagePublicId }),
            });
          }
        }

        const res = await fetch(`/api/admin/products/${productId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(patch),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Update failed");

        message.success("Product updated");
      }

      setOpenModal(false);
      setEditing(null);
      resetForm();
    } catch (e: any) {
      console.error(e);
      message.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(p: Product) {
    if (!uid || !idToken) return message.error("Not authenticated");

    Modal.confirm({
      title: "Delete this product?",
      content: "This will also delete the product image (if any).",
      okText: "Delete",
      okButtonProps: { danger: true },
      async onOk() {
        try {
          if (p.imagePublicId) {
            await fetch("/api/admin/products/delete", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ productId: p.id }),
            });
          }

          await deleteDoc(doc(db, "products", p.id));
          message.success("Deleted");
        } catch (e: any) {
          console.error(e);
          message.error(e?.message || "Delete failed");
        }
      },
    });
  }

  async function openStockInForProduct(p: Product) {
    if (!idToken) return message.error("Not authenticated");

    let qty = 1;
    let supplier = "";

    Modal.confirm({
      title: `Stock-In: ${p.name}`,
      content: (
        <div className="space-y-3 pt-2">
          <Input
            type="number"
            min={1}
            defaultValue={qty}
            max={p.maxStock - p.quantity} // Set max limit for input
            onChange={(e) => (qty = Number(e.target.value))}
            placeholder="Quantity"
          />
          <Input
            defaultValue={supplier}
            onChange={(e) => (supplier = e.target.value)}
            placeholder="Supplier (optional)"
          />
        </div>
      ),
      okText: "Record Stock-In",
      async onOk() {
        if (qty + p.quantity > p.maxStock) {
          message.error("Cannot add stock. Maximum stock limit reached.");
          return;
        }

        const res = await fetch("/api/admin/stock-in/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            productId: p.id,
            quantity: qty,
            supplier,
            stockInByName: userName || null,
            stockInByEmail: userEmail || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Stock-in failed");
        message.success("Stock-in recorded");
      },
    });
  }

  function openStockOutForProduct(p: Product) {
    if (!idToken) return message.error("Not authenticated");
    setStockOutProduct(p);
    setOpenStockOut(true);
  }

  const columns = [
    {
      title: "Product",
      key: "product",
      render: (_: any, r: Product) => (
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl overflow-hidden bg-black/5 shrink-0">
            {r.imageUrl ? (
              <Image
                src={r.imageUrl}
                alt={r.name}
                width={44}
                height={44}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-black/30">
                <Boxes className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{r.name}</div>
            <div className="text-xs text-gray-500 truncate">{r.category}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Supplier",
      dataIndex: "supplier",
      key: "supplier",
      width: 180,
      render: (v: any) =>
        v ? String(v) : <span className="text-gray-400">—</span>,
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      width: 220,
      render: (v: any, r: Product) => {
        const { isSoon, days } = expiryInfo(r);

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openStockOutForProduct(r)}
              className="h-9 w-9 rounded-lg border border-black/10 bg-white hover:bg-black/5 active:scale-[0.98] transition grid place-items-center"
              aria-label="Stock-out"
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="min-w-11 text-center font-semibold text-gray-900">
              {safeNum(v)}
            </div>

            <button
              type="button"
              onClick={() => openStockInForProduct(r)}
              className="h-9 w-9 rounded-lg border border-black/10 bg-white hover:bg-black/5 active:scale-[0.98] transition grid place-items-center"
              aria-label="Stock-in"
              disabled={r.quantity >= r.maxStock} // Disable button if quantity >= maxStock
            >
              <Plus className="w-4 h-4" />
            </button>

            {isLowStock(r) ? (
              <Tag color="red" className="m-0">
                Low
              </Tag>
            ) : null}

            {/* Optional: small expiry tag beside qty too */}
            {!isLowStock(r) && isSoon ? (
              <Tag color="gold" className="m-0">
                Exp {typeof days === "number" ? `(${days}d)` : ""}
              </Tag>
            ) : null}
          </div>
        );
      },
    },
    {
      title: "Min",
      dataIndex: "minStock",
      key: "minStock",
      width: 90,
      render: (v: any) => <span className="text-gray-700">{safeNum(v)}</span>,
    },
    {
      title: "Max",
      dataIndex: "maxStock",
      key: "maxStock", // Add Max stock column
      width: 90,
      render: (v: any) => <span className="text-gray-700">{safeNum(v)}</span>,
    },
    {
      title: "Expiration",
      dataIndex: "expirationDate",
      key: "expirationDate",
      width: 170,
      render: (_: any, r: Product) => {
        if (!r.expirationDate) return <span className="text-gray-400">—</span>;

        const { isSoon, days } = expiryInfo(r);

        return (
          <span className="inline-flex items-center gap-2 text-gray-700">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-4 h-4" /> {String(r.expirationDate)}
            </span>

            {isSoon ? (
              <Tag color="gold" className="m-0">
                Expiring {typeof days === "number" ? `(${days}d)` : ""}
              </Tag>
            ) : null}
          </span>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 180,
      render: (_: any, r: Product) => (
        <div className="flex items-center justify-end gap-2">
          <Button onClick={() => openEdit(r)}>Edit</Button>
          <Button danger onClick={() => onDelete(r)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
        <div>
          <div className="text-lg font-bold text-gray-900">
            Product Management
          </div>
          <div className="text-xs text-gray-500">
            Add, edit, delete, categorize, and set minimum stock levels.
          </div>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${primaryBtnClass} active:scale-[0.98] transition`}
        >
          <PlusOutlined />
          Add Product
        </button>
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-3 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products or supplier..."
          prefix={<SearchOutlined />}
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
          <div className="text-xs text-gray-500">{filtered.length} item(s)</div>
        </div>
      </div>

      <div className="hidden md:block">
        <Card className="rounded-2xl border-black/10">
          <Table
            rowKey="id"
            loading={loading}
            columns={columns as any}
            dataSource={filtered}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No products found"
                />
              ),
            }}
          />
        </Card>
      </div>

      <div className="md:hidden grid grid-cols-1 gap-3">
        {loading ? (
          <Card className="rounded-2xl border-black/10">
            <div className="text-sm text-gray-500">Loading…</div>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="rounded-2xl border-black/10">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No products found"
            />
          </Card>
        ) : (
          filtered.map((p) => {
            const { isSoon, days } = expiryInfo(p);

            return (
              <Card
                key={p.id}
                className="rounded-2xl border-black/10 overflow-hidden p-0"
              >
                <div className="relative w-full h-56 bg-black/5">
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      fill
                      sizes="100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-black/30">
                      <Boxes className="w-8 h-8" />
                    </div>
                  )}

                  {isLowStock(p) ? (
                    <div className="absolute top-3 left-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-600 text-white">
                        Low Stock
                      </span>
                    </div>
                  ) : null}

                  {isSoon ? (
                    <div className="absolute top-3 right-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-500 text-white">
                        Expiring Soon{" "}
                        {typeof days === "number" ? `• ${days}d` : ""}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="p-4">
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.category}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Supplier:{" "}
                    <span className="font-semibold">{p.supplier || "—"}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openStockOutForProduct(p)}
                        className="h-10 w-10 rounded-xl border border-black/10 bg-white hover:bg-black/5 active:scale-[0.98] transition grid place-items-center"
                        aria-label="Stock-out"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <div className="min-w-12 text-center font-bold text-gray-900">
                        {p.quantity}
                      </div>

                      <button
                        type="button"
                        onClick={() => openStockInForProduct(p)}
                        className="h-10 w-10 rounded-xl border border-black/10 bg-white hover:bg-black/5 active:scale-[0.98] transition grid place-items-center"
                        aria-label="Stock-in"
                        disabled={p.quantity >= p.maxStock} // Disable if max stock reached
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-xs text-gray-500 text-right">
                      Min: <span className="font-semibold">{p.minStock}</span>
                      Max: <span className="font-semibold">
                        {p.maxStock}
                      </span>{" "}
                      {/* Display max stock */}
                      {p.expirationDate ? (
                        <div className="mt-0.5">
                          Exp:{" "}
                          <span
                            className={`font-semibold ${isSoon ? "text-yellow-700" : ""}`}
                          >
                            {p.expirationDate}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button size="small" onClick={() => openEdit(p)}>
                      Edit
                    </Button>
                    <Button size="small" danger onClick={() => onDelete(p)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <ProductUpsertModal
        open={openModal}
        saving={saving}
        editing={editing}
        form={form}
        setForm={setForm}
        fileList={fileList}
        setFileList={setFileList}
        onCancel={() => {
          setOpenModal(false);
          setEditing(null);
          resetForm();
        }}
        onSubmit={runCreateOrUpdate}
      />

      <StockOutModal
        open={openStockOut}
        idToken={idToken}
        product={
          stockOutProduct
            ? {
                id: stockOutProduct.id,
                name: stockOutProduct.name,
                quantity: stockOutProduct.quantity,
              }
            : null
        }
        onClose={() => {
          setOpenStockOut(false);
          setStockOutProduct(null);
        }}
      />
    </div>
  );
}
