import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type Body = {
  productId: string;
  quantity: number;
  supplier?: string | null;

  // optional from client
  stockInByName?: string | null;
  stockInByEmail?: string | null;
};

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
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

    const body = (await req.json()) as Body;

    const productId = String(body?.productId || "").trim();
    const qty = Number(body?.quantity ?? 0);
    const supplier = body?.supplier ? String(body.supplier).trim() : "";

    if (!productId)
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });

    if (!Number.isFinite(qty) || qty <= 0)
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });

    //  Identity: prefer client, fallback to Admin SDK
    let stockInByEmail = (
      body?.stockInByEmail ? String(body.stockInByEmail) : ""
    )
      .trim()
      .toLowerCase();
    let stockInByName = (
      body?.stockInByName ? String(body.stockInByName) : ""
    ).trim();

    if (!stockInByName || !stockInByEmail) {
      const user = await adminAuth.getUser(decoded.uid);
      const email = (user.email || "").trim().toLowerCase();
      const name = (user.displayName || "").trim();
      stockInByEmail = stockInByEmail || email;
      stockInByName = stockInByName || name || stockInByEmail || "Unknown";
    }

    const now = new Date();
    const day = dayKey(now);

    const productRef = adminDb.collection("products").doc(productId);
    const logRef = adminDb.collection("stock_in_logs").doc();
    const dailyRef = adminDb.collection("analytics_daily").doc(day);

    //  NEW: analytics_events ref
    const eventRef = adminDb.collection("analytics_events").doc();

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(productRef);
      if (!snap.exists) throw new Error("Product not found");

      const p = snap.data() as any;
      const productName = String(p.name ?? "");
      const category = String(p.category ?? "Uncategorized");

      const currentQty = Number(p.quantity ?? 0);
      const minStock = Number(p.minStock ?? 0);

      const nextQty = currentQty + qty;
      const stockStatus =
        nextQty <= 0
          ? "out_of_stock"
          : nextQty <= minStock
            ? "low_stock"
            : "ok";

      const productImageUrl = p.imageUrl ? String(p.imageUrl) : null;

      tx.update(productRef, {
        quantity: nextQty,
        updatedAt: now,
        updatedBy: decoded.uid,
      });

      //  Write NEW fields + also keep old "createdBy" for backward compatibility
      tx.set(logRef, {
        productId,
        productName,
        category,
        productImageUrl,
        quantity: qty,
        supplier: supplier ? supplier : null,

        stockInByName,
        stockInByEmail,
        stockInByUid: decoded.uid,

        createdBy: decoded.uid,

        at: now,
        createdAt: now,
      });

      tx.set(
        dailyRef,
        {
          day,
          stockInQty: FieldValue.increment(qty),
          updatedAt: now,
        },
        { merge: true },
      );

      tx.set(
        adminDb.collection("analytics_products").doc(productId),
        {
          productId,
          name: productName,
          category,
          quantity: nextQty,
          minStock,
          stockStatus,
          updatedAt: now,
          lastEventAt: now,
          lastEventType: "stock_in",
          lastEventBy: decoded.uid,
        },
        { merge: true },
      );

      tx.set(
        adminDb.collection("dashboard_analytics").doc("global"),
        {
          totalStockQty: FieldValue.increment(qty),
          updatedAt: now,
          lastEventAt: now,
          lastEventType: "stock_in",
          lastEventBy: decoded.uid,
        },
        { merge: true },
      );

      //  NEW: analytics_events (for dashboard Recent Events)
      tx.create(eventRef, {
        type: "stock_in",
        productId,
        productName,
        category,
        deltaQuantity: qty, //  positive
        at: now,
        by: decoded.uid,

        supplier: supplier ? supplier : null,
        byName: stockInByName,
        byEmail: stockInByEmail,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Stock-in failed" },
      { status: 500 },
    );
  }
}
