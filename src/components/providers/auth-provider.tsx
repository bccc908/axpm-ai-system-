"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthModule, AuthUserPublic } from "@/lib/auth/types";
import { NAV_MODULE } from "@/lib/auth/permissions";

interface AuthState {
  loading: boolean;
  user: AuthUserPublic | null;
  modules: AuthModule[];
  can: (module: AuthModule) => boolean;
  canHref: (href: string) => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUserPublic | null>(null);
  const [modules, setModules] = useState<AuthModule[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    setUser(data.user ?? null);
    setModules(data.modules ?? []);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const can = useCallback(
    (module: AuthModule) => modules.includes(module),
    [modules],
  );

  const canHref = useCallback(
    (href: string) => {
      const path = href.split("?")[0];
      const authModule = NAV_MODULE[href] ?? NAV_MODULE[path];
      if (!authModule) return true;
      return can(authModule);
    },
    [can],
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  const value = useMemo(
    () => ({ loading, user, modules, can, canHref, refresh, logout }),
    [loading, user, modules, can, canHref, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
