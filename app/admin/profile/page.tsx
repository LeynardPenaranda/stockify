"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spin } from "antd";
import AdminProfileDrawer from "@/components/AdminProfileDrawer";

export default function AdminProfilePage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");

    const handle = (e?: MediaQueryListEvent) => {
      const matches = e ? e.matches : mq.matches;

      if (matches) {
        // Laptop / Desktop → redirect
        router.replace("/admin");
        return;
      }

      // Tablet / Mobile → allow page
      setOk(true);
    };

    handle();

    mq.addEventListener("change", handle);

    return () => {
      mq.removeEventListener("change", handle);
    };
  }, [router]);

  if (!ok) {
    return (
      <div className="w-full flex items-center justify-center py-10">
        <Spin />
      </div>
    );
  }

  return <AdminProfileDrawer />;
}
