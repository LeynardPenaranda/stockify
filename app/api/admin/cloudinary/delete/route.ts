import { NextResponse } from "next/server";
import { adminAuth } from "@/src/lib/firebase/admin";
import { cloudinary } from "@/src/lib/cloudinaryAdmin";

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

    const { publicId } = await req.json();
    if (!publicId)
      return NextResponse.json({ error: "Missing publicId" }, { status: 400 });

    const r = await cloudinary.uploader.destroy(publicId);
    return NextResponse.json({ ok: true, result: r });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Delete failed" },
      { status: 500 },
    );
  }
}
