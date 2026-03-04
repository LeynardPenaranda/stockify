import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type Body = {
  displayName: string;
};

export async function POST(req: Request) {
  try {
    // auth header
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    // verify token
    const decoded = await adminAuth.verifyIdToken(idToken);

    // you can allow any logged-in admin doc user to update own name:
    const uid = decoded.uid;

    const body = (await req.json()) as Body;

    const name = (body?.displayName || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.length > 60) {
      return NextResponse.json({ error: "Max 60 characters" }, { status: 400 });
    }

    // update Firestore
    const ref = adminDb.collection("admins").doc(uid);

    // optional: check doc exists
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Admin profile not found" },
        { status: 404 },
      );
    }

    await ref.set(
      {
        displayName: name,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}
