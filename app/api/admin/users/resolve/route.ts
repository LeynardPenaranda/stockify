import { NextResponse } from "next/server";
import { adminAuth } from "@/src/lib/firebase/admin";

export const runtime = "nodejs";

type Body = {
  uids: string[];
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
    const uids = Array.isArray(body?.uids)
      ? body.uids.map((x) => String(x).trim()).filter(Boolean)
      : [];

    if (uids.length === 0) return NextResponse.json({ ok: true, users: {} });

    // Firebase Admin supports up to 1000 identifiers per call
    const res = await adminAuth.getUsers(uids.map((uid) => ({ uid })));

    const users: Record<string, { name: string; email: string }> = {};
    for (const u of res.users) {
      const email = (u.email || "").trim();
      const name = (u.displayName || "").trim() || email || "Unknown";
      users[u.uid] = { name, email };
    }

    return NextResponse.json({ ok: true, users });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Resolve users failed" },
      { status: 500 },
    );
  }
}
