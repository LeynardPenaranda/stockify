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
import { Boxes, Calendar, TriangleAlert, Minus, Plus } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/src/lib/firebase/client";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import type { UploadFile } from "antd";
import { uploadProductImage } from "@/src/lib/cloudinary/uploadProductImage";
import ProductUpsertModal from "@/components/modals/ProductUpsertModal";

type Product = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  expirationDate: string | null;
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
    expirationDate: "" as string,
  });

  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [saving, setSaving] = useState(false);

  const primaryBtnClass =
    "bg-primary hover:bg-hover border-primary hover:border-hover text-white";

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUid(null);
        setIdToken(null);
        return;
      }
      setUid(u.uid);
      setIdToken(await u.getIdToken());
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
            expirationDate: v.expirationDate ?? null,
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
        r.category.toLowerCase().includes(needle);
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
      expirationDate: "",
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
      expirationDate: p.expirationDate ?? "",
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
    if (quantity < 0 || minStock < 0)
      return message.error("Quantity and minimum stock must be 0 or higher");

    setSaving(true);
    try {
      let productId = editing?.id;

      // Create doc first (to get folder)
      if (!productId) {
        const ref = doc(collection(db, "products"));
        productId = ref.id;

        await setDoc(ref, {
          name,
          category: form.category || "Uncategorized",
          quantity,
          minStock,
          expirationDate: form.expirationDate ? form.expirationDate : null,
          imageUrl: null,
          imagePublicId: null,
          imageFolder: `kalikascan/products/${productId}`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: uid,
          updatedBy: uid,
        });
      }

      // Upload/replace image if provided
      const file = fileList?.[0]?.originFileObj as File | undefined;
      let imagePatch: any = {};

      if (file) {
        const up = await uploadProductImage({ idToken, productId, file });

        imagePatch = {
          imageUrl: up.imageUrl,
          imagePublicId: up.publicId,
          imageFolder: up.folder,
        };

        // delete old image if replacing
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

      await updateDoc(doc(db, "products", productId), {
        name,
        category: form.category || "Uncategorized",
        quantity,
        minStock,
        expirationDate: form.expirationDate ? form.expirationDate : null,
        ...imagePatch,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });

      message.success(editing ? "Product updated" : "Product created");
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
            await fetch("/api/admin/cloudinary/delete", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ publicId: p.imagePublicId }),
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

  async function changeQty(p: Product, delta: number) {
    const next = Math.max(0, safeNum(p.quantity) + delta);
    try {
      await updateDoc(doc(db, "products", p.id), {
        quantity: next,
        updatedAt: serverTimestamp(),
        updatedBy: uid ?? null,
      });
    } catch (e: any) {
      console.error(e);
      message.error(e?.message || "Failed to update quantity");
    }
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
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      width: 180,
      render: (v: any, r: Product) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeQty(r, -1)}
            className="h-9 w-9 rounded-lg border border-black/10 bg-white hover:bg-black/5 active:scale-[0.98] transition grid place-items-center"
            aria-label="Decrease quantity"
          >
            <Minus className="w-4 h-4" />
          </button>

          <div className="min-w-11 text-center font-semibold text-gray-900">
            {safeNum(v)}
          </div>

          <button
            type="button"
            onClick={() => changeQty(r, +1)}
            className="h-9 w-9 rounded-lg border border-black/10 bg-white hover:bg-black/5 active:scale-[0.98] transition grid place-items-center"
            aria-label="Increase quantity"
          >
            <Plus className="w-4 h-4" />
          </button>

          {isLowStock(r) ? (
            <Tag color="red" className="m-0">
              Low
            </Tag>
          ) : null}
        </div>
      ),
    },
    {
      title: "Min",
      dataIndex: "minStock",
      key: "minStock",
      width: 90,
      render: (v: any) => <span className="text-gray-700">{safeNum(v)}</span>,
    },
    {
      title: "Expiration",
      dataIndex: "expirationDate",
      key: "expirationDate",
      width: 140,
      render: (v: any) =>
        v ? (
          <span className="inline-flex items-center gap-1 text-gray-700">
            <Calendar className="w-4 h-4" /> {String(v)}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
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
      {/* Header */}
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

      {/* Controls */}
      <div className="bg-white border border-black/10 rounded-2xl p-3 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products..."
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

      {/* Desktop Table */}
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

      {/* Mobile Cards */}
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
          filtered.map((p) => (
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
              </div>

              <div className="p-4">
                <div className="font-semibold text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-500">{p.category}</div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeQty(p, -1)}
                      className="h-10 w-10 rounded-xl border border-black/10 bg-white hover:bg-black/5 active:scale-[0.98] transition grid place-items-center"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <div className="min-w-12 text-center font-bold text-gray-900">
                      {p.quantity}
                    </div>

                    <button
                      type="button"
                      onClick={() => changeQty(p, +1)}
                      className="h-10 w-10 rounded-xl border border-black/10 bg-white hover:bg-black/5 active:scale-[0.98] transition grid place-items-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-xs text-gray-500 text-right">
                    Min: <span className="font-semibold">{p.minStock}</span>
                    {p.expirationDate ? (
                      <div className="mt-0.5">
                        Exp:{" "}
                        <span className="font-semibold">
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
          ))
        )}
      </div>

      {/* Modal extracted */}
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
    </div>
  );
}
