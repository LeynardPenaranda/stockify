"use client";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/lib/firebase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

function FullPageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white shadow-xl">
        <div className="p-6">
          {/* Header */}
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

          {/* Spinner + Progress */}
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

        {/* Footer */}
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAllowed(false);
        setReady(true);
        router.replace("/");
        return;
      }

      const token = await user.getIdTokenResult(true);
      const isAdmin = Boolean(token.claims.admin);

      setAllowed(isAdmin);
      setReady(true);

      if (!isAdmin) {
        await auth.signOut();
        router.replace("/");
      }
    });

    return () => unsub();
  }, [router]);

  if (!ready) return <FullPageLoader />;
  if (!allowed) return null;

  return <>{children}</>;
}
