"use client";

import React, { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/src/lib/firebase/client";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";

import { DEFAULT_ADMIN_AVATAR } from "@/src/constant";

import { useToast } from "@/src/hooks/useToast";
import { RefreshCw, ShieldPlus } from "lucide-react";
import RegisterAdminModal, {
  AdminRole,
} from "@/components/modals/RegisterModal";
import AdminsTable from "@/components/tables/AdminsTable";
import { AdminRow } from "@/components/modals/ConfirmDeleteAdminModal";

function tsToIso(ts: any): string | null {
  if (!ts) return null;
  try {
    if (typeof ts.toDate === "function")
      return (ts as Timestamp).toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
    if (typeof ts === "string") return ts;
    return String(ts);
  } catch {
    return null;
  }
}

export default function AdminsPage() {
  const { showToast } = useToast();

  // create admin form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [role, setRole] = useState<AdminRole>("admin");
  const [loadingCreate, setLoadingCreate] = useState(false);

  // admins list
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // modal
  const [openCreate, setOpenCreate] = useState(false);

  // "You" badge
  const [myUid, setMyUid] = useState<string | null>(null);

  // Firestore live listener
  const unsubAdminsRef = useRef<null | (() => void)>(null);

  function resetCreateForm() {
    setEmail("");
    setPassword("");
    setDisplayName("");
    setRole("admin");
  }

  function openCreateModal() {
    resetCreateForm();
    setOpenCreate(true);
  }

  function closeCreateModal() {
    setOpenCreate(false);
  }

  async function resolveMyRoleAndUid(currentUid: string) {
    setMyUid(currentUid);
    const token = await auth.currentUser?.getIdTokenResult(true);
    setIsSuperAdmin(Boolean(token?.claims?.superadmin));
    setRole("admin");
  }

  function subscribeAdmins() {
    setLoadingAdmins(true);

    if (unsubAdminsRef.current) {
      unsubAdminsRef.current();
      unsubAdminsRef.current = null;
    }

    const q = query(collection(db, "admins"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: AdminRow[] = snap.docs.map((d) => {
          const data = d.data() as any;

          return {
            uid: data.uid ?? d.id,
            email: data.email ?? null,
            displayName: data.displayName ?? null,
            photoURL: data.photoURL ?? null,
            disabled: Boolean(data.disabled),
            role: (data.role ?? "admin") as AdminRole,
            createdAt: tsToIso(data.createdAt),
            lastSignIn: tsToIso(data.lastSignIn),
          };
        });

        setAdmins(rows);
        setLoadingAdmins(false);
      },
      (err) => {
        console.error("Admins subscription error:", err);
        setLoadingAdmins(false);
        showToast({
          type: "danger",
          message: "Failed to load admins",
          description: err?.message ?? "Something went wrong",
        });
      },
    );

    unsubAdminsRef.current = unsub;
  }

  // manual refresh (kept)
  async function fetchAdmins() {
    try {
      setLoadingAdmins(true);

      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");

      const token = await current.getIdToken(true);

      const res = await fetch("/api/admin/list-admins", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to fetch admins");

      setAdmins(Array.isArray(data?.admins) ? data.admins : []);
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Failed to load admins",
        description: e?.message ?? "Something went wrong",
      });
    } finally {
      setLoadingAdmins(false);
    }
  }

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      await resolveMyRoleAndUid(user.uid);
      subscribeAdmins();
    });

    return () => {
      unsubAuth();
      if (unsubAdminsRef.current) {
        unsubAdminsRef.current();
        unsubAdminsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoadingCreate(true);

    try {
      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");
      const token = await current.getIdToken(true);

      const res = await fetch("/api/admin/create-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password,
          displayName,
          photoURL: DEFAULT_ADMIN_AVATAR,
          role: isSuperAdmin ? role : "admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");

      showToast({
        type: "success",
        message: "Admin created",
        description: `${displayName || email} can now log in using the temporary password.`,
      });

      closeCreateModal();
      resetCreateForm();
    } catch (e: any) {
      let description = e?.message ?? "Something went wrong";
      if (description.includes("email-already-exists"))
        description = "An account with this email already exists.";
      if (description.includes("invalid-email"))
        description = "Please enter a valid email address.";
      if (description.includes("weak-password"))
        description = "Password should be at least 6 characters.";

      showToast({
        type: "danger",
        message: "Failed to create admin",
        description,
      });
    } finally {
      setLoadingCreate(false);
    }
  }

  async function safeReadJson(res: Response) {
    const text = await res.text();
    try {
      return { json: JSON.parse(text), text };
    } catch {
      return { json: null as any, text };
    }
  }

  async function onDisableAdmin(admin: AdminRow) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");
      const token = await current.getIdToken(true);

      const res = await fetch("/api/admin/toggle-disabled", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: admin.uid, disabled: !admin.disabled }),
      });

      const { json } = await safeReadJson(res);
      if (!res.ok) {
        const msg =
          json?.error ??
          `Request failed (${res.status}). Received non-JSON response.`;
        throw new Error(msg);
      }

      showToast({
        type: "success",
        message: admin.disabled ? "Admin enabled" : "Admin disabled",
        description: admin.email || admin.uid,
      });
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Action failed",
        description: e?.message ?? "Something went wrong",
      });
    }
  }

  async function onDeleteAdmin(admin: AdminRow) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");
      const token = await current.getIdToken(true);

      const res = await fetch("/api/admin/delete-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: admin.uid }),
      });

      const { json } = await safeReadJson(res);
      if (!res.ok) throw new Error(json?.error ?? "Failed");

      showToast({
        type: "success",
        message: "Admin deleted",
        description: admin.email || admin.uid,
      });
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Delete failed",
        description: e?.message ?? "Something went wrong",
      });
      throw e; // optional: keeps modal open if delete fails
    }
  }

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 bg-gray-50">
      <div className="w-full max-w-350 mx-auto">
        <div className="rounded-2xl border border-black/5 bg-white text-[#17335e] shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-primary/10 grid place-items-center border border-primary/15">
                    <ShieldPlus className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-base sm:text-lg font-semibold text-[#17335e] truncate">
                      Admin Management
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Register new admins and manage access to the Stockify
                      panel.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-[#245ea9] px-3 text-xs font-medium text-white transition hover:bg-[#1f4f8d] active:scale-[0.99] sm:px-4 sm:text-sm"
                >
                  <span className="hidden sm:inline">Register Admin</span>
                  <span className="sm:hidden">New</span>
                </button>

                <button
                  type="button"
                  onClick={fetchAdmins}
                  disabled={loadingAdmins}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-0 bg-[#245ea9] text-white shadow-sm transition hover:bg-[#1f4f8d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Refresh admins"
                  title="Refresh"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loadingAdmins ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-[#17335e]/10 bg-[#f4f6fb] px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[#17335e]">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                Live updates enabled
              </div>
              <div className="text-[11px] text-[#17335e]/75">
                Tip: Use “Disable” to temporarily restrict access without
                deleting the account.
              </div>
            </div>
          </div>

          <div className="border-t border-black/5" />

          <div className="p-4 sm:p-6">
            <div className="rounded-2xl border border-black/5 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
                <div className="text-sm font-semibold text-[#17335e]">
                  Admins
                </div>
                <div className="text-xs text-gray-500">
                  Total:{" "}
                  <span className="font-medium text-[#17335e]">
                    {admins.length}
                  </span>
                </div>
              </div>

              <div className="h-[calc(100dvh-280px)] sm:h-[calc(100dvh-300px)] overflow-auto">
                <AdminsTable
                  admins={admins}
                  loading={loadingAdmins}
                  isSuperAdmin={isSuperAdmin}
                  myUid={myUid}
                  onDisableAdmin={onDisableAdmin}
                  onDeleteAdmin={onDeleteAdmin}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 text-center text-[11px] text-gray-400">
          © {new Date().getFullYear()} Stockify
        </div>
      </div>

      <RegisterAdminModal
        open={openCreate}
        disableClose={loadingCreate}
        isSuperAdmin={isSuperAdmin}
        loading={loadingCreate}
        role={role}
        displayName={displayName}
        email={email}
        password={password}
        onChangeRole={setRole}
        onChangeDisplayName={setDisplayName}
        onChangeEmail={setEmail}
        onChangePassword={setPassword}
        onClose={() => {
          if (!loadingCreate) closeCreateModal();
        }}
        onSubmit={onCreate}
      />
    </div>
  );
}
