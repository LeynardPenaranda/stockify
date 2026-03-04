"use client";

import React from "react";
import Image from "next/image";
import { AlertTriangle, Trash2, X } from "lucide-react";

export type AdminRole = "admin" | "superadmin";

export type AdminRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  disabled: boolean;
  role: AdminRole;
  createdAt: string | null;
  lastSignIn: string | null;
};

export default function ConfirmDeleteAdminModal({
  open,
  admin,
  loading,
  disableClose,
  onClose,
  onConfirm,
}: {
  open: boolean;
  admin: AdminRow | null;
  loading: boolean;
  disableClose?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !admin) return null;

  const locked = Boolean(loading || disableClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop (NOT a button, so it won't trigger any alert/submit behavior) */}
      <div
        className="absolute inset-0 bg-black/45"
        onClick={() => {
          if (!locked) onClose();
        }}
      />

      {/* Panel */}
      <div
        className="relative w-130 max-w-[95vw] rounded-2xl bg-white shadow-2xl border border-black/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-black/10 flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-red-50 border border-red-200 grid place-items-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>

            <div className="min-w-0">
              <div className="text-base font-semibold text-gray-900 truncate">
                Delete admin?
              </div>
              <div className="text-xs text-gray-500">
                This will remove the admin account and access to Stockify.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!locked) onClose();
            }}
            disabled={locked}
            className={[
              "rounded-xl border border-black/10 p-2 transition",
              locked
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer hover:bg-black/5 active:scale-[0.98]",
            ].join(" ")}
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Admin card */}
          <div className="rounded-2xl border border-black/10 bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl border border-black/10 bg-white overflow-hidden grid place-items-center shrink-0">
                {admin.photoURL ? (
                  <Image
                    src={admin.photoURL}
                    alt={admin.displayName || admin.email || "Admin"}
                    width={44}
                    height={44}
                    className="h-11 w-11 object-cover"
                  />
                ) : (
                  <div className="text-xs text-gray-400">No photo</div>
                )}
              </div>

              <div className="min-w-0">
                <div className="font-semibold text-gray-900 truncate">
                  {admin.displayName || "Unnamed"}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {admin.email || admin.uid}
                </div>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-semibold text-red-800">
              This action cannot be undone.
            </div>
            <div className="mt-1 text-xs text-red-700">
              The admin will be deleted from authentication and removed from the
              admins list.
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (!locked) onClose();
              }}
              disabled={locked}
              className={[
                "rounded-xl border border-black/10 px-4 py-2 text-sm transition",
                "disabled:pointer-events-none",
                locked
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:bg-black/5 active:scale-[0.99]",
              ].join(" ")}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                if (!locked) onConfirm();
              }}
              disabled={locked}
              className={[
                "rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-semibold transition inline-flex items-center gap-2",
                "disabled:pointer-events-none",
                locked
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:opacity-95 active:scale-[0.99]",
              ].join(" ")}
            >
              <Trash2 className="h-4 w-4" />
              {loading ? "Deleting..." : "Delete Admin"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
