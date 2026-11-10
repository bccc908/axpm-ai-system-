import { readFile } from "fs/promises";
import path from "path";
import { buildOpsFloorSummary, emptyOpsFloorSources } from "@/lib/ops-floor/build-summary";
import type {
  BillLite,
  OpsTickerPrice,
  BridgePoll,
  CrmReminderLite,
  FollowUpLite,
  GroktagonLite,
  InboxLite,
  JobLite,
  MarketMessageLite,
  OpsFloorSummary,
  ReceiptLite,
  SignalDeskId,
  SignalLite,
  SocialPostLite,
  TeamTaskLite,
  TodoLite,
} from "@/lib/ops-floor/types";

const DESK_FILES: Record<SignalDeskId, string> = {
  gold: "gold-signals.json",
  xau: "xau-signals.json",
  spread: "gold-spread-signals.json",
  btc: "btc-signals.json",
  eth: "eth-signals.json",
  hl: "hl-signals.json",
};

type LoadOptions = {
  dataDir?: string;
  now?: Date;
  env?: Record<string, string | undefined>;
  /** Tests skip outbound quote calls. The floor still gets signal or demo prices. */
  skipQuotes?: boolean;
};

export async function loadOpsFloorSummary(options: LoadOptions = {}): Promise<OpsFloorSummary> {
  const now = options.now ?? new Date();
  const dataDir = options.dataDir ?? path.join(process.cwd(), "data");
  const env = options.env ?? process.env;
  try {
    const sources = emptyOpsFloorSources(now);
    await Promise.all(
      (Object.keys(DESK_FILES) as SignalDeskId[]).map(async (desk) => {
        sources.signals[desk] = readSignals(await readJson(dataDir, DESK_FILES[desk]));
      }),
    );

    const personal = asRecord(await readJson(dataDir, "personal-assistant.json"));
    sources.todos = readTodos(personal?.todos);
    sources.jobs = readJobs(personal?.jobs);

    const crm = asRecord(await readJson(dataDir, "crm.json"));
    sources.followUps = readFollowUps(crm?.followUps);
    sources.reminders = readReminders(crm?.reminders);
    sources.tasks = readTasks(crm?.tasks);

    const finance = asRecord(await readJson(dataDir, "personal-finance.json"));
    sources.bills = readBills(finance?.paymentReminders);
    sources.receipts = readReceipts(finance?.receipts);

    sources.inbox = readInbox(await readJson(dataDir, "inbox-sessions.json"));
    if (sources.inbox.length === 0) {
      sources.inbox = inboxFromConversations(await readJson(dataDir, "conversations.json"));
    }

    const social = asRecord(await readJson(dataDir, "social-posts.json"));
    sources.socialPosts = readPosts(social?.posts);

    const market = asRecord(await readJson(dataDir, "market-chat.json"));
    sources.marketMessages = readMarket(market?.messages);

    sources.groktagon = readGroktagon(await readJson(dataDir, "groktagon-autopilot.json"));
    sources.bridgePolls = readPolls(await readJson(dataDir, "bridge-polls.json"));
    sources.hyperliquidConfigured = hyperliquidConfigured(
      await readJson(dataDir, "settings.json"),
      env.HYPERLIQUID_ADDRESS,
    );
    sources.telegramReady = Boolean(env.TELEGRAM_BOT_TOKEN?.trim() && env.TELEGRAM_CHAT_ID?.trim());
    sources.localApiKeyConfigured = Boolean(env.LOCAL_API_KEY?.trim());
    sources.socialConfiguredCount = countSocial(env);
    sources.prices = await resolveTickerPrices(sources.signals, options.skipQuotes === true);

    return buildOpsFloorSummary(sources);
  } catch {
    return buildOpsFloorSummary(emptyOpsFloorSources(now));
  }
}

