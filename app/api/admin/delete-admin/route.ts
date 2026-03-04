import { NextResponse } from "next/server";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

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

    //  verify requester
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);

    //  only superadmin can delete admins (recommended)
    const requesterIsSuper = Boolean((decoded as any).superadmin);
    if (!requesterIsSuper) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as { uid?: string };
    const uid = (body.uid || "").trim();

    if (!uid) {
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    }

    //  prevent self-delete
    if (uid === decoded.uid) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 },
      );
    }

    const db = getFirestore();

    // 1) delete Firestore profile
    await db.collection("admins").doc(uid).delete();

    // 2) delete Auth user
    await getAuth().deleteUser(uid);

    return NextResponse.json({ ok: true, uid }, { status: 200 });
  } catch (e: any) {
    console.error("delete-admin error:", e);

    const msg = String(e?.message || "Server error");

    // if auth user doesn't exist anymore, still delete Firestore doc is ok
    if (msg.includes("auth/user-not-found")) {
      return NextResponse.json(
        { ok: true, note: "User not found in Auth" },
        { status: 200 },
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
