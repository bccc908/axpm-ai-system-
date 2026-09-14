"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import type { UsdtBalance, UsdtTxResult } from "@/lib/finance/usdt-lookup";

export function UsdtChecker() {
  const { t, locale } = useLocale();
  const [hash, setHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"tx" | "address" | null>(null);
  const [result, setResult] = useState<UsdtTxResult | null>(null);
  const [transfers, setTransfers] = useState<UsdtTxResult[]>([]);
  const [balances, setBalances] = useState<UsdtBalance[]>([]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const q = hash.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setTransfers([]);
    setBalances([]);
    setKind(null);
    try {
      const res = await fetch("/api/usdt/tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: q }),
      });
      const data = await res.json();
      const nextTransfers = (data.transfers as UsdtTxResult[] | undefined) ?? [];
      const nextBalances = (data.balances as UsdtBalance[] | undefined) ?? [];
      if (!res.ok || (!data.result && nextTransfers.length === 0 && nextBalances.length === 0)) {
        setError(data.error === "not_found" ? t("usdt.notFound") : t("usdt.failed"));
        return;
      }
      setKind(data.kind === "address" ? "address" : "tx");
      setResult((data.result as UsdtTxResult | null) ?? null);
      setTransfers(nextTransfers);
      setBalances(nextBalances);
    } catch {
      setError(t("usdt.failed"));
    } finally {
      setLoading(false);
    }
  }

  const list = kind === "address" ? transfers : result ? [result] : [];

  return (
    <div>
      <PageHeader title={t("usdt.title")} subtitle={t("usdt.subtitle")} />
      <Card>
        <form onSubmit={lookup} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            placeholder={t("usdt.placeholder")}
            className="w-full rounded-lg border border-card-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={loading || !hash.trim()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t("usdt.check")}
          </button>
        </form>
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        {balances.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {balances.map((row) => (
              <BalanceCard key={row.chain} row={row} t={t} />
            ))}
          </div>
        ) : null}
        {list.length > 0 ? (
          <div className="mt-6 space-y-4">
            {kind === "address" ? (
              <p className="text-sm text-muted">
                {t("usdt.recent")} · {list.length}
              </p>
            ) : null}
            {list.map((row, i) => (
              <TxCard key={`${row.txHash}-${i}`} row={row} locale={locale} t={t} compact={kind === "address"} />
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function BalanceCard({ row, t }: { row: UsdtBalance; t: (key: string) => string }) {
  return (
    <div className="rounded-xl border border-card-border bg-background/60 p-4">
      <p className="text-sm text-muted">{t("usdt.balance")}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-foreground">
        {row.amount} <span className="text-lg text-muted">USDT</span>
      </p>
      <p className="mt-1 text-sm text-muted">{row.chainLabel}</p>
      <a
        href={row.explorerUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
      >
        {t("usdt.viewAddress")}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function TxCard({
  row,
  locale,
  t,
  compact,
}: {
  row: UsdtTxResult;
  locale: string;
  t: (key: string) => string;
  compact: boolean;
}) {
  const statusVariant =
    row.status === "success" ? "success" : row.status === "failed" ? "danger" : "warning";
  return (
    <div className={compact ? "rounded-xl border border-card-border p-4" : "space-y-3"}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant}>{t(`usdt.status.${row.status}`)}</Badge>
        <span className="text-sm text-muted">{row.chainLabel}</span>
        <span className="text-sm font-medium text-foreground">{row.token}</span>
      </div>
      <p className={`font-display font-semibold text-foreground ${compact ? "text-xl" : "text-3xl"}`}>
        {row.amount} <span className="text-lg text-muted">USDT</span>
      </p>
      <dl className="grid gap-2 text-sm">
        <Row label={t("usdt.from")} value={row.from} />
        <Row label={t("usdt.to")} value={row.to} />
        <Row
          label={t("usdt.time")}
          value={
            row.timestamp ? new Date(row.timestamp).toLocaleString(locale === "zh" ? "zh-CN" : "en-US") : "—"
          }
        />
        {compact && row.txHash ? <Row label={t("usdt.hash")} value={row.txHash} /> : null}
      </dl>
      <a
        href={row.explorerUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
      >
        {t("usdt.explorer")}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-16 shrink-0 text-muted">{label}</dt>
      <dd className="break-all font-mono text-foreground">{value || "—"}</dd>
    </div>
  );
}
