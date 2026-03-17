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
    const nextQuantity =
      body.quantity !== undefined ? Number(body.quantity) : undefined;
    const nextMinStock =
      body.minStock !== undefined ? Number(body.minStock) : undefined;
    const nextMaxStock =
      body.maxStock !== undefined ? Number(body.maxStock) : undefined;

    if (
      nextQuantity !== undefined &&
      (!Number.isFinite(nextQuantity) || nextQuantity < 0)
    ) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }

    if (
      nextMinStock !== undefined &&
      (!Number.isFinite(nextMinStock) || nextMinStock < 0)
    ) {
      return NextResponse.json({ error: "Invalid minStock" }, { status: 400 });
    }

    if (
      nextMaxStock !== undefined &&
      (!Number.isFinite(nextMaxStock) || nextMaxStock < 0)
    ) {
      return NextResponse.json({ error: "Invalid maxStock" }, { status: 400 });
    }

    const ref = adminDb.collection("products").doc(id);
    const analyticsRef = adminDb.collection("analytics_products").doc(id);

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
      const patch: Record<string, unknown> = {
        updatedAt: now,
        updatedBy: decoded.uid,
      };
      const analyticsPatch: Record<string, unknown> = {
        updatedAt: now,
        lastEventAt: now,
        lastEventType: "product_update",
        lastEventBy: decoded.uid,
      };

      if (body.name !== undefined) patch.name = String(body.name).trim();
      if (body.name !== undefined) analyticsPatch.name = String(body.name).trim();
      if (body.category !== undefined)
        patch.category = String(body.category).trim();
      if (body.category !== undefined)
        analyticsPatch.category = String(body.category).trim();
      if (nextQuantity !== undefined) {
        patch.quantity = nextQuantity;
        analyticsPatch.quantity = nextQuantity;
      }
      if (nextMinStock !== undefined) {
        patch.minStock = nextMinStock;
        analyticsPatch.minStock = nextMinStock;
      }
      if (nextMaxStock !== undefined) {
        patch.maxStock = nextMaxStock;
        analyticsPatch.maxStock = nextMaxStock;
      }

      if (body.expirationDate !== undefined)
        patch.expirationDate = body.expirationDate
          ? String(body.expirationDate)
          : null;
      if (body.expirationDate !== undefined)
        analyticsPatch.expirationDate = body.expirationDate
          ? String(body.expirationDate)
          : null;

      // Supplier support
      if (body.supplier !== undefined) {
        const s = String(body.supplier ?? "").trim();
        patch.supplier = s ? s : null;
        analyticsPatch.supplier = s ? s : null;
      }

      // Image patch
      if (isReplacingImage) {
        patch.imagePublicId = newPublicId;
        patch.imageUrl = newUrl;
        patch.imageFolder = newFolder ?? old?.imageFolder ?? null;
        analyticsPatch.imagePublicId = newPublicId;
        analyticsPatch.imageUrl = newUrl;
        analyticsPatch.imageFolder = newFolder ?? old?.imageFolder ?? null;
      }

      // WRITES AFTER ALL READS
      tx.update(ref, patch);
      tx.set(analyticsRef, analyticsPatch, { merge: true });

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
