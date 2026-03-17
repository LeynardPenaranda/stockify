import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getAppDayKey } from "@/src/lib/date/appDay";

export const runtime = "nodejs";

type Body = {
  productId: string;
  quantity: number;
  releasedTo?: string | null;
  purpose?: string | null;

  stockOutByName?: string | null;
  stockOutByEmail?: string | null;
};

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
    const releasedTo = body?.releasedTo ? String(body.releasedTo).trim() : "";
    const purpose = body?.purpose ? String(body.purpose).trim() : "";

    if (!productId)
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });

    if (!Number.isFinite(qty) || qty <= 0)
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });

    if (!purpose)
      return NextResponse.json(
        { error: "Purpose is required" },
        { status: 400 },
      );

    // Identity: prefer client, fallback to Admin SDK
    let stockOutByEmail = (
      body?.stockOutByEmail ? String(body.stockOutByEmail) : ""
    )
      .trim()
      .toLowerCase();
    let stockOutByName = (
      body?.stockOutByName ? String(body.stockOutByName) : ""
    ).trim();

    if (!stockOutByName || !stockOutByEmail) {
      const user = await adminAuth.getUser(decoded.uid);
      const email = (user.email || "").trim().toLowerCase();
      const name = (user.displayName || "").trim();
      stockOutByEmail = stockOutByEmail || email;
      stockOutByName = stockOutByName || name || stockOutByEmail || "Unknown";
    }

    const now = new Date();
    const day = getAppDayKey(now);

    const productRef = adminDb.collection("products").doc(productId);
    const logRef = adminDb.collection("stock_out_logs").doc();
    const dailyRef = adminDb.collection("analytics_daily").doc(day);

    // NEW: analytics event ref
    const eventRef = adminDb.collection("analytics_events").doc();

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(productRef);
      if (!snap.exists) throw new Error("Product not found");

      const p = snap.data() as any;
      const productName = String(p.name ?? "");
      const category = String(p.category ?? "Uncategorized");

      const currentQty = Number(p.quantity ?? 0);
      const minStock = Number(p.minStock ?? 0);

      if (qty > currentQty) {
        throw new Error(`Not enough stock. Available: ${currentQty}`);
      }

      const nextQty = currentQty - qty;
      const stockStatus =
        nextQty <= 0
          ? "out_of_stock"
          : nextQty <= minStock
            ? "low_stock"
            : "ok";

      const productImageUrl = p.imageUrl ? String(p.imageUrl) : null;

      // update product qty
      tx.update(productRef, {
        quantity: nextQty,
        updatedAt: now,
        updatedBy: decoded.uid,
      });

      // stock-out log
      tx.set(logRef, {
        productId,
        productName,
        category,
        productImageUrl,
        quantity: qty,
        releasedTo: releasedTo ? releasedTo : null,
        purpose,

        stockOutByName,
        stockOutByEmail,
        stockOutByUid: decoded.uid,

        // LEGACY (if older UI still reads these)
        performedByName: stockOutByName,
        performedByEmail: stockOutByEmail,
        createdBy: decoded.uid,

        at: now,
        createdAt: now,
      });

      // analytics_daily
      tx.set(
        dailyRef,
        { day, stockOutQty: FieldValue.increment(qty), updatedAt: now },
        { merge: true },
      );

      // analytics_products
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
          lastEventType: "stock_out",
          lastEventBy: decoded.uid,
        },
        { merge: true },
      );

      // dashboard_analytics/global
      tx.set(
        adminDb.collection("dashboard_analytics").doc("global"),
        {
          totalStockQty: FieldValue.increment(-qty),
          updatedAt: now,
          lastEventAt: now,
          lastEventType: "stock_out",
          lastEventBy: decoded.uid,
        },
        { merge: true },
      );

      // NEW: analytics_events (so dashboard Recent Events can show productName + qty)
      tx.create(eventRef, {
        type: "stock_out",
        productId,
        productName, // ADDED
        category, // optional but useful
        deltaQuantity: -qty, // negative because stock decreased
        at: now,
        by: decoded.uid,

        // optional context (nice for audit)
        releasedTo: releasedTo ? releasedTo : null,
        purpose,
        byName: stockOutByName,
        byEmail: stockOutByEmail, // added email of the user who stocked out
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Stock-out failed" },
      { status: 500 },
    );
  }
}
