import type {
  AgentStatus,
  OpsFloorSummary,
  BillLite,
  BridgePoll,
  FollowUpLite,
  GroktagonLite,
  InboxLite,
  IntegrationHealth,
  JobLite,
  MarketMessageLite,
  OpsActivityEvent,
  OpsAgent,
  OpsFloorSources,
  OpsReminderItem,
  OpsSignalTip,
  ReceiptLite,
  ReminderSource,
  SignalDeskId,
  SignalLite,
  SocialPostLite,
  TeamTaskLite,
  TodoLite,
} from "@/lib/ops-floor/types";

const TZ = "Asia/Hong_Kong";
const FRESH_MS = 18 * 60 * 60 * 1000;
const STALE_MS = 36 * 60 * 60 * 1000;
const LIST_CAP = 12;
const ACTIVITY_CAP = 16;

const FLOORS = [
  { index: 0, name_en: "Lobby & reception", name_zh: "大堂与客户接待" },
  { index: 1, name_en: "Gold trading desk", name_zh: "黄金交易台" },
  { index: 2, name_en: "Crypto & Groktagon", name_zh: "加密与 Groktagon" },
  { index: 3, name_en: "CRM & IB team", name_zh: "客户服务与 IB" },
  { index: 4, name_en: "CEO office & finance", name_zh: "总裁办公室与财务" },
] as const;

const DEMO_PRICES: OpsFloorSummary["prices"] = [
  { symbol: "XAUUSD", price: 2650.4, change_pct: 0.18, source: "demo" },
  { symbol: "BTCUSD", price: 68420, change_pct: -0.42, source: "demo" },
  { symbol: "ETHUSD", price: 3420, change_pct: 0.11, source: "demo" },
];

const DESKS: Array<{
  id: SignalDeskId;
  name_en: string;
  name_zh: string;
  tab: string;
  symbol: string;
}> = [
  { id: "gold", name_en: "Gold", name_zh: "黄金", tab: "gold", symbol: "XAUUSD" },
  { id: "xau", name_en: "XAUUSDT", name_zh: "XAUUSDT", tab: "xau", symbol: "XAUUSDT" },
  { id: "spread", name_en: "Gold spread", name_zh: "黄金价差", tab: "spread", symbol: "XAUUSD-XAUUSDT" },
  { id: "btc", name_en: "BTC", name_zh: "BTC", tab: "btc", symbol: "BTCUSD" },
  { id: "eth", name_en: "ETH", name_zh: "ETH", tab: "eth", symbol: "ETHUSD" },
  { id: "hl", name_en: "Hyperliquid", name_zh: "Hyperliquid", tab: "hl", symbol: "BTC-PERP" },
];

const ROSTER: Array<{
  id: string;
  name: string;
  floor: number;
  module:
    | "gold"
    | "xau"
    | "bridges"
    | "btc"
    | "eth"
    | "grok"
    | "followups"
    | "reminders"
    | "inbox"
    | "bills"
    | "usdt"
    | "receipts"
    | "market"
    | "social"
    | "todos";
  role_en: string;
  role_zh: string;
  href: string;
}> = [
  { id: "agent-1", name: "Atlas", floor: 1, module: "gold", role_en: "Gold signals", role_zh: "黄金信号", href: "/dashboard/gold-signals?tab=gold" },
  { id: "agent-2", name: "Nova", floor: 1, module: "xau", role_en: "XAUUSDT desk", role_zh: "XAUUSDT 交易台", href: "/dashboard/gold-signals?tab=xau" },
  { id: "agent-3", name: "Orion", floor: 1, module: "bridges", role_en: "MT5 · ATAS · Bookmap", role_zh: "MT5 · ATAS · Bookmap", href: "/dashboard/gold-signals?tab=gold" },
  { id: "agent-4", name: "Lyra", floor: 2, module: "btc", role_en: "BTC signals", role_zh: "BTC 信号", href: "/dashboard/gold-signals?tab=btc" },
  { id: "agent-5", name: "Vega", floor: 2, module: "eth", role_en: "ETH signals", role_zh: "ETH 信号", href: "/dashboard/gold-signals?tab=eth" },
  { id: "agent-6", name: "Echo", floor: 2, module: "grok", role_en: "Groktagon / Hyperliquid", role_zh: "Groktagon / Hyperliquid", href: "/dashboard/groktagon" },
  { id: "agent-7", name: "Juno", floor: 3, module: "followups", role_en: "CRM follow-ups", role_zh: "客户跟进", href: "/dashboard/crm" },
  { id: "agent-8", name: "AH BAO", floor: 3, module: "reminders", role_en: "CRM reminders", role_zh: "客户提醒", href: "/dashboard/reminders" },
  { id: "agent-9", name: "Pixel", floor: 0, module: "inbox", role_en: "Inbox & reply", role_zh: "收件箱与回复", href: "/dashboard/conversations" },
  { id: "agent-10", name: "Sage", floor: 4, module: "bills", role_en: "Bill reminders", role_zh: "账单提醒", href: "/dashboard/finance" },
  { id: "agent-11", name: "Bolt", floor: 4, module: "usdt", role_en: "USDT checker", role_zh: "USDT 查询", href: "/dashboard/usdt" },
  { id: "agent-12", name: "Iris", floor: 4, module: "receipts", role_en: "Receipts", role_zh: "收据", href: "/dashboard/finance?tab=receipts" },
  { id: "agent-13", name: "Rex", floor: 0, module: "market", role_en: "Market AI", role_zh: "市场 AI", href: "/dashboard/market-ai" },
  { id: "agent-14", name: "Zed", floor: 0, module: "social", role_en: "Social publisher", role_zh: "社媒发布", href: "/dashboard/social-media" },
  { id: "agent-15", name: "Mira", floor: 3, module: "todos", role_en: "Todos & assistant", role_zh: "待办与助理", href: "/dashboard/todos" },
];

export function emptyOpsFloorSources(now = new Date()): OpsFloorSources {
  return {
    now: now.toISOString(),
    signals: { gold: [], xau: [], spread: [], btc: [], eth: [], hl: [] },
    todos: [],
    jobs: [],
    followUps: [],
    reminders: [],
    tasks: [],
    bills: [],
    receipts: [],
    inbox: [],
    socialPosts: [],
    marketMessages: [],
    groktagon: null,
    hyperliquidConfigured: false,
    telegramReady: false,
    localApiKeyConfigured: false,
    socialConfiguredCount: 0,
    bridgePolls: {},
  };
}

