"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import NextImage from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  SquareArrowRightExit,
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  UserCircle2,
} from "lucide-react";
import { Drawer, Spin } from "antd";
import { auth, db } from "@/src/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import AdminProfileDrawer from "./AdminProfileDrawer";
import { DEFAULT_ADMIN_AVATAR } from "@/src/constant";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  match?: "exact" | "prefix";
};

type AdminDoc = {
  uid?: string;
  email?: string | null;
  displayName?: string | null;
  role?: string | null;
  photoURL?: string | null;
  photoPublicId?: string | null;
};

function normalizePath(p: string) {
  if (!p) return "";
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

export default function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [admin, setAdmin] = useState<AdminDoc | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);

  const drawerWidth = useMemo(() => 280, []);
  const profileDrawerWidth = useMemo(() => 420, []);

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
    {
      label: "Admin Management",
      href: "/admin/register-admin",
      match: "prefix",
      icon: <Users className="w-4 h-4" />,
    },
  ];

  // close mobile sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Live sync admin profile
  useEffect(() => {
    let unsubDoc: null | (() => void) = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (!user) {
        setAdmin(null);
        setAdminLoading(false);
        return;
      }

      setAdminLoading(true);
      const ref = doc(db, "admins", user.uid);

      unsubDoc = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            setAdmin({
              uid: user.uid,
              email: user.email ?? null,
              displayName: user.displayName ?? null,
              photoURL: user.photoURL ?? null,
            });
            setAdminLoading(false);
            return;
          }

          setAdmin(snap.data() as AdminDoc);
          setAdminLoading(false);
        },
        () => setAdminLoading(false),
      );
    });

    return () => {
      if (unsubDoc) unsubDoc();
      unsubAuth();
    };
  }, []);

  const current = normalizePath(pathname);

  function isActive(item: NavItem) {
    const href = normalizePath(item.href);
    if (item.match === "exact") return current === href;
    return current === href || current.startsWith(href + "/");
  }

  const displayName = admin?.displayName?.trim() || "Admin";
  const email = admin?.email || "";
  const avatarSrc = admin?.photoURL || DEFAULT_ADMIN_AVATAR;

  const SidebarContent = (
    <div className="h-full flex flex-col bg-white">
      {/* BRAND */}
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
            <div className="text-xs text-gray-500">Inventory Panel</div>
          </div>
        </div>
      </div>

      {/* PROFILE HEADER (ONLY LG+) */}
      <div className="hidden lg:block px-5 py-4">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 transition text-left cursor-pointer"
        >
          <div className="relative w-11 h-11 rounded-full overflow-hidden border border-black/10 bg-white shrink-0">
            <NextImage
              src={avatarSrc}
              alt="Profile"
              fill
              sizes="44px"
              style={{ objectFit: "cover" }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-900 truncate">
              {adminLoading ? "Loading..." : displayName}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {adminLoading ? " " : email}
            </div>
          </div>

          {adminLoading ? <Spin size="small" /> : null}
        </button>
      </div>

      {/* NAV */}
      <nav className="p-3 space-y-1">
        {/* PROFILE PAGE LINK (ONLY <LG: tablets/mobile) */}
        <button
          onClick={() => router.push("/admin/profile")}
          className={[
            "lg:hidden w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition text-left",
            isActive({
              label: "Profile",
              href: "/admin/profile",
              match: "prefix",
              icon: null,
            } as any)
              ? "bg-primary/10 text-primary"
              : "hover:bg-black/5 text-gray-700",
          ].join(" ")}
        >
          <span
            className={[
              "grid place-items-center w-8 h-8 rounded-lg",
              current.startsWith("/admin/profile")
                ? "bg-primary/15"
                : "bg-black/5",
            ].join(" ")}
          >
            <UserCircle2 className="w-4 h-4" />
          </span>
          <span className="font-medium">My Profile</span>
        </button>

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

      {/* FOOTER */}
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

      {/* PROFILE DRAWER (ONLY USED ON LG+ because header is lg-only) */}
      <Drawer
        title="My Profile"
        placement="right"
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        size={profileDrawerWidth}
        destroyOnHidden
        styles={{ body: { padding: 0 } }}
      >
        <AdminProfileDrawer />
      </Drawer>
    </div>
  );

  return (
    <>
      {/* MOBILE TOP BAR */}
      <div className="lg:hidden p-3 border-b border-black/10 flex items-center justify-between bg-white sticky top-0 z-30">
        <div className="font-semibold">Stockify Admin</div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg border border-black/10 hover:bg-black/5 transition"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:block sticky top-0 h-screen w-70 shrink-0 border-r border-black/10 bg-white">
        {SidebarContent}
      </aside>

      {/* MOBILE SIDEBAR DRAWER */}
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
