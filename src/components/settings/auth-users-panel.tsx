"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { AuthUserPublic, UserRole } from "@/lib/auth/types";

const ROLES: UserRole[] = ["admin", "sales", "finance", "personal", "viewer"];

export function AuthUsersPanel() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const [users, setUsers] = useState<AuthUserPublic[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("sales");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== "owner") return;
    fetch("/api/auth/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []));
  }, [user?.role]);

  if (user?.role !== "owner") return null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Failed");
        return;
      }
      setUsers((prev) => [...prev, data.user]);
      setEmail("");
      setName("");
      setPassword("");
      setMessage(t("auth.userCreated"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title={t("auth.usersTitle")} description={t("auth.usersDesc")} />
      <ul className="mb-4 divide-y divide-card-border rounded-lg border border-card-border">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="font-medium text-foreground">{u.name}</span>
            <span className="text-muted">{u.email}</span>
            <span className="text-xs text-accent">
              {ROLE_LABELS[u.role][locale === "zh" ? "zh" : "en"]}
            </span>
          </li>
        ))}
      </ul>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleAdd}>
        <input
          className="rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
          placeholder={t("auth.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="email"
          className="rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
          placeholder={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
          placeholder={t("auth.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <select
          className="rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r][locale === "zh" ? "zh" : "en"]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("auth.addUser")}
        </button>
      </form>
      {message ? <p className="mt-2 text-sm text-foreground">{message}</p> : null}
    </Card>
  );
}
