"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Shield,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  UserX,
} from "lucide-react";
import ConfirmDeleteAdminModal, {
  AdminRole,
  AdminRow,
} from "../modals/ConfirmDeleteAdminModal";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function RolePill({ role }: { role: AdminRole }) {
  const isSuper = role === "superadmin";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold border",
        isSuper
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-gray-50 text-gray-700 border-black/10",
      ].join(" ")}
    >
      {isSuper ? (
        <ShieldCheck className="h-3.5 w-3.5" />
      ) : (
        <Shield className="h-3.5 w-3.5" />
      )}
      {isSuper ? "Super Admin" : "Admin"}
    </span>
  );
}

function StatusPill({ disabled }: { disabled: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold border",
        disabled
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200",
      ].join(" ")}
    >
      {disabled ? "Disabled" : "Active"}
    </span>
  );
}

export default function AdminsTable({
  admins,
  loading,
  isSuperAdmin,
  myUid,
  onDisableAdmin,
  onDeleteAdmin,
}: {
  admins: AdminRow[];
  loading: boolean;
  isSuperAdmin: boolean;
  myUid: string | null;
  onDisableAdmin: (admin: AdminRow) => void;
  onDeleteAdmin: (admin: AdminRow) => Promise<void> | void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function openDelete(admin: AdminRow) {
    setDeleteTarget(admin);
    setDeleteOpen(true);
  }

  function closeDelete() {
    if (deleteLoading) return;
    setDeleteOpen(false);
    setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await onDeleteAdmin(deleteTarget);
      setDeleteOpen(false);
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading admins...</div>;
  }

  if (!admins?.length) {
    return (
      <div className="p-10 text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-gray-50 border border-black/10 grid place-items-center">
          <User className="h-5 w-5 text-gray-500" />
        </div>
        <div className="mt-3 text-sm font-semibold text-gray-900">
          No admins found
        </div>
        <div className="mt-1 text-xs text-gray-500">
          Register a new admin to get started.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full overflow-x-auto">
        <table className="min-w-245 w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-black/10">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">
                Admin
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">
                Role
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">
                Created
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">
                Last sign-in
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {admins.map((a) => {
              const isMe = Boolean(myUid && a.uid === myUid);
              const canManage = isSuperAdmin && !isMe;

              return (
                <tr
                  key={a.uid}
                  className="border-b border-black/5 hover:bg-black/2 transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl border border-black/10 bg-gray-50 overflow-hidden grid place-items-center shrink-0">
                        {a.photoURL ? (
                          <Image
                            src={a.photoURL}
                            alt={a.displayName || a.email || "Admin"}
                            width={40}
                            height={40}
                            className="h-10 w-10 object-cover"
                          />
                        ) : (
                          <User className="h-5 w-5 text-gray-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {a.displayName || "Unnamed"}
                          </div>
                          {isMe ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary">
                              You
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {a.email || a.uid}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <RolePill role={a.role} />
                  </td>

                  <td className="px-4 py-3">
                    <StatusPill disabled={a.disabled} />
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-600">
                    {formatDate(a.createdAt)}
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-600">
                    {formatDate(a.lastSignIn)}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Disable / Enable */}
                      <button
                        type="button"
                        onClick={() => onDisableAdmin(a)}
                        disabled={!canManage}
                        className={[
                          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                          "active:scale-[0.99] disabled:pointer-events-none",
                          a.disabled
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
                          canManage
                            ? "cursor-pointer"
                            : "opacity-50 cursor-not-allowed hover:bg-inherit",
                        ].join(" ")}
                        title={
                          !isSuperAdmin
                            ? "Only Super Admin can manage admins"
                            : isMe
                              ? "You cannot disable yourself"
                              : ""
                        }
                      >
                        {a.disabled ? (
                          <UserCheck className="h-4 w-4" />
                        ) : (
                          <UserX className="h-4 w-4" />
                        )}

                        {a.disabled ? "Enable" : "Disable"}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => openDelete(a)}
                        disabled={!canManage}
                        className={[
                          "inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition",
                          "hover:bg-black/5 active:scale-[0.99] disabled:pointer-events-none",
                          canManage
                            ? "cursor-pointer"
                            : "opacity-50 cursor-not-allowed",
                        ].join(" ")}
                        title={
                          !isSuperAdmin
                            ? "Only Super Admin can delete admins"
                            : isMe
                              ? "You cannot delete yourself"
                              : ""
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDeleteAdminModal
        open={deleteOpen}
        admin={deleteTarget}
        loading={deleteLoading}
        disableClose={deleteLoading}
        onClose={closeDelete}
        onConfirm={confirmDelete}
      />
    </>
  );
}
