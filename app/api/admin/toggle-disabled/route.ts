import { NextResponse } from "next/server";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length) return;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env vars");
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return "";
  return h.slice("Bearer ".length).trim();
}

export async function POST(req: Request) {
  try {
    initAdmin();

    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);

    //  only superadmin can disable/enable admins (recommended)
    const requesterIsSuper = Boolean((decoded as any).superadmin);
    if (!requesterIsSuper) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as { uid?: string; disabled?: boolean };
    const uid = (body.uid || "").trim();
    const disabled = Boolean(body.disabled);

    if (!uid) {
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    }

    //  prevent self-disable
    if (uid === decoded.uid) {
      return NextResponse.json(
        { error: "You cannot disable your own account." },
        { status: 400 },
      );
    }

    const db = getFirestore();

    // 1) Update Firestore admin profile
    await db.collection("admins").doc(uid).set({ disabled }, { merge: true });

    // 2) Disable the actual auth user (blocks sign-in)
    await getAuth().updateUser(uid, { disabled });

    return NextResponse.json({ ok: true, uid, disabled }, { status: 200 });
  } catch (e: any) {
    console.error("toggle-disabled error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
