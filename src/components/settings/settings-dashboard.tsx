"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { EmailSettingsPanel } from "@/components/settings/email-settings";
import { AgentKnowledgeUpload } from "@/components/ai/agent-knowledge-upload";
import { Card, CardHeader } from "@/components/ui/card";

type SettingsData = {
  settings: {
    digestHour: number;
    defaultFinanceCurrency: string;
    financeAutoMode?: boolean;
    financeStartMonth?: string;
    todoNotifyTelegram?: boolean;
    todoNotifyWhatsapp?: boolean;
    whatsappNotifyPhone?: string | null;
    autoCreateClientsFromChat?: boolean;
    notifyNewClientTelegram?: boolean;
    autoReplyEnabled?: boolean;
    autoReplyWhatsApp?: boolean;
    autoReplyWeChat?: boolean;
    replyAgentPrompt?: string | null;
  };
  financeStartMonth?: string;
  financeAutoMode?: boolean;
  cronFinanceUrl?: string;
  integrations: {
    telegram: { isReady: boolean; hasToken: boolean; hasChatId: boolean };
    email: { isReady: boolean; enabled: boolean; provider: string };
    openai: { configured: boolean };
    llm?: { configured: boolean; provider: string; label: string };
    supabase: { configured: boolean };
    whatsapp: { configured: boolean };
    wechatWork: { configured: boolean; canSend: boolean };
    social: { facebook: boolean; instagram: boolean; wechatOa: boolean; tiktok: boolean; xiaohongshu?: boolean; douyin?: boolean };
    openclaw?: { configured: boolean; gatewayUrl: string; provider: string };
    googleDrive: { configured: boolean; folderIdSet: boolean };
  };
  cronDigestUrl: string;
  cronEmailUrl: string;
  cronSocialUrl: string;
  whatsappWebhookUrl?: string;
  whatsappVerifyTokenSet?: boolean;
  whatsappPublicUrlWarning?: boolean;
  appUrl?: string;
};

