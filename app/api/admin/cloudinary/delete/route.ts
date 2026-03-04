// app/api/admin/products/delete/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { cloudinary } from "@/src/lib/cloudinaryAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type Body = { productId: string };

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
    if (!productId)
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });

    const productRef = adminDb.collection("products").doc(productId);
    const productAnalyticsRef = adminDb
      .collection("analytics_products")
      .doc(productId);
    const globalDashRef = adminDb
      .collection("dashboard_analytics")
      .doc("global");
    const eventRef = adminDb.collection("analytics_events").doc();

    // Read product first to get quantity/minStock/publicId
    const snap = await productRef.get();
    if (!snap.exists)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const product = snap.data() as any;

    const quantity = Number(product?.quantity ?? 0);
    const minStock = Number(product?.minStock ?? 0);
    const imagePublicId = product?.imagePublicId
      ? String(product.imagePublicId)
      : null;

    const stockStatus =
      quantity <= 0
        ? "out_of_stock"
        : quantity <= minStock
          ? "low_stock"
          : "ok";

    const now = new Date();

    // Firestore transaction (NO cloudinary calls here)
    await adminDb.runTransaction(async (tx) => {
      tx.delete(productRef);
      tx.delete(productAnalyticsRef);

      tx.create(eventRef, {
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

    // Delete Cloudinary image AFTER Firestore transaction
    if (imagePublicId) {
      try {
        await cloudinary.uploader.destroy(imagePublicId);
      } catch (err: any) {
        // optional fallback: queue a cleanup task
        await adminDb.collection("cleanup_tasks").add({
          type: "cloudinary_destroy",
          publicId: imagePublicId,
          productId,
          error: String(err?.message || err),
          createdAt: now,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Delete failed" },
      { status: 500 },
    );
  }
}
