/* =========================
    FIX: CREATE PRODUCT ROUTE
   File: app/api/admin/products/create/route.ts
   - Adds supplier to products + analytics_products
   -  analytics_events now includes productName + deltaQuantity
   ========================= */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!idToken)
      return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.admin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();

    const name = String(body?.name || "").trim();
    const category = String(body?.category || "Uncategorized").trim();
    const quantity = Number(body?.quantity ?? 0);
    const minStock = Number(body?.minStock ?? 0);
    const expirationDate = body?.expirationDate
      ? String(body.expirationDate)
      : null;

    // supplier normalized to null when empty
    const supplier = body?.supplier ? String(body.supplier).trim() : "";
    const supplierValue = supplier ? supplier : null;

    const imageUrl = body?.imageUrl ? String(body.imageUrl) : null;
    const imagePublicId = body?.imagePublicId
      ? String(body.imagePublicId)
      : null;
    const imageFolder = body?.imageFolder ? String(body.imageFolder) : null;

    if (!name)
      return NextResponse.json({ error: "Missing name" }, { status: 400 });

    if (!Number.isFinite(quantity) || quantity < 0)
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });

    if (!Number.isFinite(minStock) || minStock < 0)
      return NextResponse.json({ error: "Invalid minStock" }, { status: 400 });

    const now = new Date();
    const day = dayKey(now);

    const stockStatus =
      quantity <= 0
        ? "out_of_stock"
        : quantity <= minStock
          ? "low_stock"
          : "ok";

    const productRef = adminDb.collection("products").doc();
    const productId = productRef.id;

    const eventRef = adminDb.collection("analytics_events").doc();
    const productAnalyticsRef = adminDb
      .collection("analytics_products")
      .doc(productId);

    const globalDashRef = adminDb
      .collection("dashboard_analytics")
      .doc("global");

    const dailyRef = adminDb.collection("analytics_daily").doc(day);
    const stockInLogRef = adminDb.collection("stock_in_logs").doc();

    await adminDb.runTransaction(async (tx) => {
      //  Products
      tx.set(productRef, {
        name,
        category,
        quantity,
        minStock,
        expirationDate,
        supplier: supplierValue,
        imageUrl,
        imagePublicId,
        imageFolder,
        createdAt: now,
        updatedAt: now,
        createdBy: decoded.uid,
        updatedBy: decoded.uid,
      });

      //  Events (NOW HAS productName + deltaQuantity)
      tx.create(eventRef, {
        type: "product_create",
        productId,
        productName: name, //  ADDED
        category, //  optional but useful
        deltaQuantity: quantity, //  qty change / initial qty
        at: now,
        by: decoded.uid,
      });

      //  analytics_products
      tx.set(productAnalyticsRef, {
        productId,
        name,
        category,
        quantity,
        minStock,
        stockStatus,
        expirationDate,
        supplier: supplierValue,
        imageUrl,
        imagePublicId,
        imageFolder,
        createdAt: now,
        updatedAt: now,
        lastEventAt: now,
        lastEventType: "product_create",
        lastEventBy: decoded.uid,
      });

      //  dashboard_analytics/global
      tx.set(
        globalDashRef,
        {
          totalProducts: FieldValue.increment(1),
          totalStockQty: FieldValue.increment(quantity),
          lowStockCount: FieldValue.increment(
            stockStatus === "low_stock" ? 1 : 0,
          ),
          outOfStockCount: FieldValue.increment(
            stockStatus === "out_of_stock" ? 1 : 0,
          ),
          updatedAt: now,
          lastEventAt: now,
          lastEventType: "product_create",
          lastEventBy: decoded.uid,
        },
        { merge: true },
      );

      //  Treat initial qty as Stock-In + logs + analytics_daily
      if (quantity > 0) {
        tx.set(stockInLogRef, {
          productId,
          productName: name,
          category,
          quantity,
          supplier: supplierValue,
          at: now,
          createdAt: now,
          createdBy: decoded.uid,
        });

        tx.set(
          dailyRef,
          {
            day,
            stockInQty: FieldValue.increment(quantity),
            updatedAt: now,
          },
          { merge: true },
        );
      }
    });

    return NextResponse.json({ ok: true, id: productId });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Create failed" },
      { status: 500 },
    );
  }
}
