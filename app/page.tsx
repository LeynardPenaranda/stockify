"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./providers";
import AdminLoginCard from "@/components/AdminLoginCard";

function FullscreenOverlay({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-9999 flex h-screen w-screen items-center justify-center bg-white px-4">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/80 px-8 py-6 shadow-xl border border-black/10">
        <div className="h-10 w-10 rounded-full border-4 border-black/10 border-t-primary animate-spin" />
        <div className="text-sm font-semibold text-gray-900">{label}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAdmin, loading } = useAuth();

  const authStillDeciding = loading || (user && isAdmin === null);

  const shouldRedirect = useMemo(() => {
    if (authStillDeciding) return false;
    return Boolean(user && isAdmin === true && pathname === "/");
  }, [authStillDeciding, user, isAdmin, pathname]);

  useEffect(() => {
    if (!shouldRedirect) return;
    router.replace("/admin");
  }, [shouldRedirect, router]);

  if (authStillDeciding)
    return <FullscreenOverlay label="Checking session..." />;
  if (shouldRedirect) return <FullscreenOverlay label="Redirecting..." />;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <AdminLoginCard onSuccess={() => router.replace("/admin")} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-xl border border-black/10 text-center">
        <div className="h-10 w-10 rounded-full border-4 border-black/10 border-t-primary animate-spin" />
        <div>
          <div className="text-sm font-semibold text-gray-900">
            Please wait...
          </div>
          <div className="mt-1 text-xs text-gray-500">
            You’re being redirected to the admin dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}
