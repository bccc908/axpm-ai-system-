"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

export function CrmImportExport({ onImported }: { onImported?: () => void }) {
  const { t } = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<"leads" | "contacts">("leads");
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleImport(file: File) {
    setImporting(true);
    setStatus(null);
    try {
      const csv = await file.text();
      const res = await fetch("/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: importType, csv }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(t("zoho.importSuccess", { n: data.imported ?? 0 }));
        onImported?.();
      } else {
        setStatus(t("zoho.importFailed"));
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-card-border bg-background/40 p-3">
      <span className="text-xs font-medium text-muted">{t("zoho.dataTools")}</span>
      <a
        href="/api/crm/export?type=leads"
        className="inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs hover:bg-card-border/30"
      >
        <Download className="h-3.5 w-3.5" />
        {t("zoho.exportLeads")}
      </a>
      <a
        href="/api/crm/export?type=contacts"
        className="inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs hover:bg-card-border/30"
      >
        <Download className="h-3.5 w-3.5" />
        {t("zoho.exportContacts")}
      </a>
      <select
        className="rounded-lg border border-card-border bg-background px-2 py-1.5 text-xs"
        value={importType}
        onChange={(e) => setImportType(e.target.value as "leads" | "contacts")}
      >
        <option value="leads">{t("zoho.tabLeads")}</option>
        <option value="contacts">{t("zoho.tabContacts")}</option>
      </select>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImport(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={importing}
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs hover:bg-card-border/30 disabled:opacity-50"
      >
        {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {t("zoho.importCsv")}
      </button>
      {status && <span className="text-xs text-muted">{status}</span>}
    </div>
  );
}