export function SettingsDashboard() {
  const { t } = useLocale();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [digestHour, setDigestHour] = useState(9);
  const [defaultCurrency, setDefaultCurrency] = useState<"MYR" | "CNY">("MYR");
  const [financeAutoMode, setFinanceAutoMode] = useState(true);
  const [financeStartMonth, setFinanceStartMonth] = useState("2026-06");
  const [todoNotifyTelegram, setTodoNotifyTelegram] = useState(true);
  const [todoNotifyWhatsapp, setTodoNotifyWhatsapp] = useState(true);
  const [whatsappNotifyPhone, setWhatsappNotifyPhone] = useState("");
  const [replyAgentPrompt, setReplyAgentPrompt] = useState("");
  const [autoCreateFromChat, setAutoCreateFromChat] = useState(true);
  const [notifyNewClientTelegram, setNotifyNewClientTelegram] = useState(true);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyWhatsApp, setAutoReplyWhatsApp] = useState(true);
  const [autoReplyWeChat, setAutoReplyWeChat] = useState(true);
  const [openclawReachable, setOpenclawReachable] = useState<boolean | null>(null);
  const [whatsappTesting, setWhatsappTesting] = useState(false);
  const [whatsappTestMsg, setWhatsappTestMsg] = useState<string | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [registerUrl, setRegisterUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      setData(json);
      setDigestHour(json.settings?.digestHour ?? 9);
      setDefaultCurrency(json.settings?.defaultFinanceCurrency ?? "MYR");
      setFinanceAutoMode(json.financeAutoMode !== false && json.settings?.financeAutoMode !== false);
      setFinanceStartMonth(json.financeStartMonth ?? json.settings?.financeStartMonth ?? "2026-06");
      setTodoNotifyTelegram(json.settings?.todoNotifyTelegram !== false);
      setTodoNotifyWhatsapp(json.settings?.todoNotifyWhatsapp !== false);
      setWhatsappNotifyPhone(json.settings?.whatsappNotifyPhone ?? "");
      setReplyAgentPrompt(json.settings?.replyAgentPrompt ?? "");
      setAutoCreateFromChat(json.settings?.autoCreateClientsFromChat !== false);
      setNotifyNewClientTelegram(json.settings?.notifyNewClientTelegram !== false);
      setAutoReplyEnabled(json.settings?.autoReplyEnabled === true);
      setAutoReplyWhatsApp(json.settings?.autoReplyWhatsApp !== false);
      setAutoReplyWeChat(json.settings?.autoReplyWeChat !== false);
      const regRes = await fetch("/api/public/register");
      const reg = await regRes.json();
      setRegisterUrl(reg.registerUrl ?? "");
      const aiStatus = await fetch("/api/ai/status", { method: "POST" });
      const ai = await aiStatus.json();
      setOpenclawReachable(ai.openclaw?.reachable ?? false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettings() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digestHour,
          defaultFinanceCurrency: defaultCurrency,
          financeAutoMode,
          financeStartMonth,
          todoNotifyTelegram,
          todoNotifyWhatsapp,
          whatsappNotifyPhone: whatsappNotifyPhone.trim() || null,
          replyAgentPrompt: replyAgentPrompt.trim() || null,
          autoCreateClientsFromChat: autoCreateFromChat,
          notifyNewClientTelegram,
          autoReplyEnabled,
          autoReplyWhatsApp,
          autoReplyWeChat,
        }),
      });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function testWhatsApp() {
    setWhatsappTesting(true);
    setWhatsappTestMsg(null);
    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: whatsappNotifyPhone.trim() || undefined }),
      });
      const json = await res.json();
      setWhatsappTestMsg(
        res.ok ? t("settings.whatsappTestSent") : json.error ?? t("settings.whatsappTestFailed"),
      );
    } catch {
      setWhatsappTestMsg(t("settings.whatsappTestFailed"));
    } finally {
      setWhatsappTesting(false);
    }
  }

  async function copyWebhookUrl() {
    if (!data?.whatsappWebhookUrl) return;
    await navigator.clipboard.writeText(data.whatsappWebhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  }

  if (loading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  const Status = ({ ok }: { ok: boolean }) =>
    ok ? (
      <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" />{t("settings.connected")}</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-muted"><XCircle className="h-4 w-4" />{t("settings.notConfigured")}</span>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("settings.title")}</h1>
        <p className="mt-1 text-muted">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader title={t("settings.integrations")} description={t("settings.integrationsDesc")} />
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span>Telegram</span><Status ok={data.integrations.telegram.isReady} /></div>
          <div className="flex justify-between"><span>Email</span><Status ok={data.integrations.email.isReady} /></div>
          <div className="flex justify-between">
            <span>{data.integrations.llm?.label ?? "OpenAI"}</span>
            <Status ok={data.integrations.llm?.configured ?? data.integrations.openai.configured} />
          </div>
          <div className="flex justify-between">
            <span>OpenClaw</span>
            <Status ok={Boolean(data.integrations.openclaw?.configured && openclawReachable)} />
          </div>
          <div className="flex justify-between"><span>WhatsApp</span><Status ok={data.integrations.whatsapp.configured} /></div>
          <div className="flex justify-between">
            <span>WeChat Work 企业微信</span>
            <span className="text-right">
              {data.integrations.wechatWork.canSend ? (
                <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" />{t("settings.sendReady")}</span>
              ) : (
                <Status ok={data.integrations.wechatWork.configured} />
              )}
            </span>
          </div>
          <div className="flex justify-between"><span>Facebook</span><Status ok={data.integrations.social.facebook} /></div>
          <div className="flex justify-between"><span>Instagram</span><Status ok={data.integrations.social.instagram} /></div>
          <div className="flex justify-between"><span>WeChat 公众号</span><Status ok={data.integrations.social.wechatOa} /></div>
          <div className="flex justify-between"><span>小红书 Xiaohongshu</span><Status ok={Boolean(data.integrations.social.xiaohongshu)} /></div>
          <div className="flex justify-between"><span>抖音 Douyin</span><Status ok={Boolean(data.integrations.social.douyin)} /></div>
          <div className="flex justify-between"><span>Google Drive (Receipts)</span><Status ok={data.integrations.googleDrive.configured} /></div>
          <div className="flex justify-between"><span>Supabase</span><Status ok={data.integrations.supabase.configured} /></div>
        </div>
      </Card>

      <EmailSettingsPanel />

      <Card>
        <CardHeader title={t("settings.todoNotifyTitle")} description={t("settings.todoNotifyDesc")} />
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={todoNotifyTelegram}
              onChange={(e) => setTodoNotifyTelegram(e.target.checked)}
              className="rounded border-card-border"
            />
            {t("settings.todoNotifyTelegram")}
            <Status ok={data.integrations.telegram.isReady} />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={todoNotifyWhatsapp}
              onChange={(e) => setTodoNotifyWhatsapp(e.target.checked)}
              className="rounded border-card-border"
            />
            {t("settings.todoNotifyWhatsapp")}
            <Status ok={data.integrations.whatsapp.configured} />
          </label>
          <div>
            <label className="block text-sm text-muted">{t("settings.whatsappNotifyPhone")}</label>
            <input
              type="tel"
              value={whatsappNotifyPhone}
              onChange={(e) => setWhatsappNotifyPhone(e.target.value)}
              placeholder="+60123456789"
              className="mt-1 w-full max-w-xs rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t("settings.autoClientTitle")}
          description={t("settings.autoClientDesc")}
        />
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoCreateFromChat}
              onChange={(e) => setAutoCreateFromChat(e.target.checked)}
              className="rounded border-card-border"
            />
            {t("settings.autoCreateFromChat")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={notifyNewClientTelegram}
              onChange={(e) => setNotifyNewClientTelegram(e.target.checked)}
              className="rounded border-card-border"
            />
            {t("settings.notifyNewClientTelegram")}
            <Status ok={data.integrations.telegram.isReady} />
          </label>
          <div>
            <p className="text-xs font-medium text-muted">{t("settings.registerLinkLabel")}</p>
            <code className="mt-1 block truncate rounded-lg border border-card-border bg-background px-3 py-2 text-xs">
              {registerUrl || `${data.cronDigestUrl?.replace(/\/api\/digest.*/, "")}/register`}
            </code>
          </div>
        </div>
      </Card>

      <Card className="border-accent/20 bg-accent/5">
        <CardHeader
          title={t("settings.whatsappTitle")}
          description={t("settings.whatsappDesc")}
        />
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>WhatsApp API</span>
            <Status ok={data.integrations.whatsapp.configured} />
          </div>
          {data.whatsappPublicUrlWarning && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              {t("settings.whatsappPublicWarning")}
            </p>
          )}
          <p className="text-xs text-muted">{t("settings.whatsappEnvKeys")}</p>
          <pre className="overflow-x-auto rounded-lg border border-card-border bg-background p-3 text-[11px] leading-relaxed">
{`WHATSAPP_ACCESS_TOKEN=从 Meta 复制
WHATSAPP_PHONE_NUMBER_ID=从 Meta 复制
WHATSAPP_VERIFY_TOKEN=自定义口令（Meta 验证用）
WHATSAPP_NOTIFY_PHONE=+60123456789`}
          </pre>
          <ol className="space-y-1 text-xs text-muted">
            <li>{t("settings.whatsappStep1")}</li>
            <li>{t("settings.whatsappStep2")}</li>
            <li>{t("settings.whatsappStep3")}</li>
            <li>{t("settings.whatsappStep4")}</li>
            <li>{t("settings.whatsappStep5")}</li>
          </ol>
          <div>
            <p className="text-xs font-medium text-muted">{t("settings.whatsappWebhookUrl")}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-card-border bg-background px-3 py-2 text-xs">
                {data.whatsappWebhookUrl ?? `${data.appUrl ?? ""}/api/webhooks/whatsapp`}
              </code>
              <button
                type="button"
                onClick={copyWebhookUrl}
                className="rounded-lg border border-card-border px-3 py-2 text-xs text-accent"
              >
                {webhookCopied ? t("settings.whatsappCopied") : t("settings.whatsappCopyWebhook")}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted">
            {t("settings.whatsappVerifyToken")}:{" "}
            <Status ok={Boolean(data.whatsappVerifyTokenSet)} />
            {" — "}
            {t("settings.whatsappVerifyTokenHint")}
          </p>
          <button
            type="button"
            onClick={testWhatsApp}
            disabled={whatsappTesting || !data.integrations.whatsapp.configured}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
          >
            {whatsappTesting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("settings.whatsappTestSend")}
          </button>
          {whatsappTestMsg && (
            <p className={`text-xs ${whatsappTestMsg.includes("失败") || whatsappTestMsg.includes("failed") || whatsappTestMsg.includes("Add ") ? "text-danger" : "text-success"}`}>
              {whatsappTestMsg}
            </p>
          )}
        </div>
      </Card>

      <Card className="border-accent/20 bg-accent/5">
        <CardHeader title={t("settings.xhsTitle")} description={t("settings.xhsDesc")} />
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>小红书 API</span>
            <Status ok={Boolean(data.integrations.social.xiaohongshu)} />
          </div>
          <ol className="space-y-1 text-xs text-muted">
            <li>{t("settings.xhsStep1")}</li>
            <li>{t("settings.xhsStep2")}</li>
            <li>{t("settings.xhsStep3")}</li>
            <li>{t("settings.xhsStep4")}</li>
          </ol>
          <p className="text-xs text-muted">{t("settings.xhsEnvKeys")}</p>
          <pre className="overflow-x-auto rounded-lg border border-card-border bg-background p-3 text-[11px]">
{`XHS_APP_KEY=从开放平台复制
XHS_APP_SECRET=从开放平台复制
XHS_ACCESS_TOKEN=可选（直接填 token）`}
          </pre>
          <a
            href="/dashboard/social-media"
            className="inline-block text-xs text-accent hover:underline"
          >
            → {t("nav.socialMedia")}
          </a>
        </div>
      </Card>

      <Card className="border-accent/20 bg-accent/5">
        <CardHeader title={t("settings.douyinTitle")} description={t("settings.douyinDesc")} />
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>抖音（手动复制）</span>
            <Status ok={Boolean(data.integrations.social.douyin)} />
          </div>
          <ol className="space-y-1 text-xs text-muted">
            <li>{t("settings.douyinStep1")}</li>
            <li>{t("settings.douyinStep2")}</li>
            <li>{t("settings.douyinStep3")}</li>
            <li>{t("settings.douyinStep4")}</li>
          </ol>
          <p className="text-xs text-muted">{t("settings.douyinEnvKeys")}</p>
          <pre className="overflow-x-auto rounded-lg border border-card-border bg-background p-3 text-[11px]">
{`DOUYIN_CLIENT_KEY=从开放平台复制
DOUYIN_CLIENT_SECRET=从开放平台复制
DOUYIN_ACCESS_TOKEN=可选（直接填 token）`}
          </pre>
          <a
            href="/dashboard/social-media"
            className="inline-block text-xs text-accent hover:underline"
          >
            → {t("nav.socialMedia")}
          </a>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t("settings.openclawTitle")}
          description={t("settings.openclawDesc")}
        />
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={autoReplyEnabled}
              onChange={(e) => setAutoReplyEnabled(e.target.checked)}
              className="rounded border-card-border"
            />
            {t("settings.openclawEnable")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm pl-6">
            <input
              type="checkbox"
              checked={autoReplyWhatsApp}
              disabled={!autoReplyEnabled}
              onChange={(e) => setAutoReplyWhatsApp(e.target.checked)}
              className="rounded border-card-border"
            />
            {t("settings.openclawWhatsApp")}
            <Status ok={data.integrations.whatsapp.configured} />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm pl-6">
            <input
              type="checkbox"
              checked={autoReplyWeChat}
              disabled={!autoReplyEnabled}
              onChange={(e) => setAutoReplyWeChat(e.target.checked)}
              className="rounded border-card-border"
            />
            {t("settings.openclawWeChat")}
            <Status ok={data.integrations.wechatWork.canSend} />
          </label>
          <p className="text-xs text-muted">
            {t("settings.openclawProvider")}:{" "}
            <code className="rounded bg-background px-1">
              {data.integrations.openclaw?.provider ?? "auto"}
            </code>
            {" · "}
            {data.integrations.openclaw?.gatewayUrl ?? "http://127.0.0.1:18789"}
          </p>
          <p className="text-xs text-muted">{t("settings.openclawSetup")}</p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t("settings.replyAgentTitle")}
          description={t("settings.replyAgentDesc")}
        />
        <AgentKnowledgeUpload />
        <textarea
          value={replyAgentPrompt}
          onChange={(e) => setReplyAgentPrompt(e.target.value)}
          rows={8}
          placeholder={t("settings.replyAgentPlaceholder")}
          className="mt-3 w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm min-h-[140px] resize-y"
        />
        <p className="mt-2 text-xs text-muted">
          <a href="/dashboard/ai-assistant" className="text-accent hover:underline">
            Reply Agent
          </a>
        </p>
      </Card>

      <Card>
        <CardHeader title={t("settings.dailyDigest")} description={t("settings.dailyDigestDesc")} />
        <div className="space-y-3">
          <label className="block text-sm text-muted">{t("settings.digestHour")}</label>
          <input
            type="number"
            min={0}
            max={23}
            value={digestHour}
            onChange={(e) => setDigestHour(Number(e.target.value))}
            className="w-24 rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
          />
          <label className="block text-sm text-muted">{t("settings.defaultCurrency")}</label>
          <select
            value={defaultCurrency}
            onChange={(e) => setDefaultCurrency(e.target.value as "MYR" | "CNY")}
            className="w-32 rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
          >
            <option value="MYR">MYR</option>
            <option value="CNY">CNY</option>
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={financeAutoMode}
              onChange={(e) => setFinanceAutoMode(e.target.checked)}
              className="rounded border-card-border"
            />
            {t("settings.financeAutoMode")}
          </label>
          <p className="text-xs text-muted">{t("settings.financeAutoModeDesc")}</p>
          <label className="block text-sm text-muted">{t("settings.financeStartMonth")}</label>
          <input
            type="month"
            value={financeStartMonth}
            onChange={(e) => setFinanceStartMonth(e.target.value)}
            className="w-40 rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted">{t("settings.financeStartMonthDesc")}</p>
          <p className="text-xs text-muted break-all">{data.cronDigestUrl}</p>
          <p className="text-xs text-muted break-all">{data.cronEmailUrl}</p>
          <p className="text-xs text-muted break-all">{t("settings.cronFinance")}: {data.cronFinanceUrl}</p>
          <p className="text-xs text-muted break-all">{t("settings.cronSocial")}: {data.cronSocialUrl}</p>
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
          >
            {saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : t("common.save")}
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("settings.dataStorage")} description={t("settings.dataStorageDesc")} />
        <ul className="space-y-1 text-sm text-muted">
          <li>data/personal-assistant.json</li>
          <li>data/personal-finance.json</li>
          <li>data/crm.json</li>
          <li>data/settings.json</li>
          <li>data/conversations.json</li>
          <li>data/social-posts.json</li>
          <li>data/receipts/</li>
        </ul>
      </Card>
    </div>
  );
}
