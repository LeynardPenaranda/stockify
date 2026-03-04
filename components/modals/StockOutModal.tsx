"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Input, message } from "antd";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/lib/firebase/client";

type Props = {
  open: boolean;
  idToken: string | null;
  product: { id: string; name: string; quantity: number } | null;
  onClose: () => void;
  onSuccess?: () => void;
};

function safeNum(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export default function StockOutModal({
  open,
  idToken,
  product,
  onClose,
  onSuccess,
}: Props) {
  const [qty, setQty] = useState<number>(1);
  const [releasedTo, setReleasedTo] = useState("");
  const [purpose, setPurpose] = useState(""); // ✅ NEW
  const [qtyExceeded, setQtyExceeded] = useState(false);

  // auto-filled performer info
  const [performedByName, setPerformedByName] = useState<string>("");
  const [performedByEmail, setPerformedByEmail] = useState<string>("");

  const maxQty = useMemo(() => safeNum(product?.quantity), [product]);

  // prevent warning spam
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    setReleasedTo("");
    setPurpose(""); // ✅ reset
    setQtyExceeded(false);
    warnedRef.current = false;

    if (maxQty <= 0) setQty(0);
    else setQty(1);

    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setPerformedByName("");
        setPerformedByEmail("");
        return;
      }

      const name = (u.displayName || "").trim();
      const email = (u.email || "").trim();

      setPerformedByName(name || email || "Unknown");
      setPerformedByEmail(email || "");
    });

    return () => unsub();
  }, [open, maxQty]);

  // if maxQty changes while open, keep qty valid
  useEffect(() => {
    if (!open) return;

    if (maxQty <= 0) {
      setQty(0);
      setQtyExceeded(false);
      warnedRef.current = false;
      return;
    }

    setQty((prev) => clamp(safeNum(prev), 1, maxQty));
    setQtyExceeded(false);
    warnedRef.current = false;
  }, [maxQty, open]);

  async function submit() {
    if (!idToken) return message.error("Not authenticated");
    if (!product) return message.error("No product selected");

    if (maxQty <= 0) {
      return message.error("This product has 0 available stock.");
    }

    const q = safeNum(qty);

    // hard block if exceeded
    if (q > maxQty) {
      message.error(`Quantity exceeded. Max available is ${maxQty}.`);
      return;
    }

    const finalQty = clamp(q, 1, maxQty);

    // ✅ Purpose is required (you can make it optional by removing this block)
    if (!purpose.trim()) {
      return message.error("Purpose is required.");
    }

    const res = await fetch("/api/admin/stock-out/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        productId: product.id,
        quantity: finalQty,
        releasedTo: releasedTo.trim() ? releasedTo.trim() : null,
        purpose: purpose.trim(), // ✅ NEW
        performedByName: performedByName || null,
        performedByEmail: performedByEmail || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      message.error(data?.error || "Stock-out failed");
      return;
    }

    message.success("Stock-out recorded");
    onClose();
    onSuccess?.();
  }

  const qtyHelp =
    maxQty > 0 && qtyExceeded
      ? `Exceeded. Max available is ${maxQty}.`
      : undefined;

  return (
    <Modal
      title={product ? `Stock-Out: ${product.name}` : "Stock-Out"}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Record Stock-Out"
      destroyOnHidden
      okButtonProps={{
        danger: true,
        disabled: !product || maxQty <= 0 || qtyExceeded || !purpose.trim(), // ✅ disable if no purpose
      }}
    >
      <div className="space-y-4 pt-1">
        <div className="text-xs text-gray-500">
          Performed by:{" "}
          <span className="font-semibold text-gray-900">
            {performedByName || "—"}
          </span>
          {performedByEmail ? (
            <span className="text-gray-400"> ({performedByEmail})</span>
          ) : null}
        </div>

        <div className="text-xs text-gray-500">
          Available:{" "}
          <span className="font-semibold text-gray-900">{maxQty}</span>
        </div>

        <div className="mt-2">
          <Input
            type="number"
            min={maxQty <= 0 ? 0 : 1}
            max={maxQty || 0}
            value={qty}
            status={qtyExceeded ? "error" : ""}
            onChange={(e) => {
              const next = safeNum(e.target.value);

              if (maxQty <= 0) {
                setQty(0);
                setQtyExceeded(false);
                warnedRef.current = false;
                return;
              }

              setQty(next);

              const exceeded = next > maxQty;
              setQtyExceeded(exceeded);

              if (exceeded && !warnedRef.current) {
                warnedRef.current = true;
                message.warning(`Exceeded available stock. Max is ${maxQty}.`);
              }

              if (!exceeded) warnedRef.current = false;
            }}
            onBlur={() => {
              if (maxQty <= 0) return;
              // clamp on blur so it becomes valid after warning
              setQty((prev) => clamp(safeNum(prev), 1, maxQty));
              setQtyExceeded(false);
              warnedRef.current = false;
            }}
            placeholder="Quantity"
            disabled={maxQty <= 0}
          />
          {qtyHelp ? (
            <div className="mt-1 text-xs text-red-600">{qtyHelp}</div>
          ) : null}
        </div>

        <div className="mt-2">
          <Input
            value={releasedTo}
            onChange={(e) => setReleasedTo(e.target.value)}
            placeholder="Released to (optional)"
          />
        </div>

        {/* PURPOSE */}
        <div className="mt-2">
          <Input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Purpose (required) e.g., Sold, Donated, Issued, Damaged"
            status={!purpose.trim() ? "error" : ""}
          />
          {!purpose.trim() ? (
            <div className="mt-1 text-xs text-red-600">
              Purpose is required.
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
