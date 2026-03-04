import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";

export const runtime = "nodejs";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

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

    const { searchParams } = new URL(req.url);
    const daysRaw = searchParams.get("days") ?? "30";
    const days = Math.min(365, Math.max(1, Number(daysRaw) || 30)); // clamp 1..365

    const now = new Date();
    const keys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      keys.push(dayKey(d));
    }

    // Batch gets
    const refs = keys.map((k) => adminDb.collection("analytics_daily").doc(k));
    const snaps = await adminDb.getAll(...refs);

    const out = snaps.map((s, idx) => ({
      id: keys[idx],
      ...(s.exists ? s.data() : {}),
    }));

    return NextResponse.json({ ok: true, data: out });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load daily analytics" },
      { status: 500 },
    );
  }
}
