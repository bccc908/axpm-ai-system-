"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, Plus } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import type { CrmAccount } from "@/types/crm-zoho";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function AccountsPanel() {
  const { t } = useLocale();
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/accounts");
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addAccount() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/crm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          industry: industry.trim() || null,
        }),
      });
      setName("");
      setPhone("");
      setIndustry("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("zoho.accountName")} />
        <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("zoho.accountPhone")} />
        <input className={inputClass} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder={t("zoho.accountIndustry")} />
      </div>
      <button
        type="button"
        disabled={saving || !name.trim()}
        onClick={() => void addAccount()}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-muted disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {t("zoho.addAccount")}
      </button>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted">{t("zoho.noAccounts")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Link
              key={account.id}
              href={`/dashboard/crm/accounts/${account.id}`}
              className="rounded-xl border border-card-border p-4 transition-colors hover:border-accent/40 hover:bg-background/60"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-accent/10 p-2">
                  <Building2 className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{account.name}</p>
                  {account.phone && <p className="text-xs text-muted">{account.phone}</p>}
                  {account.industry && <p className="text-xs text-muted">{account.industry}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
