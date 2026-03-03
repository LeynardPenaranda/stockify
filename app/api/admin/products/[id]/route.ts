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

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Product not found");
      const old = snap.data() as any;

      const patch: any = { updatedAt: new Date(), updatedBy: decoded.uid };

      if (body.name !== undefined) patch.name = String(body.name).trim();
      if (body.category !== undefined)
        patch.category = String(body.category).trim();
      if (body.quantity !== undefined) patch.quantity = Number(body.quantity);
      if (body.minStock !== undefined) patch.minStock = Number(body.minStock);
      if (body.expirationDate !== undefined)
        patch.expirationDate = body.expirationDate
          ? String(body.expirationDate)
          : null;

      // image replacement fields (from client after uploading new image)
      const newPublicId = body?.imagePublicId
        ? String(body.imagePublicId)
        : null;
      const newUrl = body?.imageUrl ? String(body.imageUrl) : null;
      const newFolder = body?.imageFolder ? String(body.imageFolder) : null;

      const isReplacingImage = Boolean(newPublicId && newUrl);

      // delete old image OUTSIDE tx? Cloudinary is external — do it before tx commit.
      // We’ll do it right here, but ONLY if we are replacing and old exists.
      if (
        isReplacingImage &&
        old?.imagePublicId &&
        old.imagePublicId !== newPublicId
      ) {
        await cloudinary.uploader.destroy(old.imagePublicId);
      }

      if (isReplacingImage) {
        patch.imagePublicId = newPublicId;
        patch.imageUrl = newUrl;
        patch.imageFolder = newFolder ?? old?.imageFolder ?? null;
      }

      tx.update(ref, patch);

      tx.create(adminDb.collection("analytics_events").doc(), {
        type: "product_update",
        productId: id,
        at: new Date(),
        by: decoded.uid,
      });

      await recalcDashboardAnalyticsTx(tx);
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

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;

      const p = snap.data() as any;

      // delete image (external) — same caveat as above; acceptable for most admin apps
      if (p?.imagePublicId) {
        await cloudinary.uploader.destroy(p.imagePublicId);
      }

      tx.delete(ref);

      tx.create(adminDb.collection("analytics_events").doc(), {
        type: "product_delete",
        productId: id,
        deltaQuantity: -Number(p?.quantity ?? 0),
        at: new Date(),
        by: decoded.uid,
      });

      await recalcDashboardAnalyticsTx(tx);
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Delete failed" },
      { status: 500 },
    );
  }
}
