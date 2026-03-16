"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import NextImage from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  UserCircle2,
  Power,
  User,
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

  const router = useRouter();
  const pathname = usePathname() || "";

  const drawerSize = "min(300px, 88vw)";
  const profileDrawerSize = "min(420px, 100vw)";

  async function onLogout() {
    await auth.signOut();
    window.location.href = "/";
  }

  function handleProfileClick() {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches
    ) {
      setProfileOpen(true);
      return;
    }

    setOpen(false);
    router.push("/admin/profile");
  }

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/admin",
      match: "exact",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      label: "Products Inventory",
      href: "/admin/products",
      match: "prefix",
      icon: <Boxes className="h-5 w-5" />,
    },
    {
      label: "Stock In Monitoring",
      href: "/admin/stock-in",
      match: "prefix",
      icon: <ArrowDownToLine className="h-5 w-5" />,
    },
    {
      label: "Stock Out Monitoring",
      href: "/admin/stock-out",
      match: "prefix",
      icon: <ArrowUpFromLine className="h-5 w-5" />,
    },
    {
      label: "Admin Management",
      href: "/admin/register-admin",
      match: "prefix",
      icon: <Users className="h-5 w-5" />,
    },
  ];

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
    <div className="flex h-full flex-col overflow-hidden bg-[#17335e] text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-[#214a86] ring-1 ring-white/10">
            <Image
              src="/stockify-logo.png"
              alt="Stockify Logo"
              width={60}
              height={60}
              className="object-contain"
              priority
            />
          </div>

          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-wide text-white">
              Stockify
            </div>
            <div className="text-sm text-white/75">Inventory Panel</div>
          </div>
        </div>
      </div>

      <div className="border-b border-white/10 bg-white/5 px-5 py-5">
        <button
          type="button"
          onClick={handleProfileClick}
          className="flex w-full items-center gap-3 rounded-2xl text-left transition hover:bg-white/5"
        >
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-white/20 bg-white/10">
            <NextImage
              src={avatarSrc}
              alt="Profile"
              fill
              sizes="56px"
              style={{ objectFit: "cover", background: "white" }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold text-white">
              {adminLoading ? "Loading..." : displayName}
            </div>
            <div className="truncate text-sm text-white/75">
              {adminLoading ? "" : email}
            </div>
          </div>

          {adminLoading ? (
            <div className="shrink-0">
              <Spin size="small" />
            </div>
          ) : null}
        </button>
      </div>

      <nav className="px-0 py-3">
        <button
          onClick={() => {
            setOpen(false);
            router.push("/admin/profile");
          }}
          className={[
            "relative flex w-full items-center gap-3 px-6 py-4 text-left transition lg:hidden",
            current.startsWith("/admin/profile")
              ? "bg-[#2b4f7d] text-white"
              : "text-white/85 hover:bg-white/5",
          ].join(" ")}
        >
          {current.startsWith("/admin/profile") ? (
            <span className="absolute left-0 top-0 h-full w-1 rounded-r-full bg-[#22d3ee]" />
          ) : null}

          <span
            className={[
              "grid h-9 w-9 place-items-center rounded-xl",
              current.startsWith("/admin/profile")
                ? "bg-white/20 text-[#c8f8ff]"
                : "bg-white/10 text-white/90",
            ].join(" ")}
          >
            <UserCircle2 className="h-5 w-5" />
          </span>

          <span className="text-[15px] font-medium">My Profile</span>
        </button>

        {navItems.map((item) => {
          const active = isActive(item);

          return (
            <button
              key={item.href}
              onClick={() => {
                setOpen(false);
                router.push(item.href);
              }}
              className={[
                "relative flex w-full items-center gap-3 px-6 py-4 text-left transition",
                active
                  ? "bg-[#2b4f7d] text-white"
                  : "text-white/85 hover:bg-white/5",
              ].join(" ")}
            >
              {active ? (
                <span className="absolute left-0 top-0 h-full w-1 rounded-r-full bg-[#22d3ee]" />
              ) : null}

              <span
                className={[
                  "grid h-9 w-9 place-items-center rounded-xl",
                  active
                    ? "bg-white/20 text-[#c8f8ff]"
                    : "bg-white/10 text-white/90",
                ].join(" ")}
              >
                {item.icon}
              </span>

              <span className="text-[15px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 bg-[#102a4d] p-4">
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-between rounded-2xl bg-[#0f4a78] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 cursor-pointer"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#12b6c8] text-white">
            <User className="h-5 w-5" />
          </span>

          <div className="flex items-center gap-3">
            <span className="text-base">Logout</span>
          </div>

          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#12b6c8] text-white">
            <Power className="h-5 w-5" />
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-black/10 bg-[#17335e] px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[#214a86]">
            <Image
              src="/stockify-logo.png"
              alt="Stockify Logo"
              width={20}
              height={20}
              className="object-contain"
              priority
            />
          </div>
          <div className="font-semibold">Stockify Admin</div>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="rounded-xl border border-white/15 bg-white/10 p-2 transition hover:bg-white/15"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <aside className="sticky top-0 hidden h-screen w-75 shrink-0 border-r border-[#264b7d] bg-[#17335e] lg:block">
        {SidebarContent}
      </aside>

      <Drawer
        title={null}
        placement="left"
        open={open}
        onClose={() => setOpen(false)}
        size={drawerSize}
        destroyOnHidden
        closable={false}
        styles={{
          body: { padding: 0, background: "#17335e" },
          header: { display: "none" },
        }}
      >
        {SidebarContent}
      </Drawer>

      <Drawer
        title="My Profile"
        placement="right"
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        size={profileDrawerSize}
        destroyOnHidden
        styles={{ body: { padding: 0 } }}
      >
        <AdminProfileDrawer />
      </Drawer>
    </>
  );
}
