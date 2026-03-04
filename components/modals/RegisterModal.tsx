"use client";

import React, { useMemo, useState } from "react";
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
  return role === "superadmin" ? "Super Admin" : "Admin";
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
    <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
      <div className="w-20 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="flex-1 min-w-0 text-sm text-gray-900 truncate">
        {shown || <span className="text-gray-400">(empty)</span>}
      </div>
      <button
        type="button"
        disabled={!copyValue}
        onClick={async () => {
          await copyToClipboard(copyValue);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 900);
        }}
        className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-1.5 text-xs hover:bg-black/5 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
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
      className="fixed inset-0 z-50 flex items-center justify-center"
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
      <div className="relative w-155 max-w-[95vw] rounded-2xl bg-white shadow-2xl border border-black/10 overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-black/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/15 grid place-items-center">
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
            className="rounded-xl border border-black/10 p-2 hover:bg-black/5 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Copy credentials */}
            <div className="rounded-2xl border border-black/10 bg-gray-50 p-4">
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
                  className="shrink-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs hover:bg-black/5 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                <select
                  value={role}
                  disabled={locked}
                  onChange={(e) => onChangeRole(e.target.value as AdminRole)}
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="admin">{roleLabel("admin")}</option>
                  <option value="superadmin">{roleLabel("superadmin")}</option>
                </select>
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
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
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
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
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
                  className="w-full rounded-xl border border-black/10 px-3 py-2 pr-11 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
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
                className="rounded-xl border border-black/10 px-4 py-2 text-sm hover:bg-black/5 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>

              <button
                disabled={loading}
                type="submit"
                className="rounded-xl bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Registering..." : "Register Admin"}
              </button>
            </div>

            <div className="pt-3 border-t border-black/10 text-xs text-gray-500">
              <strong>Tip:</strong> This is a temporary password. Ask the new
              admin to use{" "}
              <span className="font-semibold">“Forgot password?”</span> on the
              login page to set their own password.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
