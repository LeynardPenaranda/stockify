import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";

export const runtime = "nodejs";

async function requireSuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/);

  if (!match) {
    return {
      ok: false as const,
      status: 401,
      error: "Missing Authorization token",
    };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);

    //  superadmin only
    if (!decoded?.superadmin) {
      return {
        ok: false as const,
        status: 403,
        error: "Forbidden: superadmin only",
      };
    }

    return { ok: true as const, decoded };
  } catch (e: any) {
    return {
      ok: false as const,
      status: 401,
      error: e?.message ?? "Invalid token",
    };
  }
}

async function deleteAllDocsInCollection(
  collectionPath: string,
  batchSize = 500,
) {
  let deleted = 0;

  while (true) {
    const snap = await adminDb
      .collection(collectionPath)
      .limit(batchSize)
      .get();
    if (snap.empty) break;

    const batch = adminDb.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);

    await batch.commit();
    deleted += snap.size;
  }

  return deleted;
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  try {
    //  IMPORTANT: dashboard events card reads from "analytics_events"
    const deleted = await deleteAllDocsInCollection("analytics_events");

    return NextResponse.json({ ok: true, deleted }, { status: 200 });
  } catch (e: any) {
    console.error("delete-all-events error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to delete events" },
      { status: 500 },
    );
  }
}