function clip(text: string, max = 140) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function timeMs(value: string | null | undefined) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function dayKey(value: string | null | undefined) {
  const ms = timeMs(value);
  if (ms == null) return null;
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ });
}

function hkParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

function formatPx(value: number) {
  const digits = Math.abs(value) >= 100 ? 2 : 4;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function formatEntry(signal: SignalLite) {
  const zone = signal.entry_zone;
  if (zone && Number.isFinite(zone.low) && Number.isFinite(zone.high)) {
    if (zone.low === zone.high) return formatPx(zone.low);
    return `${formatPx(zone.low)}–${formatPx(zone.high)}`;
  }
  if (signal.spot_price != null && Number.isFinite(signal.spot_price)) return formatPx(signal.spot_price);
  return null;
}

function biasWord(bias: string): { en: string; zh: string } {
  const key = bias.toLowerCase();
  if (key === "long") return { en: "LONG", zh: "做多" };
  if (key === "short") return { en: "SHORT", zh: "做空" };
  if (key === "neutral") return { en: "NEUTRAL", zh: "中性" };
  if (key === "wait") return { en: "WAIT", zh: "观望" };
  return { en: bias.toUpperCase(), zh: bias };
}

function latestSignal(rows: SignalLite[]) {
  let best: SignalLite | null = null;
  let bestMs = -Infinity;
  for (const row of rows) {
    const ms = timeMs(row.created_at);
    if (ms == null) continue;
    if (ms >= bestMs) {
      best = row;
      bestMs = ms;
    }
  }
  return best;
}

function isOpenSignal(signal: SignalLite | null, now: number) {
  if (!signal) return false;
  const bias = signal.bias.toLowerCase();
  if (bias !== "long" && bias !== "short") return false;
  const expires = timeMs(signal.expires_at);
  if (expires != null && expires <= now) return false;
  return true;
}

function signalLine(signal: SignalLite) {
  const bias = biasWord(signal.bias);
  const entry = formatEntry(signal);
  const sl = signal.stop_loss != null ? `SL ${formatPx(signal.stop_loss)}` : "SL —";
  const tps = signal.take_profit.slice(0, 3).filter((n) => Number.isFinite(n)).map(formatPx);
  const tp = tps.length ? `TP ${tps.join("/")}` : "TP —";
  const core = `${signal.symbol} ${bias.en}${entry ? ` · ${entry}` : ""} · ${sl} · ${tp}`;
  const coreZh = `${signal.symbol} ${bias.zh}${entry ? ` · ${entry}` : ""} · ${sl} · ${tp}`;
  return { en: core, zh: coreZh };
}

function signalStatus(signal: SignalLite | null, now: number): { status: AgentStatus; en: string; zh: string } {
  if (!signal) return { status: "idle", en: "No signal yet", zh: "暂无信号" };
  const line = signalLine(signal);
  const created = timeMs(signal.created_at);
  const age = created == null ? Infinity : now - created;
  const expired = timeMs(signal.expires_at);
  if (expired != null && expired <= now) {
    return { status: "busy", en: clip(`Expired · ${line.en}`), zh: clip(`已过期 · ${line.zh}`) };
  }
  if (age <= FRESH_MS) return { status: "working", en: clip(line.en), zh: clip(line.zh) };
  if (age <= STALE_MS) return { status: "busy", en: clip(`Stale · ${line.en}`), zh: clip(`信号变旧 · ${line.zh}`) };
  return { status: "idle", en: clip(`No fresh signal · ${line.en}`), zh: clip(`无新信号 · ${line.zh}`) };
}

function ago(iso: string | null, now: number) {
  const ms = timeMs(iso);
  if (ms == null) return null;
  const mins = Math.max(0, Math.round((now - ms) / 60000));
  if (mins < 1) return { en: "just now", zh: "刚刚" };
  if (mins < 60) return { en: `${mins}m ago`, zh: `${mins} 分钟前` };
  const hours = Math.round(mins / 60);
  if (hours < 48) return { en: `${hours}h ago`, zh: `${hours} 小时前` };
  const days = Math.round(hours / 24);
  return { en: `${days}d ago`, zh: `${days} 天前` };
}

function looksLikeFailure(text: string | null) {
  if (!text) return false;
  return /\b(error|failed|failure|rejected|exception|denied)\b|失败|错误|拒绝|异常/i.test(text);
}

function billTiming(bill: BillLite, now: Date) {
  if (!bill.is_active || !Number.isFinite(bill.due_day)) {
    return { overdue: false, dueSoon: false, paid: false };
  }
  const hk = hkParts(now);
  const monthKey = `${hk.year}-${String(hk.month).padStart(2, "0")}`;
  const paidMonth = dayKey(bill.last_paid_at)?.slice(0, 7) ?? null;
  if (paidMonth === monthKey) return { overdue: false, dueSoon: false, paid: true };
  const remind = Number.isFinite(bill.remind_days_before) ? bill.remind_days_before : 3;
  if (hk.day > bill.due_day) return { overdue: true, dueSoon: true, paid: false };
  if (bill.due_day - hk.day <= remind) return { overdue: false, dueSoon: true, paid: false };
  return { overdue: false, dueSoon: false, paid: false };
}

function money(amount: number | null, currency: string | null) {
  if (amount == null || !Number.isFinite(amount)) return "";
  return `${currency ? `${currency} ` : ""}${formatPx(amount)}`;
}

function newest<T>(rows: T[], stamp: (row: T) => string | null) {
  return [...rows].sort((a, b) => (timeMs(stamp(b)) ?? 0) - (timeMs(stamp(a)) ?? 0));
}

function pushActivity(bucket: OpsActivityEvent[], event: OpsActivityEvent | null) {
  if (!event || !timeMs(event.at)) return;
  bucket.push(event);
}

function bridgeHealth(
  polls: OpsFloorSources["bridgePolls"],
  now: number,
  localKey: boolean,
): { status: AgentStatus; en: string; zh: string; integrations: IntegrationHealth[] } {
  const names = [
    { id: "mt5" as const, name_en: "MT5 bridge", name_zh: "MT5 桥接" },
    { id: "atas" as const, name_en: "ATAS bridge", name_zh: "ATAS 桥接" },
    { id: "bookmap" as const, name_en: "Bookmap bridge", name_zh: "Bookmap 桥接" },
  ];
  const integrations: IntegrationHealth[] = names.map((meta) => {
    const poll = polls[meta.id];
    return integrationFromPoll(meta.id, meta.name_en, meta.name_zh, poll, now, localKey);
  });
  const failed = names.find((meta) => polls[meta.id] && polls[meta.id]?.ok === false);
  if (failed && polls[failed.id]) {
    const when = ago(polls[failed.id]?.at ?? null, now);
    return {
      status: "error",
      en: clip(`${failed.name_en} last poll failed${when ? ` · ${when.en}` : ""}`),
      zh: clip(`${failed.name_zh}上次轮询失败${when ? ` · ${when.zh}` : ""}`),
      integrations,
    };
  }
  const stamps = names
    .map((meta) => ({ meta, poll: polls[meta.id] }))
    .filter((row): row is { meta: (typeof names)[number]; poll: BridgePoll } => Boolean(row.poll?.at));
  if (!stamps.length) {
    return {
      status: "idle",
      en: localKey ? "Bridge key set · no poll recorded yet" : "No bridge poll recorded",
      zh: localKey ? "桥接密钥已设置 · 还没有轮询记录" : "没有桥接轮询记录",
      integrations,
    };
  }
  stamps.sort((a, b) => (timeMs(b.poll.at) ?? 0) - (timeMs(a.poll.at) ?? 0));
  const newestPoll = stamps[0];
  const age = now - (timeMs(newestPoll.poll.at) ?? now);
  const partsEn = stamps
    .map((row) => `${row.meta.id.toUpperCase()} ${ago(row.poll.at, now)?.en ?? ""}`.trim())
    .join(" · ");
  const partsZh = stamps
    .map((row) => `${row.meta.id.toUpperCase()} ${ago(row.poll.at, now)?.zh ?? ""}`.trim())
    .join(" · ");
  if (age <= 2 * 60 * 60 * 1000) {
    return { status: "working", en: clip(partsEn), zh: clip(partsZh), integrations };
  }
  if (age <= 24 * 60 * 60 * 1000) {
    return { status: "busy", en: clip(`Quiet bridges · ${partsEn}`), zh: clip(`桥接偏静 · ${partsZh}`), integrations };
  }
  return { status: "idle", en: clip(`Last poll stale · ${partsEn}`), zh: clip(`轮询已久 · ${partsZh}`), integrations };
}

function integrationFromPoll(
  id: string,
  name_en: string,
  name_zh: string,
  poll: BridgePoll | undefined,
  now: number,
  localKey: boolean,
): IntegrationHealth {
  if (!poll?.at) {
    return {
      id,
      name_en,
      name_zh,
      status: "idle",
      detail_en: localKey ? "Key set, no poll yet" : "No poll recorded",
      detail_zh: localKey ? "密钥已设，尚未轮询" : "没有轮询记录",
      last_at: null,
    };
  }
  const when = ago(poll.at, now);
  if (poll.ok === false) {
    return {
      id,
      name_en,
      name_zh,
      status: "error",
      detail_en: when ? `Last poll failed · ${when.en}` : "Last poll failed",
      detail_zh: when ? `上次轮询失败 · ${when.zh}` : "上次轮询失败",
      last_at: poll.at,
    };
  }
  const age = now - (timeMs(poll.at) ?? now);
  const status = age <= 2 * 60 * 60 * 1000 ? "ok" : age <= 24 * 60 * 60 * 1000 ? "stale" : "idle";
  return {
    id,
    name_en,
    name_zh,
    status,
    detail_en: when ? `Last poll ${when.en}` : "Polled",
    detail_zh: when ? `上次轮询 ${when.zh}` : "已轮询",
    last_at: poll.at,
  };
}

function openJob(job: JobLite) {
  return job.status === "todo" || job.status === "in_progress";
}

function openTask(task: TeamTaskLite) {
  return task.status === "pending" || task.status === "in_progress";
}

function reminderItem(
  source: ReminderSource,
  id: string,
  title: string,
  detail_en: string,
  detail_zh: string,
  due_at: string | null,
  status: OpsReminderItem["status"],
  href: string,
): OpsReminderItem {
  return {
    id: `${source}:${id}`,
    source,
    title: clip(title, 80),
    detail_en: clip(detail_en, 120),
    detail_zh: clip(detail_zh, 120),
    due_at,
    status,
    href,
  };
}

export function buildOpsFloorSummary(sources: OpsFloorSources): OpsFloorSummary {
  const nowDate = new Date(sources.now);
  const now = Number.isFinite(nowDate.getTime()) ? nowDate.getTime() : Date.now();
  const today = dayKey(sources.now);

  const latest: Record<SignalDeskId, SignalLite | null> = {
    gold: latestSignal(sources.signals.gold),
    xau: latestSignal(sources.signals.xau),
    spread: latestSignal(sources.signals.spread),
    btc: latestSignal(sources.signals.btc),
    eth: latestSignal(sources.signals.eth),
    hl: latestSignal(sources.signals.hl),
  };

  const signals: OpsSignalTip[] = DESKS.map((desk) => {
    const row = latest[desk.id];
    return {
      id: row?.id ?? desk.id,
      desk: desk.id,
      name_en: desk.name_en,
      name_zh: desk.name_zh,
      symbol: row?.symbol || desk.symbol,
      bias: row?.bias ?? "wait",
      entry: row ? formatEntry(row) : null,
      stop_loss: row?.stop_loss ?? null,
      take_profit: row?.take_profit ?? [],
      time: row?.created_at ?? null,
      thesis: row?.thesis ? clip(row.thesis, 220) : null,
      href: `/dashboard/gold-signals?tab=${desk.tab}`,
    };
  });

  const openSignals = DESKS.filter((desk) => isOpenSignal(latest[desk.id], now)).length;
  const bridges = bridgeHealth(sources.bridgePolls, now, sources.localApiKeyConfigured);

  const overdueFollowUps = sources.followUps.filter((row) => {
    const due = timeMs(row.scheduled_at);
    return !row.completed_at && due != null && due <= now;
  });
  const openFollowUps = sources.followUps.filter((row) => !row.completed_at);
  const dueReminders = sources.reminders.filter((row) => !row.sent_at && (timeMs(row.scheduled_at) ?? Infinity) <= now);
  const futureReminders = sources.reminders.filter((row) => !row.sent_at && (timeMs(row.scheduled_at) ?? Infinity) > now);
  const overdueTodos = sources.todos.filter((row) => !row.done && (timeMs(row.due_at) ?? Infinity) <= now);
  const openTodos = sources.todos.filter((row) => !row.done);
  const overdueJobs = sources.jobs.filter((row) => openJob(row) && (timeMs(row.due_at) ?? Infinity) <= now);
  const openJobs = sources.jobs.filter(openJob);
  const overdueTasks = sources.tasks.filter((row) => openTask(row) && (timeMs(row.due_at) ?? Infinity) <= now);
  const openTeam = sources.tasks.filter(openTask);
  const dueBills = sources.bills.filter((bill) => {
    const timing = billTiming(bill, nowDate);
    return timing.overdue || timing.dueSoon;
  });
  const overdueBills = sources.bills.filter((bill) => billTiming(bill, nowDate).overdue);

  const unread = sources.inbox.reduce((sum, row) => sum + (row.unread_count > 0 ? row.unread_count : 0), 0);
  const openInbox = sources.inbox.filter((row) => row.status !== "closed");
  const failedPosts = sources.socialPosts.filter((row) => row.status === "failed");
  const duePosts = sources.socialPosts.filter((row) => row.status === "scheduled" && (timeMs(row.scheduled_at) ?? Infinity) <= now);
  const recentPosts = sources.socialPosts.filter((row) => {
    const at = timeMs(row.published_at);
    return row.status === "published" && at != null && now - at <= 7 * 24 * 60 * 60 * 1000;
  });

  const pendingTasks = openTodos.length + openJobs.length + openTeam.length;
  const doneToday =
    sources.todos.filter((row) => row.done && dayKey(row.completed_at) === today).length +
    sources.jobs.filter((row) => row.status === "done" && dayKey(row.completed_at) === today).length +
    sources.followUps.filter((row) => dayKey(row.completed_at) === today).length;
  const dueCount =
    overdueFollowUps.length +
    dueReminders.length +
    overdueTodos.length +
    overdueJobs.length +
    overdueTasks.length +
    dueBills.length;

  const teamTasks = {
    pending: sources.tasks.filter((row) => row.status === "pending").length,
    in_progress: sources.tasks.filter((row) => row.status === "in_progress").length,
    done: sources.tasks.filter((row) => row.status === "done").length,
    cancelled: sources.tasks.filter((row) => row.status === "cancelled").length,
  };

  const marketLast = newest(sources.marketMessages, (row) => row.created_at)[0] ?? null;
  const receiptLast = newest(sources.receipts, (row) => row.created_at)[0] ?? null;
  const inboxLast = newest(sources.inbox, (row) => row.last_message_at)[0] ?? null;
  const socialLast = newest(sources.socialPosts, (row) => row.published_at || row.updated_at)[0] ?? null;

  const agents = ROSTER.map((slot) => {
    const state = moduleState(slot.module, {
      latest,
      now,
      nowDate,
      bridges,
      sources,
      overdueFollowUps,
      openFollowUps,
      dueReminders,
      futureReminders,
      overdueTodos,
      openTodos,
      overdueJobs,
      openJobs,
      openTeam,
      dueBills,
      overdueBills,
      unread,
      openInbox,
      failedPosts,
      duePosts,
      recentPosts,
      marketLast,
      receiptLast,
      inboxLast,
      socialLast,
    });
    return {
      id: slot.id,
      name: slot.name,
      role_en: slot.role_en,
      role_zh: slot.role_zh,
      task_en: state.en,
      task_zh: state.zh,
      floor: slot.floor,
      status: state.status,
      href: slot.href,
    } satisfies OpsAgent;
  });

  const counts = { working: 0, busy: 0, idle: 0, error: 0 };
  for (const agent of agents) counts[agent.status] += 1;

  const live = hasLiveRecords(sources);
  const reminders = buildReminderLists({
    sources,
    now,
    nowDate,
    overdueFollowUps,
    openFollowUps,
    dueReminders,
    futureReminders,
    overdueTodos,
    openTodos,
    overdueJobs,
    openJobs,
    overdueTasks,
    openTeam,
    dueBills,
    overdueBills,
  });
  const activity = buildActivity({
    sources,
    latest,
    now,
    marketLast,
    receiptLast,
    inboxLast,
  });

  const integrations: IntegrationHealth[] = [
    ...bridges.integrations,
    {
      id: "hyperliquid",
      name_en: "Hyperliquid",
      name_zh: "Hyperliquid",
      status: sources.hyperliquidConfigured ? "ok" : "idle",
      detail_en: sources.hyperliquidConfigured ? "Address configured" : "No address configured",
      detail_zh: sources.hyperliquidConfigured ? "已配置地址" : "未配置地址",
      last_at: sources.groktagon?.last_run_at ?? null,
    },
    grokIntegration(sources.groktagon, sources.hyperliquidConfigured, now),
    {
      id: "telegram",
      name_en: "Telegram",
      name_zh: "Telegram",
      status: sources.telegramReady ? "ok" : "idle",
      detail_en: sources.telegramReady ? "Bot token and chat configured" : "Bot token or chat missing",
      detail_zh: sources.telegramReady ? "机器人与会话已配置" : "缺少机器人令牌或会话",
      last_at: null,
    },
  ];

  return {
    live,
    demo: !live,
    generated_at: sources.now,
    floors: FLOORS.map((floor) => ({ ...floor })),
    agents,
    stats: {
      pending_tasks: pendingTasks,
      done_today: doneToday,
      open_signals: openSignals,
      due_reminders: dueCount,
      agents_working: counts.working,
      agents_busy: counts.busy,
      agents_idle: counts.idle,
      agents_error: counts.error,
    },
    team_tasks: teamTasks,
    signals,
    reminders,
    activity,
    integrations,
    prices: sources.prices?.length ? sources.prices : DEMO_PRICES,
  };
}

function hasLiveRecords(sources: OpsFloorSources) {
  const signalCount = Object.values(sources.signals).some((rows) => rows.length > 0);
  return (
    signalCount ||
    sources.todos.length > 0 ||
    sources.jobs.length > 0 ||
    sources.followUps.length > 0 ||
    sources.reminders.length > 0 ||
    sources.tasks.length > 0 ||
    sources.bills.length > 0 ||
    sources.receipts.length > 0 ||
    sources.inbox.length > 0 ||
    sources.socialPosts.length > 0 ||
    sources.marketMessages.length > 0 ||
    Boolean(sources.groktagon?.last_run_at) ||
    Object.values(sources.bridgePolls).some((poll) => Boolean(poll?.at))
  );
}

function grokIntegration(grok: GroktagonLite | null, hlConfigured: boolean, now: number): IntegrationHealth {
  if (!grok) {
    return {
      id: "groktagon",
      name_en: "Groktagon autopilot",
      name_zh: "Groktagon 自动驾驶",
      status: "idle",
      detail_en: "No autopilot record",
      detail_zh: "没有自动驾驶记录",
      last_at: null,
    };
  }
  const when = ago(grok.last_run_at, now);
  if (looksLikeFailure(grok.last_result) || (grok.enabled && !hlConfigured)) {
    return {
      id: "groktagon",
      name_en: "Groktagon autopilot",
      name_zh: "Groktagon 自动驾驶",
      status: "error",
      detail_en: clip(grok.last_result || (hlConfigured ? "Autopilot error" : "Enabled without a Hyperliquid address")),
      detail_zh: clip(grok.last_result || (hlConfigured ? "自动驾驶出错" : "已开启但没有 Hyperliquid 地址")),
      last_at: grok.last_run_at,
    };
  }
  if (!grok.enabled) {
    return {
      id: "groktagon",
      name_en: "Groktagon autopilot",
      name_zh: "Groktagon 自动驾驶",
      status: "idle",
      detail_en: grok.last_run_at ? `Off · last run ${when?.en ?? ""}`.trim() : "Autopilot off",
      detail_zh: grok.last_run_at ? `已关闭 · 上次运行 ${when?.zh ?? ""}`.trim() : "自动驾驶关闭",
      last_at: grok.last_run_at,
    };
  }
  const age = grok.last_run_at ? now - (timeMs(grok.last_run_at) ?? now) : Infinity;
  return {
    id: "groktagon",
    name_en: "Groktagon autopilot",
    name_zh: "Groktagon 自动驾驶",
    status: age <= 30 * 60 * 1000 ? "ok" : "stale",
    detail_en: clip(grok.last_result || `Last run ${when?.en ?? "unknown"}`),
    detail_zh: clip(grok.last_result || `上次运行 ${when?.zh ?? "未知"}`),
    last_at: grok.last_run_at,
  };
}

type ModuleContext = {
  latest: Record<SignalDeskId, SignalLite | null>;
  now: number;
  nowDate: Date;
  bridges: { status: AgentStatus; en: string; zh: string };
  sources: OpsFloorSources;
  overdueFollowUps: FollowUpLite[];
  openFollowUps: FollowUpLite[];
  dueReminders: OpsFloorSources["reminders"];
  futureReminders: OpsFloorSources["reminders"];
  overdueTodos: TodoLite[];
  openTodos: TodoLite[];
  overdueJobs: JobLite[];
  openJobs: JobLite[];
  openTeam: TeamTaskLite[];
  dueBills: BillLite[];
  overdueBills: BillLite[];
  unread: number;
  openInbox: InboxLite[];
  failedPosts: SocialPostLite[];
  duePosts: SocialPostLite[];
  recentPosts: SocialPostLite[];
  marketLast: MarketMessageLite | null;
  receiptLast: ReceiptLite | null;
  inboxLast: InboxLite | null;
  socialLast: SocialPostLite | null;
};

function moduleState(module: (typeof ROSTER)[number]["module"], ctx: ModuleContext): { status: AgentStatus; en: string; zh: string } {
  if (module === "gold" || module === "xau" || module === "btc" || module === "eth") {
    return signalStatus(ctx.latest[module], ctx.now);
  }
  if (module === "bridges") return ctx.bridges;
  if (module === "grok") return grokState(ctx);
  if (module === "followups") return followUpState(ctx);
  if (module === "reminders") return crmReminderState(ctx);
  if (module === "inbox") return inboxState(ctx);
  if (module === "bills") return billState(ctx);
  if (module === "usdt") {
    return {
      status: "idle",
      en: "Ready for a tx hash or address lookup",
      zh: "可以查询交易哈希或地址",
    };
  }
  if (module === "receipts") return receiptState(ctx);
  if (module === "market") return marketState(ctx);
  if (module === "social") return socialState(ctx);
  return todoState(ctx);
}

function grokState(ctx: ModuleContext): { status: AgentStatus; en: string; zh: string } {
  const grok = ctx.sources.groktagon;
  const hl = signalStatus(ctx.latest.hl, ctx.now);
  const hlBit = ctx.latest.hl ? ` · ${hl.en}` : "";
  const hlBitZh = ctx.latest.hl ? ` · ${hl.zh}` : "";
  if (!grok) {
    return {
      status: ctx.latest.hl ? hl.status : "idle",
      en: clip(`Autopilot idle${hlBit}`),
      zh: clip(`自动驾驶空闲${hlBitZh}`),
    };
  }
  if (looksLikeFailure(grok.last_result)) {
    return { status: "error", en: clip(grok.last_result || "Autopilot error"), zh: clip(grok.last_result || "自动驾驶出错") };
  }
  if (grok.enabled && !ctx.sources.hyperliquidConfigured) {
    return {
      status: "error",
      en: "Autopilot on · Hyperliquid address missing",
      zh: "自动驾驶已开 · 缺少 Hyperliquid 地址",
    };
  }
  const age = grok.last_run_at ? ctx.now - (timeMs(grok.last_run_at) ?? ctx.now) : Infinity;
  const result = grok.last_result ? clip(grok.last_result, 90) : hl.en;
  const resultZh = grok.last_result ? clip(grok.last_result, 90) : hl.zh;
  if (grok.enabled && age > 30 * 60 * 1000) {
    return { status: "busy", en: clip(`Autopilot stale · ${result}`), zh: clip(`自动驾驶延迟 · ${resultZh}`) };
  }
  if (grok.enabled || (grok.last_run_at && age <= 30 * 60 * 1000)) {
    return { status: "working", en: clip(result + hlBit), zh: clip(resultZh + hlBitZh) };
  }
  if (ctx.latest.hl) return { status: hl.status === "error" ? "busy" : hl.status, en: clip(hl.en), zh: clip(hl.zh) };
  return { status: "idle", en: "Autopilot off", zh: "自动驾驶关闭" };
}

function followUpState(ctx: ModuleContext): { status: AgentStatus; en: string; zh: string } {
  const next = newest(ctx.overdueFollowUps.length ? ctx.overdueFollowUps : ctx.openFollowUps, (row) => row.scheduled_at || row.created_at)[0];
  const team = ctx.openTeam.length ? ` · ${ctx.openTeam.length} team tasks` : "";
  const teamZh = ctx.openTeam.length ? ` · ${ctx.openTeam.length} 个团队任务` : "";
  if (!next && !ctx.openTeam.length) return { status: "idle", en: "No open follow-ups", zh: "没有未完成跟进" };
  const title = next ? clip(next.summary || next.notes || "Follow-up", 80) : "Team tasks open";
  const titleZh = next ? title : "团队任务未完成";
  if (ctx.overdueFollowUps.length || ctx.openTeam.some((task) => task.due_at && (timeMs(task.due_at) ?? Infinity) <= ctx.now)) {
    return {
      status: "busy",
      en: clip(`${ctx.overdueFollowUps.length} overdue · ${title}${team}`),
      zh: clip(`${ctx.overdueFollowUps.length} 条逾期 · ${titleZh}${teamZh}`),
    };
  }
  return { status: "working", en: clip(`${title}${team}`), zh: clip(`${titleZh}${teamZh}`) };
}

function crmReminderState(ctx: ModuleContext): { status: AgentStatus; en: string; zh: string } {
  const next = (ctx.dueReminders[0] ?? ctx.futureReminders[0]) || null;
  if (!next && ctx.sources.reminders.length === 0) return { status: "idle", en: "No CRM reminders", zh: "没有客户提醒" };
  if (!next) return { status: "idle", en: "Reminders sent", zh: "提醒已发送" };
  if (ctx.dueReminders.length) {
    return { status: "busy", en: clip(`Due · ${next.title}`), zh: clip(`到期 · ${next.title}`) };
  }
  return { status: "working", en: clip(next.title), zh: clip(next.title) };
}

function inboxState(ctx: ModuleContext): { status: AgentStatus; en: string; zh: string } {
  if (!ctx.inboxLast) return { status: "idle", en: "Inbox clear", zh: "收件箱是空的" };
  const preview = clip(ctx.inboxLast.last_preview || ctx.inboxLast.client_name, 80);
  if (ctx.unread > 0) {
    return { status: "busy", en: clip(`${ctx.unread} unread · ${preview}`), zh: clip(`${ctx.unread} 条未读 · ${preview}`) };
  }
  const age = ctx.now - (timeMs(ctx.inboxLast.last_message_at) ?? ctx.now);
  if (ctx.openInbox.length && age <= 24 * 60 * 60 * 1000) {
    return { status: "working", en: clip(preview), zh: clip(preview) };
  }
  return { status: "idle", en: clip(preview), zh: clip(preview) };
}

function billState(ctx: ModuleContext): { status: AgentStatus; en: string; zh: string } {
  const next = ctx.overdueBills[0] ?? ctx.dueBills[0] ?? ctx.sources.bills.find((bill) => bill.is_active) ?? null;
  if (!next) return { status: "idle", en: "No bill reminders", zh: "没有账单提醒" };
  const amount = money(next.amount, next.currency);
  const label = `${next.title}${amount ? ` · ${amount}` : ""} · day ${next.due_day}`;
  const labelZh = `${next.title}${amount ? ` · ${amount}` : ""} · ${next.due_day} 日`;
  if (ctx.overdueBills.length) return { status: "busy", en: clip(`Overdue · ${label}`), zh: clip(`逾期 · ${labelZh}`) };
  if (ctx.dueBills.length) return { status: "working", en: clip(`Due soon · ${label}`), zh: clip(`即将到期 · ${labelZh}`) };
  return { status: "idle", en: clip(label), zh: clip(labelZh) };
}

function receiptState(ctx: ModuleContext): { status: AgentStatus; en: string; zh: string } {
  if (!ctx.receiptLast) return { status: "idle", en: "No receipts", zh: "没有收据" };
  const amount = money(ctx.receiptLast.amount, ctx.receiptLast.currency);
  const label = `${ctx.receiptLast.merchant || "Receipt"}${amount ? ` · ${amount}` : ""}`;
  const age = ctx.now - (timeMs(ctx.receiptLast.created_at) ?? ctx.now);
  return {
    status: age <= 48 * 60 * 60 * 1000 ? "working" : "idle",
    en: clip(label),
    zh: clip(label),
  };
}

function marketState(ctx: ModuleContext): { status: AgentStatus; en: string; zh: string } {
  if (!ctx.marketLast) return { status: "idle", en: "Market AI idle", zh: "市场 AI 空闲" };
  const text = clip(ctx.marketLast.content, 90);
  const age = ctx.now - (timeMs(ctx.marketLast.created_at) ?? ctx.now);
  if (ctx.marketLast.fallback) return { status: "busy", en: clip(`Fallback reply · ${text}`), zh: clip(`回退回复 · ${text}`) };
  if (age <= 24 * 60 * 60 * 1000 && ctx.marketLast.role === "assistant") {
    return { status: "working", en: text, zh: text };
  }
  return { status: "idle", en: text, zh: text };
}

function socialState(ctx: ModuleContext): { status: AgentStatus; en: string; zh: string } {
  const configured = `${ctx.sources.socialConfiguredCount} channels configured`;
  const configuredZh = `已配置 ${ctx.sources.socialConfiguredCount} 个渠道`;
  if (ctx.failedPosts.length) {
    return { status: "error", en: clip(`Publish failed · ${ctx.failedPosts[0].title}`), zh: clip(`发布失败 · ${ctx.failedPosts[0].title}`) };
  }
  if (ctx.duePosts.length) {
    return { status: "busy", en: clip(`Scheduled now · ${ctx.duePosts[0].title}`), zh: clip(`到达发布时间 · ${ctx.duePosts[0].title}`) };
  }
  if (ctx.recentPosts.length) {
    return { status: "working", en: clip(`${ctx.socialLast?.title || "Published"} · ${configured}`), zh: clip(`${ctx.socialLast?.title || "已发布"} · ${configuredZh}`) };
  }
  if (ctx.socialLast) return { status: "idle", en: clip(`${ctx.socialLast.title} · ${configured}`), zh: clip(`${ctx.socialLast.title} · ${configuredZh}`) };
  return { status: "idle", en: configured, zh: configuredZh };
}

function todoState(ctx: ModuleContext): { status: AgentStatus; en: string; zh: string } {
  const next = ctx.overdueTodos[0] ?? ctx.overdueJobs[0] ?? ctx.openTodos[0] ?? ctx.openJobs[0] ?? null;
  if (!next && ctx.sources.todos.length + ctx.sources.jobs.length === 0) {
    return { status: "idle", en: "No todos or assistant jobs", zh: "没有待办或助理任务" };
  }
  if (!next) return { status: "idle", en: "Todos and jobs are done", zh: "待办和助理任务都完成了" };
  const title = "title" in next ? next.title : "Task";
  if (ctx.overdueTodos.length || ctx.overdueJobs.length) {
    return { status: "busy", en: clip(`Overdue · ${title}`), zh: clip(`逾期 · ${title}`) };
  }
  return { status: "working", en: clip(title), zh: clip(title) };
}

function buildReminderLists(input: {
  sources: OpsFloorSources;
  now: number;
  nowDate: Date;
  overdueFollowUps: FollowUpLite[];
  openFollowUps: FollowUpLite[];
  dueReminders: OpsFloorSources["reminders"];
  futureReminders: OpsFloorSources["reminders"];
  overdueTodos: TodoLite[];
  openTodos: TodoLite[];
  overdueJobs: JobLite[];
  openJobs: JobLite[];
  overdueTasks: TeamTaskLite[];
  openTeam: TeamTaskLite[];
  dueBills: BillLite[];
  overdueBills: BillLite[];
}): OpsFloorSummary["reminders"] {
  const pending: OpsReminderItem[] = [];
  const done: OpsReminderItem[] = [];

  for (const todo of input.sources.todos) {
    const overdue = !todo.done && (timeMs(todo.due_at) ?? Infinity) <= input.now;
    const item = reminderItem(
      "todo",
      todo.id,
      todo.title,
      overdue ? "Overdue to-do" : todo.done ? "Completed to-do" : "Open to-do",
      overdue ? "逾期待办" : todo.done ? "已完成待办" : "未完成待办",
      todo.due_at,
      todo.done ? "done" : overdue ? "overdue" : "pending",
      "/dashboard/todos",
    );
    if (todo.done) done.push(item);
    else pending.push(item);
  }
  for (const job of input.sources.jobs) {
    if (job.status === "cancelled") continue;
    const overdue = openJob(job) && (timeMs(job.due_at) ?? Infinity) <= input.now;
    const item = reminderItem(
      "job",
      job.id,
      job.title,
      job.status === "done" ? "Assistant job done" : overdue ? "Overdue assistant job" : "Open assistant job",
      job.status === "done" ? "助理任务已完成" : overdue ? "助理任务逾期" : "助理任务未完成",
      job.due_at,
      job.status === "done" ? "done" : overdue ? "overdue" : "pending",
      "/dashboard/my-assistant",
    );
    if (job.status === "done") done.push(item);
    else pending.push(item);
  }
  for (const row of input.sources.reminders) {
    const overdue = !row.sent_at && (timeMs(row.scheduled_at) ?? Infinity) <= input.now;
    const item = reminderItem(
      "crm_reminder",
      row.id,
      row.title,
      row.sent_at ? "Reminder sent" : overdue ? "Reminder due" : "Reminder scheduled",
      row.sent_at ? "提醒已发送" : overdue ? "提醒到期" : "提醒已排期",
      row.scheduled_at,
      row.sent_at ? "done" : overdue ? "overdue" : "pending",
      "/dashboard/reminders",
    );
    if (row.sent_at) done.push(item);
    else pending.push(item);
  }
  for (const row of input.sources.followUps) {
    const overdue = !row.completed_at && (timeMs(row.scheduled_at) ?? Infinity) <= input.now && Boolean(row.scheduled_at);
    const item = reminderItem(
      "follow_up",
      row.id,
      row.summary || row.notes || "Follow-up",
      row.completed_at ? "Follow-up done" : overdue ? "Follow-up overdue" : "Follow-up open",
      row.completed_at ? "跟进已完成" : overdue ? "跟进逾期" : "跟进未完成",
      row.scheduled_at,
      row.completed_at ? "done" : overdue ? "overdue" : "pending",
      "/dashboard/crm",
    );
    if (row.completed_at) done.push(item);
    else pending.push(item);
  }
  for (const task of input.sources.tasks) {
    if (task.status === "cancelled") continue;
    const overdue = openTask(task) && (timeMs(task.due_at) ?? Infinity) <= input.now;
    const item = reminderItem(
      "team_task",
      task.id,
      task.title,
      task.status === "done" ? "Team task done" : overdue ? "Team task overdue" : `Team task ${task.status}`,
      task.status === "done" ? "团队任务已完成" : overdue ? "团队任务逾期" : "团队任务进行中",
      task.due_at,
      task.status === "done" ? "done" : overdue ? "overdue" : "pending",
      "/dashboard/team",
    );
    if (task.status === "done") done.push(item);
    else pending.push(item);
  }
  for (const bill of input.sources.bills) {
    if (!bill.is_active) continue;
    const timing = billTiming(bill, input.nowDate);
    const amount = money(bill.amount, bill.currency);
    const item = reminderItem(
      "bill",
      bill.id,
      bill.title,
      timing.paid ? "Paid this month" : timing.overdue ? "Bill overdue" : timing.dueSoon ? "Bill due soon" : `Due day ${bill.due_day}`,
      timing.paid ? "本月已付" : timing.overdue ? "账单逾期" : timing.dueSoon ? "账单即将到期" : `${bill.due_day} 日到期`,
      null,
      timing.paid ? "done" : timing.overdue ? "overdue" : "pending",
      "/dashboard/finance",
    );
    if (amount) {
      item.detail_en = clip(`${item.detail_en} · ${amount}`);
      item.detail_zh = clip(`${item.detail_zh} · ${amount}`);
    }
    if (timing.paid) done.push(item);
    else pending.push(item);
  }

  const rank = (item: OpsReminderItem) => (item.status === "overdue" ? 0 : item.status === "pending" ? 1 : 2);
  pending.sort((a, b) => rank(a) - rank(b) || (timeMs(a.due_at) ?? Infinity) - (timeMs(b.due_at) ?? Infinity));
  done.sort((a, b) => (timeMs(b.due_at) ?? 0) - (timeMs(a.due_at) ?? 0));
  return {
    pending: pending.slice(0, LIST_CAP),
    done: done.slice(0, LIST_CAP),
    overdue: pending.filter((item) => item.status === "overdue").slice(0, LIST_CAP),
  };
}

function buildActivity(input: {
  sources: OpsFloorSources;
  latest: Record<SignalDeskId, SignalLite | null>;
  now: number;
  marketLast: MarketMessageLite | null;
  receiptLast: ReceiptLite | null;
  inboxLast: InboxLite | null;
}): OpsActivityEvent[] {
  const events: OpsActivityEvent[] = [];
  for (const desk of DESKS) {
    const row = input.latest[desk.id];
    if (!row) continue;
    const bias = biasWord(row.bias);
    pushActivity(events, {
      id: `signal:${desk.id}:${row.id}`,
      at: row.created_at,
      text_en: `${desk.name_en} · ${row.symbol} ${bias.en}`,
      text_zh: `${desk.name_zh} · ${row.symbol} ${bias.zh}`,
      tone: bias.en === "LONG" || bias.en === "SHORT" ? "info" : "ok",
    });
  }
  for (const todo of input.sources.todos) {
    if (!todo.completed_at) continue;
    pushActivity(events, {
      id: `todo-done:${todo.id}`,
      at: todo.completed_at,
      text_en: `Done · ${clip(todo.title, 80)}`,
      text_zh: `已完成 · ${clip(todo.title, 80)}`,
      tone: "ok",
    });
  }
  for (const job of input.sources.jobs) {
    if (job.status !== "done" || !job.completed_at) continue;
    pushActivity(events, {
      id: `job-done:${job.id}`,
      at: job.completed_at,
      text_en: `Assistant done · ${clip(job.title, 80)}`,
      text_zh: `助理完成 · ${clip(job.title, 80)}`,
      tone: "ok",
    });
  }
  for (const row of input.sources.followUps) {
    if (!row.completed_at) continue;
    pushActivity(events, {
      id: `follow-up:${row.id}`,
      at: row.completed_at,
      text_en: `Follow-up done · ${clip(row.summary || row.notes || "client", 80)}`,
      text_zh: `跟进完成 · ${clip(row.summary || row.notes || "客户", 80)}`,
      tone: "ok",
    });
  }
  for (const row of input.sources.reminders) {
    if (!row.sent_at) continue;
    pushActivity(events, {
      id: `reminder-sent:${row.id}`,
      at: row.sent_at,
      text_en: `Reminder sent · ${clip(row.title, 80)}`,
      text_zh: `已发提醒 · ${clip(row.title, 80)}`,
      tone: "ok",
    });
  }
  for (const post of input.sources.socialPosts) {
    if (post.status === "failed") {
      pushActivity(events, {
        id: `social-failed:${post.id}`,
        at: post.updated_at,
        text_en: `Social publish failed · ${clip(post.title, 80)}`,
        text_zh: `社媒发布失败 · ${clip(post.title, 80)}`,
        tone: "error",
      });
    } else if (post.published_at) {
      pushActivity(events, {
        id: `social-published:${post.id}`,
        at: post.published_at,
        text_en: `Published · ${clip(post.title, 80)}`,
        text_zh: `已发布 · ${clip(post.title, 80)}`,
        tone: "ok",
      });
    }
  }
  if (input.sources.groktagon?.last_run_at) {
    pushActivity(events, {
      id: `grok:${input.sources.groktagon.last_run_at}`,
      at: input.sources.groktagon.last_run_at,
      text_en: clip(`Groktagon · ${input.sources.groktagon.last_result || (input.sources.groktagon.last_fired ? "order sent" : "checked")}`),
      text_zh: clip(`Groktagon · ${input.sources.groktagon.last_result || (input.sources.groktagon.last_fired ? "已下单" : "已检查")}`),
      tone: looksLikeFailure(input.sources.groktagon.last_result) ? "error" : "info",
    });
  }
  if (input.receiptLast) {
    pushActivity(events, {
      id: `receipt:${input.receiptLast.id}`,
      at: input.receiptLast.created_at,
      text_en: `Receipt · ${clip(input.receiptLast.merchant || "uploaded", 80)}`,
      text_zh: `收据 · ${clip(input.receiptLast.merchant || "已上传", 80)}`,
      tone: "info",
    });
  }
  if (input.inboxLast) {
    pushActivity(events, {
      id: `inbox:${input.inboxLast.id}:${input.inboxLast.last_message_at}`,
      at: input.inboxLast.last_message_at,
      text_en: `Inbox · ${clip(input.inboxLast.client_name)}: ${clip(input.inboxLast.last_preview, 70)}`,
      text_zh: `收件箱 · ${clip(input.inboxLast.client_name)}：${clip(input.inboxLast.last_preview, 70)}`,
      tone: input.inboxLast.unread_count > 0 ? "info" : "ok",
    });
  }
  if (input.marketLast && input.marketLast.role === "assistant") {
    pushActivity(events, {
      id: `market:${input.marketLast.id}`,
      at: input.marketLast.created_at,
      text_en: `Market AI · ${clip(input.marketLast.content, 80)}`,
      text_zh: `市场 AI · ${clip(input.marketLast.content, 80)}`,
      tone: input.marketLast.fallback ? "error" : "info",
    });
  }
  for (const [name, poll] of Object.entries(input.sources.bridgePolls)) {
    if (!poll?.at) continue;
    pushActivity(events, {
      id: `bridge:${name}:${poll.at}`,
      at: poll.at,
      text_en: poll.ok === false ? `${name.toUpperCase()} poll failed` : `${name.toUpperCase()} bridge polled`,
      text_zh: poll.ok === false ? `${name.toUpperCase()} 轮询失败` : `${name.toUpperCase()} 桥接已轮询`,
      tone: poll.ok === false ? "error" : "info",
    });
  }

  events.sort((a, b) => (timeMs(b.at) ?? 0) - (timeMs(a.at) ?? 0));
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  }).slice(0, ACTIVITY_CAP);
}

export function emptyOpsFloorSummary(now = new Date()): OpsFloorSummary {
  return buildOpsFloorSummary(emptyOpsFloorSources(now));
}
