import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { recalcDashboardAnalyticsTx } from "@/src/server/updateDashboardAnalytics";

export const runtime = "nodejs";

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

    const ref = adminDb.collection("products").doc();

    await adminDb.runTransaction(async (tx) => {
      tx.set(ref, {
        name,
        category,
        quantity,
        minStock,
        expirationDate,
        imageUrl,
        imagePublicId,
        imageFolder,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: decoded.uid,
        updatedBy: decoded.uid,
      });

      tx.create(adminDb.collection("analytics_events").doc(), {
        type: "product_create",
        productId: ref.id,
        deltaQuantity: quantity,
        at: new Date(),
        by: decoded.uid,
      });

      await recalcDashboardAnalyticsTx(tx);
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Create failed" },
      { status: 500 },
    );
  }
}
