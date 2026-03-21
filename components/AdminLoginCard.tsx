"use client";

import { useState } from "react";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/src/lib/firebase/client";
import { Eye, EyeClosed, Loader2 } from "lucide-react";
import Image from "next/image";

type Props = { onSuccess?: () => void };

export default function AdminLoginCard({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isOpenEye, setIsOpenEye] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const canReset = email.trim().length > 0 && !loading && !sendingReset;

  async function onForgotPassword() {
    const trimmed = email.trim();
    if (!trimmed) {
      setErr("Email required to reset password.");
      return;
    }

    setErr(null);
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setErr("Reset email sent. Check Inbox/Spam.");
    } catch (e: any) {
      setErr(e?.code ? `Reset failed: ${e.code}` : "Reset failed.");
    } finally {
      setSendingReset(false);
    }
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setErr(null);
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdTokenResult(true);
      const isAdmin = Boolean(token.claims.admin);

      if (!isAdmin) {
        await auth.signOut();
        setErr("Access denied. This account is not an admin.");
        return;
      }

      onSuccess?.();
    } catch (e: any) {
      // simple readable mapping
      const code = e?.code as string | undefined;
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password"
      ) {
        setErr("Incorrect email or password.");
      } else if (code === "auth/user-not-found") {
        setErr("No account found with this email.");
      } else if (code === "auth/too-many-requests") {
        setErr("Too many attempts. Try again later.");
      } else {
        setErr("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 text-[#17335e] shadow-2xl space-y-6">
      <div className="text-center space-y-1 flex justify-start items-center">
        <Image
          src={"/stockify-logo.png"}
          alt="Stockify Logo"
          width={120}
          height={120}
        />
        <div className="flex flex-col items-start justify-start">
          <h1 className="text-2xl font-semibold tracking-tight">
            STOCKIFY Inventory
          </h1>
          <p className="text-sm text-[#17335e]">Sign in to continue</p>
        </div>
      </div>

      <form onSubmit={onLogin} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-[#17335e]">Email</label>
          <input
            disabled={loading}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#17335e] outline-none transition placeholder:text-[#17335e]/60 focus:border-[#17335e] focus:ring-2 focus:ring-[#17335e] disabled:opacity-60"
            placeholder="e.g., admin@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="space-y-1 relative">
          <label className="text-sm font-medium text-[#17335e]">Password</label>
          <input
            disabled={loading}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm text-[#17335e] outline-none transition placeholder:text-[#17335e]/60 focus:border-[#17335e] focus:ring-2 focus:ring-[#17335e] disabled:opacity-60"
            placeholder="••••••••"
            type={isOpenEye ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            disabled={loading}
            className="absolute top-7 right-2 rounded-md p-1 text-[#17335e] hover:bg-gray-100 disabled:opacity-50"
            onClick={() => setIsOpenEye((v) => !v)}
            aria-label={isOpenEye ? "Hide password" : "Show password"}
          >
            {isOpenEye ? (
              <EyeClosed className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onForgotPassword}
          disabled={!canReset}
          className="cursor-pointer text-xs text-[#17335e] underline hover:text-[#0f2443] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sendingReset ? "Sending..." : "Forgot password?"}
        </button>

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#17335e]">
            {err}
          </div>
        )}

        <button
          disabled={loading}
          type="submit"
          className="w-full rounded-lg bg-primary text-white py-2.5 text-sm font-medium hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2  cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </button>
      </form>
    </div>
  );
}
