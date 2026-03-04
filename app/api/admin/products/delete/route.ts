import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { cloudinary } from "@/src/lib/cloudinaryAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type Body = { productId: string };

function safeNum(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function POST(req: Request) {
  const now = new Date();

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
    if (!productId)
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });

    const productRef = adminDb.collection("products").doc(productId);
    const productAnalyticsRef = adminDb
      .collection("analytics_products")
      .doc(productId);
    const globalDashRef = adminDb
      .collection("dashboard_analytics")
      .doc("global");

    // Read product first
    const snap = await productRef.get();
    if (!snap.exists)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const product = snap.data() as any;

    const quantity = safeNum(product?.quantity);
    const minStock = safeNum(product?.minStock);

    const imagePublicId = product?.imagePublicId
      ? String(product.imagePublicId)
      : null;

    // If you store folder like: stockify/products/<productId>
    const imageFolder = product?.imageFolder
      ? String(product.imageFolder)
      : `stockify/products/${productId}`;

    const stockStatus =
      quantity <= 0
        ? "out_of_stock"
        : quantity <= minStock
          ? "low_stock"
          : "ok";

    // OPTIONAL: delete logs too (recommended if you truly want “everything removed”)
    // NOTE: These are not inside the transaction (queries are not allowed in tx writes).
    // If you don’t want to delete logs, remove these blocks.
    const stockInLogsSnap = await adminDb
      .collection("stock_in_logs")
      .where("productId", "==", productId)
      .get();

    const stockOutLogsSnap = await adminDb
      .collection("stock_out_logs")
      .where("productId", "==", productId)
      .get();

    // OPTIONAL: delete analytics events for this product (history). If you want to keep history, skip this.
    const eventsSnap = await adminDb
      .collection("analytics_events")
      .where("productId", "==", productId)
      .get();

    // Prepare refs for deletion outside tx (batched)
    const extraRefsToDelete = [
      ...stockInLogsSnap.docs.map((d) => d.ref),
      ...stockOutLogsSnap.docs.map((d) => d.ref),
      ...eventsSnap.docs.map((d) => d.ref),
    ];

    // Create a new “delete event” (you can keep this even if you delete old events)
    const deleteEventRef = adminDb.collection("analytics_events").doc();

    // 1) Transaction: delete product + analytics_products + update global counters + write delete event
    await adminDb.runTransaction(async (tx) => {
      tx.delete(productRef);
      tx.delete(productAnalyticsRef);

      tx.create(deleteEventRef, {
        type: "product_delete",
        productId,
        deltaQuantity: -quantity,
        at: now,
        by: decoded.uid,
      });

      tx.set(
        globalDashRef,
        {
          totalProducts: FieldValue.increment(-1),
          totalStockQty: FieldValue.increment(-quantity),
          lowStockCount: FieldValue.increment(
            stockStatus === "low_stock" ? -1 : 0,
          ),
          outOfStockCount: FieldValue.increment(
            stockStatus === "out_of_stock" ? -1 : 0,
          ),
          updatedAt: now,
          lastEventAt: now,
          lastEventType: "product_delete",
          lastEventBy: decoded.uid,
        },
        { merge: true },
      );
    });

    // 2) Delete related logs/events in batches (outside transaction)
    // (Firestore batch limit is 500 ops; chunk it)
    const CHUNK = 450;
    for (let i = 0; i < extraRefsToDelete.length; i += CHUNK) {
      const batch = adminDb.batch();
      extraRefsToDelete.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    // 3) Cloudinary cleanup AFTER Firestore work:
    // - delete the main imagePublicId (if any)
    // - delete everything under folder prefix
    // - delete the folder itself
    try {
      if (imagePublicId) {
        await cloudinary.uploader.destroy(imagePublicId);
      }

      if (imageFolder) {
        // Delete all assets under that folder (prefix)
        await cloudinary.api.delete_resources_by_prefix(imageFolder);
        // Then remove folder
        await cloudinary.api.delete_folder(imageFolder);
      }
    } catch (err: any) {
      // Fallback: queue cleanup task if Cloudinary fails
      await adminDb.collection("cleanup_tasks").add({
        type: "cloudinary_delete_product_assets",
        productId,
        imagePublicId,
        imageFolder,
        error: String(err?.message || err),
        createdAt: now,
      });
    }

    return NextResponse.json({
      ok: true,
      deleted: {
        productId,
        analyticsDeleted: true,
        logsDeleted: extraRefsToDelete.length,
        cloudinaryFolder: imageFolder,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Delete failed" },
      { status: 500 },
    );
  }
}
