"use client";

import AdminGuard from "@/components/AdminGuard";
import AdminSidebar from "@/components/AdminSidebar";
import LowStockGlobalAlert from "@/components/LowStockGlobalAlert";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <LowStockGlobalAlert />

      <div className="min-h-screen bg-white">
        <div className="flex flex-col lg:flex-row min-h-screen">
          <AdminSidebar />
          <main className="flex-1 min-w-0 lg:overflow-y-auto">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