async function readJson(dir: string, name: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path.join(dir, name), "utf8")) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function strOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numOrNull(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function readSignals(value: unknown): SignalLite[] {
  const record = asRecord(value);
  return asArray(record?.signals)
    .map((row) => {
      const item = asRecord(row);
      if (!item) return null;
      const created_at = str(item.created_at);
      const symbol = str(item.symbol);
      if (!created_at || !symbol) return null;
      const zone = asRecord(item.entry_zone);
      const low = numOrNull(zone?.low);
      const high = numOrNull(zone?.high);
      const signal: SignalLite = {
        id: str(item.id) || `${symbol}:${created_at}`,
        created_at,
        symbol,
        bias: str(item.bias) || "wait",
        spot_price: numOrNull(item.spot_price),
        entry_zone: low != null && high != null ? { low, high } : null,
        stop_loss: numOrNull(item.stop_loss),
        take_profit: asArray(item.take_profit).map(numOrNull).filter((n): n is number => n != null),
        thesis: strOrNull(item.thesis),
        expires_at: strOrNull(item.expires_at),
      };
      return signal;
    })
    .filter((row): row is SignalLite => row !== null);
}

function readTodos(value: unknown): TodoLite[] {
  return asArray(value)
    .map((row) => {
      const item = asRecord(row);
      if (!item || !str(item.title)) return null;
      const todo: TodoLite = {
        id: str(item.id) || str(item.title),
        title: str(item.title),
        done: Boolean(item.done),
        due_at: strOrNull(item.due_at),
        completed_at: strOrNull(item.completed_at),
        created_at: str(item.created_at) || str(item.completed_at) || new Date(0).toISOString(),
      };
      return todo;
    })
    .filter((row): row is TodoLite => row !== null);
}

function readJobs(value: unknown): JobLite[] {
  return asArray(value)
    .map((row) => {
      const item = asRecord(row);
      if (!item || !str(item.title)) return null;
      const job: JobLite = {
        id: str(item.id) || str(item.title),
        title: str(item.title),
        status: str(item.status) || "todo",
        due_at: strOrNull(item.due_at),
        completed_at: strOrNull(item.completed_at),
        updated_at: str(item.updated_at) || str(item.created_at) || new Date(0).toISOString(),
      };
      return job;
    })
    .filter((row): row is JobLite => row !== null);
}

function readFollowUps(value: unknown): FollowUpLite[] {
  return asArray(value)
    .map((row) => {
      const item = asRecord(row);
      if (!item) return null;
      const notes = str(item.notes);
      const summary = strOrNull(item.summary);
      if (!notes && !summary) return null;
      const follow: FollowUpLite = {
        id: str(item.id) || summary || notes,
        notes,
        summary,
        scheduled_at: strOrNull(item.scheduled_at),
        completed_at: strOrNull(item.completed_at),
        created_at: str(item.created_at) || new Date(0).toISOString(),
      };
      return follow;
    })
    .filter((row): row is FollowUpLite => row !== null);
}

function readReminders(value: unknown): CrmReminderLite[] {
  return asArray(value)
    .map((row) => {
      const item = asRecord(row);
      if (!item || !str(item.title) || !str(item.scheduled_at)) return null;
      const reminder: CrmReminderLite = {
        id: str(item.id) || str(item.title),
        title: str(item.title),
        message: str(item.message),
        scheduled_at: str(item.scheduled_at),
        sent_at: strOrNull(item.sent_at),
        created_at: str(item.created_at) || str(item.scheduled_at),
      };
      return reminder;
    })
    .filter((row): row is CrmReminderLite => row !== null);
}

function readTasks(value: unknown): TeamTaskLite[] {
  return asArray(value)
    .map((row) => {
      const item = asRecord(row);
      if (!item || !str(item.title)) return null;
      const task: TeamTaskLite = {
        id: str(item.id) || str(item.title),
        title: str(item.title),
        status: str(item.status) || "pending",
        due_at: strOrNull(item.due_at),
        created_at: str(item.created_at) || new Date(0).toISOString(),
      };
      return task;
    })
    .filter((row): row is TeamTaskLite => row !== null);
}

function readBills(value: unknown): BillLite[] {
  return asArray(value)
    .map((row) => {
      const item = asRecord(row);
      const due = numOrNull(item?.due_day);
      if (!item || !str(item.title) || due == null) return null;
      const bill: BillLite = {
        id: str(item.id) || str(item.title),
        title: str(item.title),
        amount: numOrNull(item.amount),
        currency: str(item.currency) || "USD",
        due_day: due,
        remind_days_before: numOrNull(item.remind_days_before) ?? 3,
        is_active: item.is_active !== false,
        last_paid_at: strOrNull(item.last_paid_at),
      };
      return bill;
    })
    .filter((row): row is BillLite => row !== null);
}

function readReceipts(value: unknown): ReceiptLite[] {
  return asArray(value)
    .map((row) => {
      const item = asRecord(row);
      if (!item || !str(item.created_at)) return null;
      const receipt: ReceiptLite = {
        id: str(item.id) || str(item.created_at),
        merchant: strOrNull(item.merchant),
        amount: numOrNull(item.amount),
        currency: strOrNull(item.currency),
        created_at: str(item.created_at),
      };
      return receipt;
    })
    .filter((row): row is ReceiptLite => row !== null);
}

function readInbox(value: unknown): InboxLite[] {
  const record = asRecord(value);
  return asArray(record?.sessions)
    .map((row) => {
      const item = asRecord(row);
      if (!item || !str(item.last_message_at)) return null;
      const session: InboxLite = {
        id: str(item.id) || str(item.last_message_at),
        client_name: str(item.client_name) || "Client",
        last_preview: str(item.last_preview),
        last_message_at: str(item.last_message_at),
        unread_count: numOrNull(item.unread_count) ?? 0,
        status: str(item.status) || "open",
      };
      return session;
    })
    .filter((row): row is InboxLite => row !== null);
}

function inboxFromConversations(value: unknown): InboxLite[] {
  const record = asRecord(value);
  const grouped = new Map<string, InboxLite>();
  for (const row of asArray(record?.messages)) {
    const item = asRecord(row);
    if (!item) continue;
    const at = str(item.sent_at) || str(item.created_at);
    if (!at) continue;
    const key = str(item.client_id) || str(item.client_name) || str(item.id);
    const current = grouped.get(key);
    if (current && Date.parse(current.last_message_at) > Date.parse(at)) continue;
    grouped.set(key, {
      id: str(item.id) || key,
      client_name: str(item.client_name) || "Client",
      last_preview: str(item.content),
      last_message_at: at,
      unread_count: str(item.direction) === "inbound" ? 1 : 0,
      status: "open",
    });
  }
  return [...grouped.values()];
}

function readPosts(value: unknown): SocialPostLite[] {
  return asArray(value)
    .map((row) => {
      const item = asRecord(row);
      if (!item || !str(item.title)) return null;
      const post: SocialPostLite = {
        id: str(item.id) || str(item.title),
        title: str(item.title),
        status: str(item.status) || "draft",
        scheduled_at: strOrNull(item.scheduled_at),
        published_at: strOrNull(item.published_at),
        updated_at: str(item.updated_at) || str(item.created_at) || new Date(0).toISOString(),
      };
      return post;
    })
    .filter((row): row is SocialPostLite => row !== null);
}

function readMarket(value: unknown): MarketMessageLite[] {
  return asArray(value)
    .map((row) => {
      const item = asRecord(row);
      if (!item || !str(item.content) || !str(item.created_at)) return null;
      const message: MarketMessageLite = {
        id: str(item.id) || str(item.created_at),
        role: str(item.role) || "assistant",
        content: str(item.content),
        created_at: str(item.created_at),
        fallback: Boolean(item.fallback),
      };
      return message;
    })
    .filter((row): row is MarketMessageLite => row !== null);
}

function readGroktagon(value: unknown): GroktagonLite | null {
  const item = asRecord(value);
  if (!item) return null;
  if (
    item.enabled == null &&
    item.last_run_at == null &&
    item.last_result == null &&
    item.last_fired == null
  ) {
    return null;
  }
  return {
    enabled: Boolean(item.enabled),
    last_run_at: strOrNull(item.last_run_at),
    last_result: strOrNull(item.last_result),
    last_fired: Boolean(item.last_fired),
  };
}

function readPolls(value: unknown): Partial<Record<"mt5" | "atas" | "bookmap", BridgePoll>> {
  const item = asRecord(value);
  if (!item) return {};
  const polls: Partial<Record<"mt5" | "atas" | "bookmap", BridgePoll>> = {};
  for (const name of ["mt5", "atas", "bookmap"] as const) {
    const raw = item[name];
    if (typeof raw === "string" && raw.trim()) {
      polls[name] = { at: raw, ok: true };
      continue;
    }
    const row = asRecord(raw);
    const at = str(row?.at);
    if (!at) continue;
    polls[name] = { at, ok: row?.ok !== false };
  }
  return polls;
}

function hyperliquidConfigured(settings: unknown, envAddress: string | undefined) {
  const item = asRecord(settings);
  const fromFile = str(item?.hyperliquidAddress);
  return isAddress(fromFile) || isAddress(envAddress ?? "");
}

function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

const DEMO_TICKER: OpsTickerPrice[] = [
  { symbol: "XAUUSD", price: 2650.4, change_pct: 0.18, source: "demo" },
  { symbol: "BTCUSD", price: 68420, change_pct: -0.42, source: "demo" },
  { symbol: "ETHUSD", price: 3420, change_pct: 0.11, source: "demo" },
];

async function resolveTickerPrices(
  signals: { gold: { spot_price: number | null; created_at: string }[]; btc: { spot_price: number | null; created_at: string }[]; eth: { spot_price: number | null; created_at: string }[] },
  skipQuotes: boolean,
): Promise<OpsTickerPrice[]> {
  const spots = {
    XAUUSD: newestSpot(signals.gold),
    BTCUSD: newestSpot(signals.btc),
    ETHUSD: newestSpot(signals.eth),
  };
  const live = skipQuotes ? null : await liveQuotes();
  return (["XAUUSD", "BTCUSD", "ETHUSD"] as const).map((symbol) => {
    const quote = live?.[symbol];
    if (quote && Number.isFinite(quote.price)) {
      return { symbol, price: quote.price, change_pct: quote.change_pct, source: "live" as const };
    }
    const spot = spots[symbol];
    if (spot != null) return { symbol, price: spot, change_pct: null, source: "signal" as const };
    return DEMO_TICKER.find((row) => row.symbol === symbol) ?? DEMO_TICKER[0];
  });
}

function newestSpot(rows: { spot_price: number | null; created_at: string }[]) {
  let best: number | null = null;
  let bestMs = -Infinity;
  for (const row of rows) {
    const ms = Date.parse(row.created_at);
    if (!Number.isFinite(ms) || row.spot_price == null || !Number.isFinite(row.spot_price)) continue;
    if (ms >= bestMs) {
      best = row.spot_price;
      bestMs = ms;
    }
  }
  return best;
}

async function liveQuotes(): Promise<Partial<Record<OpsTickerPrice["symbol"], { price: number; change_pct: number | null }>> | null> {
  try {
    const [goldMod, btcMod, ethMod] = await Promise.all([
      import("@/lib/gold-signals/price"),
      import("@/lib/btc-signals/price"),
      import("@/lib/eth-signals/price"),
    ]);
    const [gold, btc, eth] = await Promise.all([
      withTimeout(goldMod.fetchGoldSpotQuote()),
      withTimeout(btcMod.fetchBtcSpotQuote()),
      withTimeout(ethMod.fetchEthSpotQuote()),
    ]);
    return {
      XAUUSD: gold ? { price: gold.price, change_pct: gold.change_pct } : undefined,
      BTCUSD: btc ? { price: btc.price, change_pct: btc.change_pct } : undefined,
      ETHUSD: eth ? { price: eth.price, change_pct: eth.change_pct } : undefined,
    };
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T | null>, ms = 1200): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(null))
      .finally(() => clearTimeout(timer));
  });
}

function countSocial(env: Record<string, string | undefined>) {
  let count = 0;
  if (env.META_PAGE_ID?.trim() && env.META_PAGE_ACCESS_TOKEN?.trim()) count += 1;
  if (env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim() && env.META_PAGE_ACCESS_TOKEN?.trim()) count += 1;
  if (env.TIKTOK_ACCESS_TOKEN?.trim()) count += 1;
  if (env.WECHAT_OA_APP_ID?.trim() && env.WECHAT_OA_APP_SECRET?.trim()) count += 1;
  if (env.WEIBO_ACCESS_TOKEN?.trim()) count += 1;
  if (env.DOUYIN_ACCESS_TOKEN?.trim() || (env.DOUYIN_CLIENT_KEY?.trim() && env.DOUYIN_CLIENT_SECRET?.trim())) {
    count += 1;
  }
  if (env.XHS_ACCESS_TOKEN?.trim() || (env.XHS_APP_KEY?.trim() && env.XHS_APP_SECRET?.trim())) count += 1;
  return count;
}
