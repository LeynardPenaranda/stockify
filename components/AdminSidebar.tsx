"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  SquareArrowRightExit,
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { Drawer } from "antd";
import { auth } from "@/src/lib/firebase/client";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  match?: "exact" | "prefix";
};

export default function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const drawerWidth = useMemo(() => 280, []);
  const router = useRouter();
  const pathname = usePathname() || "";

  async function onLogout() {
    await auth.signOut();
    window.location.href = "/";
  }

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/admin",
      match: "exact",
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      label: "Products Inventory",
      href: "/admin/products",
      match: "prefix",
      icon: <Boxes className="w-4 h-4" />,
    },
    {
      label: "Stock In Monitoring",
      href: "/admin/stock-in",
      match: "prefix",
      icon: <ArrowDownToLine className="w-4 h-4" />,
    },
    {
      label: "Stock Out Monitoring",
      href: "/admin/stock-out",
      match: "prefix",
      icon: <ArrowUpFromLine className="w-4 h-4" />,
    },
  ];

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function normalizePath(p: string) {
    if (!p) return "";
    if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
    return p;
  }

  const current = normalizePath(pathname);

  function isActive(item: NavItem) {
    const href = normalizePath(item.href);
    if (item.match === "exact") return current === href;
    return current === href || current.startsWith(href + "/");
  }

  const SidebarContent = (
    <div className="h-full flex flex-col bg-white">
      <div className="px-5 py-5 border-b border-black/10">
        <div className="flex items-center gap-3">
          <Image
            src="/stockify-logo.png"
            alt="Stockify Logo"
            width={44}
            height={44}
            className="rounded-xl"
            priority
          />
          <div className="leading-tight">
            <div className="text-sm font-bold text-gray-900">Stockify</div>
            <div className="text-xs text-gray-500">Admin Panel</div>
          </div>
        </div>
      </div>

      <nav className="p-3 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={[
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition text-left",
                active
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-black/5 text-gray-700",
              ].join(" ")}
            >
              <span
                className={[
                  "grid place-items-center w-8 h-8 rounded-lg",
                  active ? "bg-primary/15" : "bg-black/5",
                ].join(" ")}
              >
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="p-3 border-t border-black/10">
        <button
          onClick={onLogout}
          className="w-full inline-flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-white bg-primary hover:opacity-95 transition cursor-pointer"
        >
          <span className="font-medium">Logout</span>
          <SquareArrowRightExit className="w-5 h-5" />
        </button>

        <div className="px-3 pt-3 text-[11px] text-black/35">
          © {new Date().getFullYear()} Stockify
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden p-3 border-b border-black/10 flex items-center justify-between bg-white sticky top-0 z-30">
        <div className="font-semibold">Stockify Admin</div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg border border-black/10 hover:bg-black/5 transition"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <aside className="hidden lg:block sticky top-0 h-screen w-70 shrink-0 border-r border-black/10 bg-white">
        {SidebarContent}
      </aside>

      <Drawer
        title={null}
        placement="left"
        open={open}
        onClose={() => setOpen(false)}
        size={drawerWidth}
        destroyOnHidden
        styles={{ body: { padding: 0 } }}
      >
        {SidebarContent}
      </Drawer>
    </>
  );
}
