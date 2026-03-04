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

  // fix multiline key
  privateKey = privateKey.replace(/\\n/g, "\n");

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export async function GET(req: Request) {
  try {
    initAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);

    // Optional: enforce admin claim
    const isAdmin = Boolean(
      (decoded as any).admin || (decoded as any).superadmin,
    );
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snap = await getFirestore()
      .collection("admins")
      .orderBy("createdAt", "desc")
      .get();

    const admins = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        uid: data.uid ?? d.id,
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        photoURL: data.photoURL ?? null,
        disabled: Boolean(data.disabled),
        role: (data.role ?? "admin") as "admin" | "superadmin",
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
        lastSignIn: data.lastSignIn?.toDate?.()?.toISOString?.() ?? null,
      };
    });

    return NextResponse.json({ admins }, { status: 200 });
  } catch (e: any) {
    console.error("list-admins error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
