import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(
    /\\n/g,
    "\n",
  );

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const adminApp = initAdmin();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
