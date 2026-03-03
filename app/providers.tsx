"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/src/lib/firebase/client";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean | null; // null = not decided yet
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  isAdmin: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (!u) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const token = await u.getIdTokenResult(true);
        setIsAdmin(Boolean(token.claims.admin));
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({ user, loading, isAdmin }),
    [user, loading, isAdmin],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
