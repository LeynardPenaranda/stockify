import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { cloudinary } from "@/src/lib/cloudinaryAdmin";
import { recalcDashboardAnalyticsTx } from "@/src/server/updateDashboardAnalytics";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;

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

    const ref = adminDb.collection("products").doc(id);

    // Read OUTSIDE tx if you need old image id for Cloudinary
    const snapOutside = await ref.get();
    if (!snapOutside.exists)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const old = snapOutside.data() as any;

    // image replacement fields
    const newPublicId = body?.imagePublicId ? String(body.imagePublicId) : null;
    const newUrl = body?.imageUrl ? String(body.imageUrl) : null;
    const newFolder = body?.imageFolder ? String(body.imageFolder) : null;

    const isReplacingImage = Boolean(newPublicId && newUrl);

    // Delete old image OUTSIDE transaction (external side-effect)
    if (
      isReplacingImage &&
      old?.imagePublicId &&
      old.imagePublicId !== newPublicId
    ) {
      await cloudinary.uploader.destroy(old.imagePublicId);
    }

    const now = new Date();

    await adminDb.runTransaction(async (tx) => {
      // READS FIRST
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Product not found");

      // IMPORTANT: if this function reads anything, it must happen BEFORE writes
      await recalcDashboardAnalyticsTx(tx);

      // Prepare patch
      const patch: any = { updatedAt: now, updatedBy: decoded.uid };

      if (body.name !== undefined) patch.name = String(body.name).trim();
      if (body.category !== undefined)
        patch.category = String(body.category).trim();
      if (body.quantity !== undefined) patch.quantity = Number(body.quantity);
      if (body.minStock !== undefined) patch.minStock = Number(body.minStock);

      if (body.expirationDate !== undefined)
        patch.expirationDate = body.expirationDate
          ? String(body.expirationDate)
          : null;

      // Supplier support
      if (body.supplier !== undefined) {
        const s = String(body.supplier ?? "").trim();
        patch.supplier = s ? s : null;
      }

      // Image patch
      if (isReplacingImage) {
        patch.imagePublicId = newPublicId;
        patch.imageUrl = newUrl;
        patch.imageFolder = newFolder ?? old?.imageFolder ?? null;
      }

      // WRITES AFTER ALL READS
      tx.update(ref, patch);

      tx.create(adminDb.collection("analytics_events").doc(), {
        type: "product_update",
        productId: id,
        productName: body.name || old?.name, // Added product name in event
        at: now,
        by: decoded.uid,
        byEmail: decoded.email, // Added email of the user who updated the product
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Update failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;

    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    if (!idToken)
      return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.admin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const ref = adminDb.collection("products").doc(id);

    // Read outside tx for Cloudinary (external)
    const snapOutside = await ref.get();
    if (!snapOutside.exists) return NextResponse.json({ ok: true });

    const p = snapOutside.data() as any;

    // delete image outside tx
    if (p?.imagePublicId) {
      await cloudinary.uploader.destroy(p.imagePublicId);
    }

    const now = new Date();

    await adminDb.runTransaction(async (tx) => {
      // READS FIRST
      const snap = await tx.get(ref);
      if (!snap.exists) return;

      // If recalc reads data, keep it before writes
      await recalcDashboardAnalyticsTx(tx);

      // WRITES
      tx.delete(ref);

      tx.create(adminDb.collection("analytics_events").doc(), {
        type: "product_delete",
        productId: id,
        productName: p?.name || "Unknown Product", // Added product name in event
        deltaQuantity: -Number(p?.quantity ?? 0),
        at: now,
        by: decoded.uid,
        byEmail: decoded.email, // Added email of the user who deleted the product
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Delete failed" },
      { status: 500 },
    );
  }
}
