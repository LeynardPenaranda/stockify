import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!idToken)
      return NextResponse.json(
        { ok: false, error: "Missing token" },
        { status: 401 },
      );

    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.admin)
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );

    const snap = await adminDb
      .collection("dashboard_analytics")
      .doc("global")
      .get();

    const data = snap.exists ? snap.data() : null;

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load global analytics" },
      { status: 500 },
    );
  }
}
