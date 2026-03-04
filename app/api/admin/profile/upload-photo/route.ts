import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";

import { FieldValue } from "firebase-admin/firestore";
import { cloudinary } from "@/src/lib/cloudinaryAdmin";

export const runtime = "nodejs";

// IMPORTANT: Next App Router can read multipart via req.formData()
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (!file.type?.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const uid = decoded.uid;

    // Get existing admin doc (to destroy previous publicId if needed)
    const adminRef = adminDb.collection("admins").doc(uid);
    const snap = await adminRef.get();
    const prevPublicId = snap.exists
      ? (snap.data()?.photoPublicId as string | null)
      : null;

    // If previously you used random public ids, destroy them to avoid clutter.
    // If you always upload to the same deterministic public_id, destroying is optional.
    // We'll still destroy if prevPublicId exists AND it differs from our deterministic id.
    const deterministicPublicId = `profile-pictures/${uid}/avatar`;

    if (prevPublicId && prevPublicId !== deterministicPublicId) {
      try {
        await cloudinary.uploader.destroy(prevPublicId, { invalidate: true });
      } catch {
        // ignore cleanup errors
      }
    }

    // Convert File -> Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload using upload_stream so we can send buffer
    const uploadResult: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: deterministicPublicId,
          overwrite: true,
          invalidate: true,
          resource_type: "image",
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      stream.end(buffer);
    });

    const secureUrl = uploadResult.secure_url as string;
    const publicId = uploadResult.public_id as string;

    await adminRef.set(
      {
        photoURL: secureUrl,
        photoPublicId: publicId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({
      ok: true,
      secureUrl,
      publicId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Upload failed" },
      { status: 500 },
    );
  }
}
