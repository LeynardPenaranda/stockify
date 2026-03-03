"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import Image from "next/image";

function Overlay({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="fixed inset-0 z-9999 flex h-screen w-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white shadow-xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-xl border border-black/10 bg-white grid place-items-center">
              <Image
                src="/stockify-logo.png"
                alt="Stockify"
                width={34}
                height={34}
                priority
              />
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 leading-tight">
                {title}
              </div>
              <div className="text-xs text-gray-500 leading-tight">
                {subtitle}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full border-4 border-black/10 border-t-primary animate-spin" />
            <div className="flex-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
                <div className="h-full w-1/2 bg-primary/20 animate-pulse" />
              </div>
              <div className="mt-2 text-[11px] text-gray-500">
                Securing your session…
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-black/10 px-6 py-4">
          <div className="text-[11px] text-gray-400">
            Please don’t close this tab.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthRedirect() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const shouldRedirect = useMemo(() => {
    if (loading) return false;
    return Boolean(user && isAdmin && pathname === "/");
  }, [user, isAdmin, pathname, loading]);

  useEffect(() => {
    if (!shouldRedirect) return;
    router.replace("/admin");
  }, [shouldRedirect, router]);

  if (loading) {
    return (
      <Overlay
        title="Checking session…"
        subtitle="Verifying your admin access"
      />
    );
  }

  if (shouldRedirect) {
    return (
      <Overlay
        title="Redirecting…"
        subtitle="Taking you to the Stockify dashboard"
      />
    );
  }

  return null;
}
