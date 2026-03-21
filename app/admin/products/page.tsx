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
import { Boxes, Calendar, Minus, Plus, SquarePen, Trash } from "lucide-react";
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
  maxStock: number;
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
    maxStock: 0,
    expirationDate: "" as string,
    supplier: "" as string,
  });

  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [saving, setSaving] = useState(false);

  const [openStockOut, setOpenStockOut] = useState(false);
  const [stockOutProduct, setStockOutProduct] = useState<Product | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  const primaryBtnClass =
    "border-0 bg-gradient-to-r from-[#17335e] to-[#29b6e8] text-white shadow-sm hover:from-[#12284a] hover:to-[#1fa3d2]";
  const stockAdjustBtnClass =
    "grid place-items-center border border-[#b7e7ee] bg-gradient-to-r from-[#f4fcfd] to-[#cfeff4] text-[#29b6c8] shadow-sm transition hover:from-[#ecf9fb] hover:to-[#bee7ee] active:scale-[0.98]";

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
            maxStock: safeNum(v.maxStock),
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
      maxStock: 0,
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
      maxStock: safeNum(p.maxStock),
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
    const maxStock = safeNum(form.maxStock);
    if (quantity < 0 || minStock < 0 || maxStock < 0) {
      return message.error("Quantity and minimum stock must be 0 or higher");
    }

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
            maxStock,
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
          maxStock,
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

    let qty: number | string = 1; // Allowing qty to be either a number or an empty string
    let supplier = "";

    Modal.confirm({
      title: `Stock-In: ${p.name}`,
      content: (
        <div className="pt-2">
          <Input
            type="number"
            min={1}
            defaultValue={qty}
            max={p.maxStock - p.quantity}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value <= 0) {
                qty = ""; // Reset to empty string if value is 0 or negative
              } else {
                qty = value;
              }
            }}
            placeholder="Quantity"
            className="input-gap" // Custom class for spacing
          />
          <Input
            defaultValue={supplier}
            onChange={(e) => (supplier = e.target.value)}
            placeholder="Supplier (optional)"
            className="input-gap" // Custom class for spacing
          />
        </div>
      ),
      okText: "Record Stock-In",
      okButtonProps: {
        style: { backgroundColor: "#102a4d" }, // Button background color
      },
      async onOk() {
        // Ensure qty is a number before performing any operation
        const finalQty = typeof qty === "number" ? qty : 0; // Convert to 0 if qty is empty string
        if (finalQty + p.quantity > p.maxStock) {
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
            quantity: finalQty,
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
      title: <span className="font-semibold text-[#102a4d]">Product</span>,
      key: "product",
      render: (_: any, r: Product) => (
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-black/5">
            {r.imageUrl ? (
              <Image
                src={r.imageUrl}
                alt={r.name}
                width={44}
                height={44}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-[#102a4d]/40">
                <Boxes className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-[#102a4d]">
              {r.name}
            </div>
            <div className="truncate text-xs text-[#102a4d]">{r.category}</div>
          </div>
        </div>
      ),
    },
    {
      title: <span className="font-semibold text-[#102a4d]">Supplier</span>,
      dataIndex: "supplier",
      key: "supplier",
      width: 180,
      render: (v: any) =>
        v ? String(v) : <span className="text-[#102a4d]">—</span>,
    },
    {
      title: <span className="font-semibold text-[#102a4d]">Qty</span>,
      dataIndex: "quantity",
      key: "quantity",
      width: 220,
      render: (v: any, r: Product) => {
        const { isSoon, days } = expiryInfo(r);

        return (
          <div className="flex items-center gap-2 text-[#102a4d]">
            <button
              type="button"
              onClick={() => openStockOutForProduct(r)}
              className={`${stockAdjustBtnClass} h-9 w-9 rounded-lg`}
              aria-label="Stock-out"
            >
              <Minus className="h-4 w-4" />
            </button>

            <div className="min-w-11 text-center font-semibold text-[#102a4d]">
              {safeNum(v)}
            </div>

            <button
              type="button"
              onClick={() => openStockInForProduct(r)}
              className={`${stockAdjustBtnClass} h-9 w-9 rounded-lg`}
              aria-label="Stock-in"
              disabled={r.quantity >= r.maxStock}
            >
              <Plus className="h-4 w-4" />
            </button>

            {isLowStock(r) ? (
              <Tag color="red" className="m-0">
                Low
              </Tag>
            ) : null}

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
      title: <span className="font-semibold text-[#102a4d]">Min</span>,
      dataIndex: "minStock",
      key: "minStock",
      width: 90,
      render: (v: any) => <span className="text-[#102a4d]">{safeNum(v)}</span>,
    },
    {
      title: <span className="font-semibold text-[#102a4d]">Max</span>,
      dataIndex: "maxStock",
      key: "maxStock",
      width: 90,
      render: (v: any) => <span className="text-[#102a4d]">{safeNum(v)}</span>,
    },
    {
      title: <span className="font-semibold text-[#102a4d]">Expiration</span>,
      dataIndex: "expirationDate",
      key: "expirationDate",
      width: 170,
      render: (_: any, r: Product) => {
        if (!r.expirationDate) return <span className="text-[#102a4d]">—</span>;

        const { isSoon, days } = expiryInfo(r);

        return (
          <span className="inline-flex items-center gap-2 text-[#102a4d]">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4" /> {String(r.expirationDate)}
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
          <Button className="text-[#102a4d]!" onClick={() => openEdit(r)}>
            Edit
            <SquarePen className="h-4 w-4" />
          </Button>
          <Button danger onClick={() => onDelete(r)}>
            Delete
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 text-[#102a4d] lg:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-lg font-bold text-[#102a4d]">
            Product Management
          </div>
          <div className="text-xs text-[#102a4d]">
            Add, edit, delete, categorize, and set minimum stock levels.
          </div>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${primaryBtnClass} cursor-pointer transition active:scale-[0.98]`}
        >
          <PlusOutlined />
          Add Product
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products or supplier..."
          prefix={<SearchOutlined className="text-[#102a4d]" />}
          className="sm:max-w-sm [&_.ant-input]:text-[#102a4d] [&_.ant-input-prefix]:text-[#102a4d]"
          allowClear
        />

        <div className="flex items-center gap-2">
          <Select
            value={cat}
            onChange={(v) => setCat(v)}
            placeholder="All categories"
            allowClear
            className="min-w-45 [&_.ant-select-selection-item]:text-[#102a4d] [&_.ant-select-selection-placeholder]:text-[#102a4d]/60"
            options={categories.map((c) => ({ label: c, value: c }))}
          />
          <div className="text-xs text-[#102a4d]">
            {filtered.length} item(s)
          </div>
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
            className="
              [&_.ant-table-thead>tr>th]:text-[#102a4d]!
              [&_.ant-table-thead>tr>th]:font-semibold
              [&_.ant-table-tbody>tr>td]:text-[#102a4d]!
              [&_.ant-pagination]:text-[#102a4d]!
              [&_.ant-pagination-item>a]:text-[#102a4d]!
              [&_.ant-pagination-prev]:text-[#102a4d]!
              [&_.ant-pagination-next]:text-[#102a4d]!
            "
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span className="text-[#102a4d]">No products found</span>
                  }
                />
              ),
            }}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:hidden">
        {loading ? (
          <Card className="rounded-2xl border-black/10">
            <div className="text-sm text-[#102a4d]">Loading…</div>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="rounded-2xl border-black/10">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-[#102a4d]">No products found</span>
              }
            />
          </Card>
        ) : (
          filtered.map((p) => {
            const { isSoon, days } = expiryInfo(p);

            return (
              <Card
                key={p.id}
                className="overflow-hidden rounded-2xl border-black/10 p-0"
              >
                <div className="relative h-56 w-full bg-black/5">
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      fill
                      sizes="100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[#102a4d]/40">
                      <Boxes className="h-8 w-8" />
                    </div>
                  )}

                  {isLowStock(p) ? (
                    <div className="absolute left-3 top-3">
                      <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                        Low Stock
                      </span>
                    </div>
                  ) : null}

                  {isSoon ? (
                    <div className="absolute right-3 top-3">
                      <span className="rounded-full bg-yellow-500 px-2 py-1 text-xs font-semibold text-white">
                        Expiring Soon{" "}
                        {typeof days === "number" ? `• ${days}d` : ""}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="p-4">
                  <div className="font-semibold text-[#102a4d]">{p.name}</div>
                  <div className="text-xs text-[#102a4d]">{p.category}</div>
                  <div className="mt-1 text-xs text-[#102a4d]">
                    Supplier:{" "}
                    <span className="font-semibold">{p.supplier || "—"}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openStockOutForProduct(p)}
                        className={`${stockAdjustBtnClass} h-10 w-10 rounded-xl`}
                        aria-label="Stock-out"
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <div className="min-w-12 text-center font-bold text-[#102a4d]">
                        {p.quantity}
                      </div>

                      <button
                        type="button"
                        onClick={() => openStockInForProduct(p)}
                        className={`${stockAdjustBtnClass} h-10 w-10 rounded-xl`}
                        aria-label="Stock-in"
                        disabled={p.quantity >= p.maxStock}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="text-right text-xs text-[#102a4d]">
                      Min: <span className="font-semibold">{p.minStock}</span>
                      <br />
                      Max: <span className="font-semibold">{p.maxStock}</span>
                      {p.expirationDate ? (
                        <div className="mt-0.5">
                          Exp:{" "}
                          <span
                            className={`font-semibold ${isSoon ? "text-yellow-700" : "text-[#102a4d]"}`}
                          >
                            {p.expirationDate}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button
                      size="small"
                      className="text-[#102a4d]!"
                      onClick={() => openEdit(p)}
                    >
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
