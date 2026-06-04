"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";

type TelegramStatus = {
  config: { hasToken: boolean; hasChatId: boolean; isReady: boolean };
  bot: { id: number; username: string; first_name: string } | null;
  botError: string | null;
  chats: {
    chatId: string;
    type: string;
    title?: string;
    username?: string;
    firstName?: string;
  }[];
  chatsError: string | null;
  error?: string;
};

export function TelegramConnect() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message?: string;
    error?: string;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    ok: boolean;
    message?: string;
    error?: string;
  } | null>(null);
  const [manualChatId, setManualChatId] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/status");
      setStatus(await res.json());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/telegram/sync", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSyncResult({ ok: true, message: data.message });
        await loadStatus();
      } else {
        setSyncResult({ ok: false, error: data.error ?? "Sync failed" });
      }
    } catch {
      setSyncResult({ ok: false, error: "Could not reach server" });
    } finally {
      setSyncing(false);
    }
  }

  async function handleTest(overrideChatId?: string) {
    setTesting(true);
    setTestResult(null);
    try {
      const chatId = overrideChatId?.trim() || manualChatId.trim() || undefined;
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatId ? { chatId } : {}),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, message: data.message });
      } else {
        setTestResult({ ok: false, error: data.error ?? "Test failed" });
      }
    } catch {
      setTestResult({ ok: false, error: "Could not reach server" });
    } finally {
      setTesting(false);
    }
  }

  const config = status?.config;

  return (
    <Card>
      <CardHeader
        title="Telegram Connection"
        description="Connect your bot for team follow-up reminders"
        action={
          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-accent hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {loading && !status ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking connection…
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatusRow
              label="Bot token"
              ok={config?.hasToken ?? false}
              detail={config?.hasToken ? "Configured" : "Missing in .env.local"}
            />
            <StatusRow
              label="Chat ID"
              ok={config?.hasChatId ?? false}
              detail={config?.hasChatId ? "Configured" : "Missing in .env.local"}
            />
            <StatusRow
              label="Ready to send"
              ok={config?.isReady ?? false}
              detail={config?.isReady ? "All set" : "Complete setup below"}
            />
          </div>

          {status?.bot && (
            <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm space-y-3">
              <div>
                <p className="font-medium text-success">Bot connected</p>
                <p className="mt-1 text-foreground/80">
                  @{status.bot.username} ({status.bot.first_name})
                </p>
              </div>
              <a
                href={`https://t.me/${status.bot.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted"
              >
                Open @{status.bot.username} in Telegram
              </a>
              <p className="text-xs text-muted">
                Must be this exact bot. Telegram currently shows no messages received yet.
              </p>
            </div>
          )}

          {status?.botError && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {status.botError}
            </div>
          )}

          {status?.error && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              {status.error}
            </div>
          )}

          <div className="rounded-lg border border-card-border bg-background/50 p-4">
            <p className="text-sm font-medium text-foreground">Setup steps</p>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted">
              <li>
                Open Telegram, search <strong className="text-foreground">@BotFather</strong>,
                send <code className="rounded bg-card px-1">/newbot</code>, and copy the token.
              </li>
              <li>
                Add to <code className="rounded bg-card px-1">.env.local</code>:{" "}
                <code className="rounded bg-card px-1">TELEGRAM_BOT_TOKEN=your_token</code>
              </li>
              <li>
                In Telegram, open <strong className="text-foreground">@assistants66bot</strong>{" "}
                and tap <strong className="text-foreground">Start</strong> (or send{" "}
                <code className="rounded bg-card px-1">/start</code>).
              </li>
              <li>
                Click <strong className="text-foreground">Get my Chat ID</strong> — the bot
                will reply in Telegram with your ID (it does not chat back on its own).
              </li>
              <li>Click Refresh — your Chat ID will also appear here.</li>
              <li>
                Add <code className="rounded bg-card px-1">TELEGRAM_CHAT_ID=...</code> to{" "}
                <code className="rounded bg-card px-1">.env.local</code> and restart{" "}
                <code className="rounded bg-card px-1">npm run dev</code>.
              </li>
            </ol>
          </div>

          {status?.chats && status.chats.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">
                Detected chat IDs (copy one into .env.local)
              </p>
              <div className="space-y-2">
                {status.chats.map((chat) => (
                  <div
                    key={chat.chatId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-card-border bg-background/50 px-4 py-3"
                  >
                    <div>
                      <code className="text-sm font-mono text-accent">{chat.chatId}</code>
                      <p className="text-xs text-muted">
                        {chat.type}
                        {chat.title && ` · ${chat.title}`}
                        {chat.username && ` · @${chat.username}`}
                        {chat.firstName && ` · ${chat.firstName}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(chat.chatId)}
                      className="text-xs text-accent hover:underline"
                    >
                      Copy ID
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status?.chatsError && (!status.chats || status.chats.length === 0) && config?.hasToken && (
            <p className="text-sm text-muted">{status.chatsError}</p>
          )}

          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <p className="text-sm font-medium text-foreground">Manual setup (if bot won&apos;t reply)</p>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted">
              <li>
                Open <a href="https://t.me/assistants66bot" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">t.me/assistants66bot</a> and tap <strong className="text-foreground">Start</strong>.
              </li>
              <li>
                In Telegram, search <strong className="text-foreground">@userinfobot</strong> or{" "}
                <strong className="text-foreground">@getidsbot</strong> — it will show your numeric ID.
              </li>
              <li>Paste that ID below and click <strong className="text-foreground">Send test</strong>.</li>
              <li>
                Add the same ID to <code className="rounded bg-card px-1">.env.local</code> as{" "}
                <code className="rounded bg-card px-1">TELEGRAM_CHAT_ID=...</code> and restart{" "}
                <code className="rounded bg-card px-1">npm run dev</code>.
              </li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="text"
                value={manualChatId}
                onChange={(e) => setManualChatId(e.target.value)}
                placeholder="Your Chat ID e.g. 123456789"
                className="min-w-[200px] flex-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60"
              />
              <button
                type="button"
                onClick={() => handleTest(manualChatId)}
                disabled={testing || !manualChatId.trim() || !config?.hasToken}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send test
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || !config?.hasToken}
              className="flex items-center gap-2 rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50 transition-colors"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Get my Chat ID
            </button>
            <button
              type="button"
              onClick={() => handleTest()}
              disabled={testing || !config?.isReady}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50 transition-colors"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send test message
            </button>
            {!config?.isReady && (
              <Badge variant="warning">Configure .env.local first</Badge>
            )}
          </div>

          {syncResult && (
            <div
              className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
                syncResult.ok
                  ? "border border-success/30 bg-success/10 text-success"
                  : "border border-danger/30 bg-danger/10 text-danger"
              }`}
            >
              {syncResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{syncResult.ok ? syncResult.message : syncResult.error}</span>
            </div>
          )}

          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
                testResult.ok
                  ? "border border-success/30 bg-success/10 text-success"
                  : "border border-danger/30 bg-danger/10 text-danger"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{testResult.ok ? testResult.message : testResult.error}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-card-border bg-background/50 px-4 py-3">
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <XCircle className="h-4 w-4 text-muted" />
        )}
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}
