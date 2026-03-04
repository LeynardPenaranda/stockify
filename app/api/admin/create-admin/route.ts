import { NextResponse } from "next/server";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

    // ✅ verify requester
    const token = getBearerToken(req);
    if (!token)
      return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(token);

    const isAdmin = Boolean(
      (decoded as any).admin || (decoded as any).superadmin,
    );
    if (!isAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // ✅ parse body
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
      photoURL?: string;
      role?: "admin" | "superadmin";
    };

    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const displayName = (body.displayName || "").trim();
    const photoURL = body.photoURL ?? null;

    if (!email)
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    if (!password || password.length < 6)
      return NextResponse.json({ error: "weak-password" }, { status: 400 });

    // ✅ only superadmin can create superadmin
    const requesterIsSuper = Boolean((decoded as any).superadmin);
    const requestedRole = (body.role ?? "admin") as "admin" | "superadmin";
    const role: "admin" | "superadmin" =
      requestedRole === "superadmin" && requesterIsSuper
        ? "superadmin"
        : "admin";

    // ✅ create user in Firebase Auth
    const user = await getAuth().createUser({
      email,
      password,
      displayName: displayName || undefined,
      photoURL: photoURL || undefined,
      disabled: false,
    });

    // ✅ set custom claims (important for your UI restrictions)
    // You can use either {admin:true} or role-based. We'll set both:
    const claims: any = { admin: true };
    if (role === "superadmin") claims.superadmin = true;

    await getAuth().setCustomUserClaims(user.uid, claims);

    // ✅ write admin profile in Firestore
    const db = getFirestore();

    await db
      .collection("admins")
      .doc(user.uid)
      .set(
        {
          uid: user.uid,
          email,
          displayName: displayName || null,
          photoURL: photoURL || null,
          role,
          disabled: false,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: decoded.uid,
          lastSignIn: null,
        },
        { merge: true },
      );

    return NextResponse.json(
      { ok: true, uid: user.uid, email, role },
      { status: 200 },
    );
  } catch (e: any) {
    console.error("create-admin error:", e);

    // common firebase-admin errors
    const msg = String(e?.message || "Server error");

    if (msg.includes("email-already-exists")) {
      return NextResponse.json(
        { error: "email-already-exists" },
        { status: 409 },
      );
    }
    if (msg.includes("auth/invalid-email")) {
      return NextResponse.json({ error: "invalid-email" }, { status: 400 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
