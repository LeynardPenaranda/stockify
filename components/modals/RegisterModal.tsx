"use client";

import React, { useMemo, useState } from "react";
import { Select } from "antd";
import { Check, Copy, Eye, EyeOff, ShieldPlus, X } from "lucide-react";

export type AdminRole = "admin" | "superadmin";

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

function roleLabel(role: AdminRole) {
  return role === "superadmin" ? "Owner" : "Admin";
}

function CopyLine({
  label,
  displayValue,
  copyValue,
  mask,
}: {
  label: string;
  displayValue: string;
  copyValue: string;
  mask?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const shown = mask
    ? displayValue
      ? "•".repeat(Math.min(10, displayValue.length))
      : ""
    : displayValue;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#17335e]/30 bg-white px-3 py-2">
      <div className="w-20 text-[11px] font-semibold uppercase tracking-wide text-[#17335e]">
        {label}
      </div>
      <div className="flex-1 min-w-0 truncate text-sm text-[#17335e]">
        {shown || <span className="text-[#17335e]/60">(empty)</span>}
      </div>
      <button
        type="button"
        disabled={!copyValue}
        onClick={async () => {
          await copyToClipboard(copyValue);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 900);
        }}
        className="shrink-0 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#17335e]/30 px-3 py-1.5 text-xs text-[#17335e] transition hover:bg-black/5 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function RegisterAdminModal({
  open,
  disableClose,

  title = "Register Admin",
  subtitle = "Create a new admin account for Stockify.",

  isSuperAdmin,
  loading,

  role,
  displayName,
  email,
  password,

  onChangeRole,
  onChangeDisplayName,
  onChangeEmail,
  onChangePassword,

  onClose,
  onSubmit,
}: {
  open: boolean;
  disableClose: boolean;

  title?: string;
  subtitle?: string;

  isSuperAdmin: boolean;
  loading: boolean;

  role: AdminRole;
  displayName: string;
  email: string;
  password: string;

  onChangeRole: (role: AdminRole) => void;
  onChangeDisplayName: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onChangePassword: (v: string) => void;

  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const [showPw, setShowPw] = useState(false);

  const copyBlock = useMemo(() => {
    return [
      `email: ${email || "(empty)"}`,
      `password: ${password || "(empty)"}`,
    ].join("\n");
  }, [email, password]);

  const [copiedAll, setCopiedAll] = useState(false);

  async function onCopyAll() {
    await copyToClipboard(copyBlock);
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 1000);
  }

  if (!open) return null;

  const locked = loading || disableClose;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close modal"
        onClick={() => {
          if (!locked) onClose();
        }}
      />

      {/* Panel */}
      <div
        className={[
          "relative w-155 max-w-[95vw] rounded-2xl border border-[#17335e]/30 bg-white shadow-2xl overflow-hidden",
          // responsive height + prevent off-screen on small displays
          "max-h-[92dvh] sm:max-h-[88vh]",
          // layout so body can scroll while header stays visible
          "flex flex-col",
        ].join(" ")}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-[#17335e]/30 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[#17335e]/30 bg-primary/10">
                <ShieldPlus className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                  {title}
                </div>
                <div className="text-xs sm:text-sm text-gray-500">
                  {subtitle}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!locked) onClose();
            }}
            disabled={locked}
            className="cursor-pointer rounded-xl border border-[#17335e]/30 p-2 text-[#17335e] transition hover:bg-black/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body (scrolls when modal is short/tall) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-5 sm:p-6">
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Copy credentials */}
              <div className="rounded-2xl border border-[#17335e]/30 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">
                      Credentials
                    </div>
                    <div className="text-xs text-gray-500">
                      Copy the email + temporary password and send to the new
                      admin.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onCopyAll}
                    disabled={!email || !password}
                    className="shrink-0 cursor-pointer rounded-xl border border-[#17335e]/30 bg-white px-3 py-2 text-xs text-[#17335e] transition hover:bg-black/5 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      {copiedAll ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copiedAll ? "Copied" : "Copy all"}
                    </span>
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  <CopyLine
                    label="email"
                    displayValue={email}
                    copyValue={email}
                  />
                  <CopyLine
                    label="password"
                    displayValue={password}
                    copyValue={password}
                    mask
                  />
                </div>
              </div>

              {/* Role */}
              {isSuperAdmin ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-900">
                    Role
                  </label>
                  <Select
                    value={role}
                    disabled={locked}
                    onChange={(value) => onChangeRole(value as AdminRole)}
                    options={[
                      { value: "admin", label: roleLabel("admin") },
                      { value: "superadmin", label: roleLabel("superadmin") },
                    ]}
                    className="w-full cursor-pointer"
                    classNames={{
                      popup: {
                        root: "[&_.ant-select-item-option-content]:text-[#17335e]",
                      },
                    }}
                    styles={{
                      popup: {
                        root: {
                          border: "1px solid rgba(23, 51, 94, 0.3)",
                        },
                      },
                    }}
                  >
                  </Select>
                  <p className="text-[11px] text-gray-500">
                    Only Super Admins can assign roles.
                  </p>
                </div>
              ) : null}

              {/* Display Name */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-900">
                  Display Name
                </label>
                <input
                  className="w-full rounded-xl border border-[#17335e]/30 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#17335e] focus:ring-2 focus:ring-[#17335e]/30"
                  placeholder="Juan Dela Cruz"
                  value={displayName}
                  onChange={(e) => onChangeDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-900">
                  Admin Email
                </label>
                <input
                  className="w-full rounded-xl border border-[#17335e]/30 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#17335e] focus:ring-2 focus:ring-[#17335e]/30"
                  placeholder="admin@stockify.com"
                  value={email}
                  onChange={(e) => onChangeEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-900">
                  Temporary Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    className="w-full rounded-xl border border-[#17335e]/30 bg-white px-3 py-2 pr-11 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#17335e] focus:ring-2 focus:ring-[#17335e]/30"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => onChangePassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-black/5 active:scale-95 transition"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
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
                  className="cursor-pointer rounded-xl border border-[#17335e]/30 px-4 py-2 text-sm text-[#17335e] transition hover:bg-black/5 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  disabled={loading}
                  type="submit"
                  className="cursor-pointer rounded-xl bg-[#245ea9] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1f4f8d] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Registering..." : "Register Admin"}
                </button>
              </div>

              <div className="border-t border-[#17335e]/30 pt-3 text-xs text-gray-500">
                <strong>Tip:</strong> This is a temporary password. Ask the new
                admin to use{" "}
                <span className="font-semibold">“Forgot password?”</span> on the
                login page to set their own password.
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
