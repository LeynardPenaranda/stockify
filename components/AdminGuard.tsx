"use client";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/src/lib/firebase/client";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

function FullPageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white shadow-xl">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-xl border border-black/10 grid place-items-center">
              <Image
                src="/stockify-logo.png"
                alt="Stockify"
                width={34}
                height={34}
                priority
              />
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-900">
                Verifying Access
              </div>
              <div className="text-xs text-gray-500">
                Checking admin permissions
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="h-9 w-9 rounded-full border-4 border-black/10 border-t-primary animate-spin" />
            <div className="flex-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
                <div className="h-full w-1/2 bg-primary/20 animate-pulse" />
              </div>
              <div className="mt-2 text-[11px] text-gray-500">
                Please wait while we secure your session…
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-black/10 px-6 py-4">
          <div className="text-[11px] text-gray-400">Stockify Admin System</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  async function sendLoginEmailAlert(user: any) {
    try {
      const bearer = await user.getIdToken(); // Firebase ID token

      const actorName =
        user.displayName ||
        (typeof user.email === "string" ? user.email.split("@")[0] : "Admin");

      const actorEmail = user.email ?? "Unknown email";

      await fetch("/api/alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({
          type: "login",

          // IMPORTANT: add title so your email template won't show "undefined"
          title: "Admin Login Alert",

          // dedupe per minute per user (prevents multiple sends)
          dedupeKey: `${user.uid}:${new Date().toISOString().slice(0, 16)}`,

          actorName,
          actorEmail,

          // nicer message content
          message: `An admin signed in to Stockify.\n\nName: ${actorName}\nEmail: ${actorEmail}`,
        }),
      });
    } catch (err) {
      console.error("Failed to send login email alert:", err);
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAllowed(false);
        setReady(true);
        router.replace("/");
        return;
      }

      const token = await user.getIdTokenResult(true);
      const isAdmin = Boolean(token.claims.admin || token.claims.superadmin);

      setAllowed(isAdmin);
      setReady(true);

      if (!isAdmin) {
        await auth.signOut();
        router.replace("/");
        return;
      }

      // update last sign-in (Firestore)
      try {
        await setDoc(
          doc(db, "admins", user.uid),
          { lastSignIn: serverTimestamp() },
          { merge: true },
        );
      } catch (err) {
        console.error("Failed to update lastSignIn:", err);
      }

      // TRIGGER: email owner on admin login
      await sendLoginEmailAlert(user);
    });

    return () => unsub();
  }, [router]);

  if (!ready) return <FullPageLoader />;
  if (!allowed) return null;

  return <>{children}</>;
}
