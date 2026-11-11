"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";

type Position = {
  coin: string;
  size: number;
  side: "long" | "short";
  entry_px: number | null;
  position_value: number | null;
  unrealized_pnl: number | null;
  leverage: number | null;
  liquidation_px: number | null;
  margin_used: number | null;
};

type Account = {
  address: string;
  account_value: number | null;
  withdrawable: number | null;
  total_margin_used: number | null;
  positions: Position[];
};

function money(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function HyperliquidAccountCard() {
  const { t } = useLocale();
  const [address, setAddress] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hl-signals/account", { credentials: "include" });
      const data = (await res.json().catch(() => null)) as
        | { address?: string | null; account?: Account | null; error?: string }
        | null;
      setSaved(data?.address ?? null);
      setAddress(data?.address ?? "");
      setAccount(data?.account ?? null);
      if (!res.ok && data?.error) setError(data.error);
    } catch {
      setError(t("hlSignals.walletLoadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hl-signals/account", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = (await res.json().catch(() => null)) as
        | { address?: string | null; account?: Account | null; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error || t("hlSignals.walletInvalid"));
        return;
      }
      setSaved(data?.address ?? null);
      setAccount(data?.account ?? null);
    } catch {
      setError(t("hlSignals.walletLoadFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gold-desk-panel border-[#262d3d] bg-[#171c2a] px-4 py-3">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted">
        <Wallet className="h-3.5 w-3.5 text-accent" />
        {t("hlSignals.walletTitle")}
        <span className="text-muted/60">· {t("hlSignals.walletReadOnly")}</span>
      </div>
      <p className="mb-3 text-xs text-muted">{t("hlSignals.walletDesc")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-accent/40"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 font-mono text-xs font-semibold text-accent disabled:opacity-50"
        >
          {saving ? t("hlSignals.walletSaving") : t("hlSignals.walletSave")}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-white/[0.08] px-3 py-2 font-mono text-xs text-muted"
        >
          {t("hlSignals.refresh")}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("goldSignals.loading")}
        </div>
      ) : saved && account ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted">{t("hlSignals.accountValue")}</p>
              <p className="font-mono text-lg text-foreground">${money(account.account_value)}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-muted">{t("hlSignals.withdrawable")}</p>
              <p className="font-mono text-lg text-foreground">${money(account.withdrawable)}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-muted">{t("hlSignals.marginUsed")}</p>
              <p className="font-mono text-lg text-foreground">${money(account.total_margin_used)}</p>
            </div>
          </div>
          {account.positions.length === 0 ? (
            <p className="text-xs text-muted">{t("hlSignals.noPositions")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 pr-3 font-normal">{t("hlSignals.coin")}</th>
                    <th className="py-1 pr-3 font-normal">{t("hlSignals.side")}</th>
                    <th className="py-1 pr-3 font-normal">{t("hlSignals.size")}</th>
                    <th className="py-1 pr-3 font-normal">{t("hlSignals.entry")}</th>
                    <th className="py-1 pr-3 font-normal">{t("hlSignals.pnl")}</th>
                    <th className="py-1 font-normal">{t("hlSignals.liq")}</th>
                  </tr>
                </thead>
                <tbody>
                  {account.positions.map((p) => (
                    <tr key={`${p.coin}-${p.side}`} className="border-t border-white/[0.06]">
                      <td className="py-1.5 pr-3 text-foreground">{p.coin}</td>
                      <td
                        className={cn(
                          "py-1.5 pr-3 uppercase",
                          p.side === "long" ? "text-success" : "text-danger",
                        )}
                      >
                        {p.side}
                      </td>
                      <td className="py-1.5 pr-3">{money(Math.abs(p.size), 4)}</td>
                      <td className="py-1.5 pr-3">{money(p.entry_px)}</td>
                      <td
                        className={cn(
                          "py-1.5 pr-3",
                          (p.unrealized_pnl ?? 0) >= 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {money(p.unrealized_pnl)}
                      </td>
                      <td className="py-1.5">{money(p.liquidation_px)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
