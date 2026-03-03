#!/usr/bin/env node
import "dotenv/config";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing FIREBASE_ADMIN_* env vars. Check your .env.local");
    process.exit(1);
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

initAdmin();

const auth = getAuth();
const db = getFirestore();

async function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

async function main() {
  const email = await getArg("email");
  const password = await getArg("password");
  const displayName = (await getArg("name")) ?? "Super Admin";

  if (!email) {
    console.error('Usage: node scripts/create-superadmin.mjs --email "leynardlove@email.com" --password "admin123" --name "Leynard Penaranda"');
    process.exit(1);
  }

  let userRecord;

  // 1) Find or create user
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`Found existing user: ${userRecord.uid}`);
  } catch (e) {
    if (!password) {
      console.error('User not found. Provide --password to create a new user.');
      process.exit(1);
    }

    userRecord = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true, // optional, you can set false if you prefer
    });

    console.log(`Created user: ${userRecord.uid}`);
  }

  const uid = userRecord.uid;

  // 2) Set claims
  const claims = { admin: true, superadmin: true };
  await auth.setCustomUserClaims(uid, claims);
  console.log("Set custom claims:", claims);

  // 3) Create/update Firestore doc (optional but recommended)
  const ref = db.collection("admins").doc(uid);

  await ref.set(
    {
      uid,
      email,
      displayName: userRecord.displayName ?? displayName,
      role: "superadmin",
      isAdmin: true,
      isSuperAdmin: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(), // only used on first create (see merge below)
    },
    { merge: true },
  );

  console.log(`Upserted Firestore doc: admins/${uid}`);

  // 4) Helpful note: claims need token refresh
  console.log("\nDone ✅");
  console.log("Note: If you're already logged in on the client, sign out and sign in again (or refresh token) to get new claims.");
}

main().catch((err) => {
  console.error("Failed:", err?.message || err);
  process.exit(1);
});