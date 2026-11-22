import type { OpsModule } from "@/lib/ops-floor/roster";
import type {
  AgentStatus,
  BillLite,
  BridgePoll,
  CrmReminderLite,
  DeckLite,
  DiaryLite,
  FollowUpLite,
  GroktagonLite,
  InboxLite,
  JobLite,
  MarketMessageLite,
  OpsWorkItem,
  PlanLite,
  ReceiptLite,
  ReplyDraftLite,
  SignalDeskId,
  SignalLite,
  SocialPostLite,
  SupportMessageLite,
  TeamTaskLite,
  TodoLite,
  WorkLogLite,
} from "@/lib/ops-floor/types";

export const FRESH_MS = 18 * 60 * 60 * 1000;
const TZ = "Asia/Hong_Kong";
const WORK_CAP = 8;

const SUPPORT_CHANNELS = new Set(["whatsapp", "wechat", "telegram", "web"]);
const RESEARCH_MODES = new Set(["market", "data", "copy", ""]);
const BUILD_RE = /(code|coder|coding|\bapps?\b|\bbuild|\bbuilder|\bdev\b|software|工程|代码|开发|应用|构建)/i;

const DESK_META: Record<SignalDeskId, { en: string; zh: string; href: string }> = {
  gold: { en: "Gold", zh: "黄金", href: "/dashboard/gold-signals?tab=gold" },
  xau: { en: "XAUUSDT", zh: "XAUUSDT", href: "/dashboard/gold-signals?tab=xau" },
  spread: { en: "Gold spread", zh: "黄金价差", href: "/dashboard/gold-signals?tab=spread" },
  btc: { en: "BTC", zh: "BTC", href: "/dashboard/gold-signals?tab=btc" },
  eth: { en: "ETH", zh: "ETH", href: "/dashboard/gold-signals?tab=eth" },
  hl: { en: "Hyperliquid", zh: "Hyperliquid", href: "/dashboard/gold-signals?tab=hl" },
};

export type DailyContext = {
  now: number;
  today: string;
  planDates: Set<string>;
  signals: Record<SignalDeskId, SignalLite | null>;
  lines: Record<SignalDeskId, { en: string; zh: string } | null>;
  todos: TodoLite[];
  jobs: JobLite[];
  followUps: FollowUpLite[];
  reminders: CrmReminderLite[];
  tasks: TeamTaskLite[];
  bills: BillLite[];
  receipts: ReceiptLite[];
  inbox: InboxLite[];
  socialPosts: SocialPostLite[];
  marketMessages: MarketMessageLite[];
  diary: DiaryLite[];
  decks: DeckLite[];
  plans: PlanLite[];
  workLogs: WorkLogLite[];
  supportMessages: SupportMessageLite[];
  replyDrafts: ReplyDraftLite[];
  bridgePolls: Partial<Record<"mt5" | "atas" | "bookmap", BridgePoll>>;
  groktagon: GroktagonLite | null;
  overdueBills: BillLite[];
  dueBills: BillLite[];
};

export function isCurrentTip(
  signal: Pick<SignalLite, "bias" | "created_at" | "expires_at" | "approval_status"> | null | undefined,
  now: number,
) {
  if (!signal) return false;
  if (signal.approval_status === "rejected") return false;
  const bias = signal.bias.toLowerCase();
  if (bias !== "long" && bias !== "short") return false;
  const expires = timeMs(signal.expires_at);
  if (expires != null && expires <= now) return false;
  const created = timeMs(signal.created_at);
  if (created == null) return false;
  return now - created <= FRESH_MS;
}

export function isBuildWork(title: string, category: string | null | undefined) {
  return BUILD_RE.test(`${category ?? ""} ${title}`);
}

export function taskFromWork(
  items: OpsWorkItem[],
  fallback: { status: AgentStatus; en: string; zh: string },
): { status: AgentStatus; en: string; zh: string } {
  const real = items.filter((item) => !item.placeholder);
  if (!real.length) {
    const place = items.find((item) => item.placeholder);
    if (place) return { status: "idle", en: place.title_en, zh: place.title_zh };
    return fallback;
  }
  const active = real.find((item) => item.state === "in_progress");
  if (active) return { status: "working", en: clip(active.title_en), zh: clip(active.title_zh) };
  const late = real.find((item) => item.state === "waiting" && item.overdue);
  if (late) return { status: "busy", en: clip(late.title_en), zh: clip(late.title_zh) };
  const done = real.find((item) => item.state === "done");
  if (done && !real.some((item) => item.state === "waiting")) {
    return { status: "idle", en: clip(`Done today · ${done.title_en}`), zh: clip(`今日完成 · ${done.title_zh}`) };
  }
  const waiting = real.find((item) => item.state === "waiting");
  if (waiting) return { status: "idle", en: clip(waiting.title_en), zh: clip(waiting.title_zh) };
  return fallback;
}

export function collectDailyWork(module: OpsModule, ctx: DailyContext, href: string): OpsWorkItem[] {
  const items = itemsFor(module, ctx, href);
  if (items.length) return rank(items).slice(0, WORK_CAP);
  const idle = idleCopy(module);
  return [
    item({
      id: `${module}:waiting`,
      state: "waiting",
      title_en: idle.en,
      title_zh: idle.zh,
      detail_en: idle.en,
      detail_zh: idle.zh,
      at: null,
      href,
      placeholder: true,
    }),
  ];
}

function itemsFor(module: OpsModule, ctx: DailyContext, href: string): OpsWorkItem[] {
  if (module === "gold" || module === "xau" || module === "btc" || module === "eth") {
    return deskWork(module, ctx, href);
  }
  if (module === "signals") return signalsManagerWork(ctx);
  if (module === "bridges") return bridgeWork(ctx, href);
  if (module === "grok") return grokWork(ctx, href);
  if (module === "followups") return followWork(ctx, href);
  if (module === "reminders") return reminderWork(ctx, href);
  if (module === "inbox") return supportWork(ctx, href);
  if (module === "bills") return billWork(ctx, href);
  if (module === "usdt") return [];
  if (module === "receipts") return receiptWork(ctx, href);
  if (module === "market") return researchWork(ctx, href);
  if (module === "social") return socialWork(ctx, href);
  if (module === "todos") return todoWork(ctx, href);
  if (module === "chief") return chiefWork(ctx, href);
  if (module === "builder") return builderWork(ctx, href);
  return presentationWork(ctx, href);
}

function deskWork(desk: SignalDeskId, ctx: DailyContext, href: string): OpsWorkItem[] {
  const signal = ctx.signals[desk];
  if (!signal) return [];
  const name = DESK_META[desk];
  if (isCurrentTip(signal, ctx.now)) {
    const line = ctx.lines[desk];
    return [
      item({
        id: `signal:${desk}:${signal.id}`,
        state: "in_progress",
        title_en: line?.en ?? `${signal.symbol} current`,
        title_zh: line?.zh ?? `${signal.symbol} 当前有效`,
        detail_en: signal.approval_status === "pending" ? "Awaiting approval. Not sent to clients." : "Current desk signal.",
        detail_zh: signal.approval_status === "pending" ? "等待批准。尚未发给客户。" : "当前交易台信号。",
        at: signal.created_at,
        href,
      }),
    ];
  }
  if (!touchedToday(signal.created_at, ctx) && !touchedToday(signal.expires_at, ctx) && !touchedToday(signal.approval_at, ctx)) {
    return [];
  }
  const rejected = signal.approval_status === "rejected";
  return [
    item({
      id: `signal:${desk}:${signal.id}:stale`,
      state: "waiting",
      title_en: rejected ? `${name.en} rejected` : `${name.en} signal is not current`,
      title_zh: rejected ? `${name.zh}已拒绝` : `${name.zh}信号不是当前提示`,
      detail_en: "Expired, stale, or rejected. Levels are not shown as a live tip.",
      detail_zh: "已过期、变旧或已拒绝。不把价位当作当前提示。",
      at: signal.expires_at ?? signal.created_at,
      href,
    }),
  ];
}

function signalsManagerWork(ctx: DailyContext): OpsWorkItem[] {
  const items: OpsWorkItem[] = [];
  for (const desk of Object.keys(DESK_META) as SignalDeskId[]) {
    const signal = ctx.signals[desk];
    if (!signal) continue;
    const name = DESK_META[desk];
    const decidedToday = touchedToday(signal.approval_at, ctx);
    const current = isCurrentTip(signal, ctx.now);
    if (signal.approval_status === "pending" && current) {
      items.push(
        item({
          id: `mgr:${desk}:pending`,
          state: "in_progress",
          title_en: `Awaiting approval · ${name.en}`,
          title_zh: `等待批准 · ${name.zh}`,
          detail_en: "Approval is still open. Nothing was sent to a client.",
          detail_zh: "批准尚未完成。没有发给客户。",
          at: signal.approval_at ?? signal.created_at,
          href: name.href,
        }),
      );
      continue;
    }
    if (signal.approval_status === "approved" && decidedToday && current) {
      items.push(
        item({
          id: `mgr:${desk}:approved`,
          state: "done",
          title_en: `Approved · ${name.en}`,
          title_zh: `已批准 · ${name.zh}`,
          detail_en: ctx.lines[desk]?.en ?? "Approved for the desk.",
          detail_zh: ctx.lines[desk]?.zh ?? "交易台已批准。",
          at: signal.approval_at ?? signal.created_at,
          href: name.href,
        }),
      );
      continue;
    }
    if (signal.approval_status === "rejected" && (decidedToday || touchedToday(signal.created_at, ctx))) {
      items.push(
        item({
          id: `mgr:${desk}:rejected`,
          state: "waiting",
          title_en: `Rejected · ${name.en}`,
          title_zh: `已拒绝 · ${name.zh}`,
          detail_en: "Rejected. Not a current client tip.",
          detail_zh: "已拒绝。不是当前客户提示。",
          at: signal.approval_at ?? signal.created_at,
          href: name.href,
        }),
      );
      continue;
    }
    if (current) {
      items.push(
        item({
          id: `mgr:${desk}:current`,
          state: "in_progress",
          title_en: `Current signal · ${name.en}`,
          title_zh: `当前信号 · ${name.zh}`,
          detail_en: ctx.lines[desk]?.en ?? "On the desk.",
          detail_zh: ctx.lines[desk]?.zh ?? "在交易台。",
          at: signal.created_at,
          href: name.href,
        }),
      );
      continue;
    }
    if (touchedToday(signal.created_at, ctx) || touchedToday(signal.expires_at, ctx)) {
      items.push(
        item({
          id: `mgr:${desk}:stale`,
          state: "waiting",
          title_en: `Not current · ${name.en}`,
          title_zh: `不是当前提示 · ${name.zh}`,
          detail_en: "The latest row is expired or stale.",
          detail_zh: "最新一条已过期或变旧。",
          at: signal.expires_at ?? signal.created_at,
          href: name.href,
        }),
      );
    }
  }
  return items;
}

function bridgeWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  const names = [
    { id: "mt5" as const, en: "MT5", zh: "MT5" },
    { id: "atas" as const, en: "ATAS", zh: "ATAS" },
    { id: "bookmap" as const, en: "Bookmap", zh: "Bookmap" },
  ];
  const items: OpsWorkItem[] = [];
  for (const meta of names) {
    const poll = ctx.bridgePolls[meta.id];
    if (!poll?.at || !touchedToday(poll.at, ctx)) continue;
    items.push(
      item({
        id: `bridge:${meta.id}:${poll.at}`,
        state: poll.ok === false ? "waiting" : "done",
        title_en: poll.ok === false ? `${meta.en} poll failed` : `${meta.en} polled`,
        title_zh: poll.ok === false ? `${meta.zh} 轮询失败` : `${meta.zh} 已轮询`,
        detail_en: poll.ok === false ? "Last poll today failed." : "Bridge poll recorded today.",
        detail_zh: poll.ok === false ? "今天最近一次轮询失败。" : "今天有桥接轮询记录。",
        at: poll.at,
        href,
      }),
    );
  }
  return items;
}

function grokWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  const grok = ctx.groktagon;
  if (!grok?.last_run_at || !touchedToday(grok.last_run_at, ctx)) return [];
  const failed = /\b(error|failed|failure|rejected|exception|denied)\b|失败|错误|拒绝|异常/i.test(grok.last_result ?? "");
  return [
    item({
      id: `grok:${grok.last_run_at}`,
      state: failed ? "waiting" : "done",
      title_en: clip(grok.last_result || (grok.enabled ? "Autopilot checked" : "Autopilot checked while off")),
      title_zh: clip(grok.last_result || (grok.enabled ? "自动驾驶已检查" : "自动驾驶关闭时检查过")),
      detail_en: grok.enabled ? "Recorded autopilot run." : "Autopilot is off. This is the last recorded check.",
      detail_zh: grok.enabled ? "有自动驾驶运行记录。" : "自动驾驶是关闭的。这是最后一次检查记录。",
      at: grok.last_run_at,
      href,
    }),
  ];
}

function followWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  const items: OpsWorkItem[] = [];
  for (const row of ctx.followUps) {
    const title = row.summary || row.notes || "Follow-up";
    if (row.completed_at && touchedToday(row.completed_at, ctx)) {
      items.push(workRow("follow", row.id, "done", title, "Follow-up completed today.", "今天完成的跟进。", row.completed_at, href, false));
    } else if (!row.completed_at) {
      const overdue = (timeMs(row.scheduled_at) ?? Infinity) <= ctx.now && Boolean(row.scheduled_at);
      if (overdue || touchedToday(row.scheduled_at, ctx) || touchedToday(row.created_at, ctx)) {
        items.push(workRow("follow", row.id, "waiting", title, overdue ? "Overdue follow-up." : "Open follow-up.", overdue ? "跟进已逾期。" : "跟进未完成。", row.scheduled_at ?? row.created_at, href, overdue));
      }
    }
  }
  for (const task of ctx.tasks) {
    if (task.status === "cancelled") continue;
    if (task.status === "done") continue;
    const overdue = (timeMs(task.due_at) ?? Infinity) <= ctx.now && Boolean(task.due_at);
    if (task.status === "in_progress") {
      items.push(workRow("team", task.id, "in_progress", task.title, "Team task in progress.", "团队任务进行中。", task.created_at, "/dashboard/team", false));
    } else if (overdue || touchedToday(task.due_at, ctx) || touchedToday(task.created_at, ctx)) {
      items.push(workRow("team", task.id, "waiting", task.title, overdue ? "Team task overdue." : "Team task open.", overdue ? "团队任务逾期。" : "团队任务未完成。", task.due_at ?? task.created_at, "/dashboard/team", overdue));
    }
  }
  return items;
}

function reminderWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  const items: OpsWorkItem[] = [];
  for (const row of ctx.reminders) {
    if (row.sent_at && touchedToday(row.sent_at, ctx)) {
      items.push(workRow("rem", row.id, "done", row.title, "Reminder sent today.", "今天已发送提醒。", row.sent_at, href, false));
    } else if (!row.sent_at) {
      const overdue = (timeMs(row.scheduled_at) ?? Infinity) <= ctx.now;
      if (overdue || touchedToday(row.scheduled_at, ctx)) {
        items.push(workRow("rem", row.id, "waiting", row.title, overdue ? "Reminder due." : "Reminder scheduled today.", overdue ? "提醒已到期。" : "提醒排在今天。", row.scheduled_at, href, overdue));
      }
    }
  }
  return items;
}

function supportWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  const items: OpsWorkItem[] = [];
  const draftedClients = new Set<string>();
  for (const draft of ctx.replyDrafts) {
    if (!SUPPORT_CHANNELS.has(draft.channel)) continue;
    const who = `${channelLabel(draft.channel).en} · ${draft.client_name}`;
    const whoZh = `${channelLabel(draft.channel).zh} · ${draft.client_name}`;
    draftedClients.add(clientKey(draft.client_name, draft.channel));
    if (draft.status === "pending_approval") {
      items.push(
        item({
          id: `draft:${draft.id}`,
          state: "in_progress",
          title_en: `Draft awaiting approval · ${who}`,
          title_zh: `草稿待批准 · ${whoZh}`,
          detail_en: "Staff draft only. Approving does not send it to the client.",
          detail_zh: "仅员工草稿。批准不会发给客户。",
          at: draft.created_at,
          href,
        }),
      );
    } else if (draft.decided_at && touchedToday(draft.decided_at, ctx)) {
      const approved = draft.status === "approved";
      items.push(
        item({
          id: `draft:${draft.id}`,
          state: approved ? "done" : "waiting",
          title_en: approved ? `Draft approved · ${who}` : `Draft rejected · ${who}`,
          title_zh: approved ? `草稿已批准 · ${whoZh}` : `草稿已拒绝 · ${whoZh}`,
          detail_en: "Decision recorded. The draft was not sent to the client.",
          detail_zh: "已记录决定。草稿没有发给客户。",
          at: draft.decided_at,
          href,
        }),
      );
    }
  }

  const threads = new Map<string, SupportMessageLite>();
  for (const message of ctx.supportMessages) {
    if (!SUPPORT_CHANNELS.has(message.channel) || !touchedToday(message.at, ctx)) continue;
    const key = clientKey(message.client_name, message.channel);
    const prev = threads.get(key);
    if (!prev || (timeMs(message.at) ?? 0) >= (timeMs(prev.at) ?? 0)) threads.set(key, message);
  }
  for (const [key, message] of threads) {
    if (draftedClients.has(key)) continue;
    const who = `${channelLabel(message.channel).en} · ${message.client_name}`;
    const whoZh = `${channelLabel(message.channel).zh} · ${message.client_name}`;
    const inbound = message.direction === "inbound";
    items.push(
      item({
        id: `support:${message.id}`,
        state: inbound ? "waiting" : "done",
        title_en: inbound ? `Reply waiting · ${who}` : `Replied · ${who}`,
        title_zh: inbound ? `等待回复 · ${whoZh}` : `已回复 · ${whoZh}`,
        detail_en: inbound ? "Latest client message today has no later reply." : "A reply was recorded today.",
        detail_zh: inbound ? "今天最新的客户消息还没有后续回复。" : "今天有回复记录。",
        at: message.at,
        href,
      }),
    );
  }
  return items;
}

function billWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  const items: OpsWorkItem[] = [];
  const seen = new Set<string>();
  for (const bill of ctx.overdueBills) {
    seen.add(bill.id);
    items.push(workRow("bill", bill.id, "waiting", bill.title, "Bill overdue.", "账单逾期。", null, href, true));
  }
  for (const bill of ctx.dueBills) {
    if (seen.has(bill.id)) continue;
    items.push(workRow("bill", bill.id, "waiting", bill.title, "Bill due soon.", "账单即将到期。", null, href, false));
  }
  return items;
}

function receiptWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  return ctx.receipts
    .filter((row) => touchedToday(row.created_at, ctx))
    .map((row) =>
      workRow("receipt", row.id, "done", row.merchant || "Receipt", "Receipt recorded today.", "今天录入的收据。", row.created_at, href, false),
    );
}

function researchWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  const items: OpsWorkItem[] = [];
  const diaryToday = ctx.diary.filter((row) => touchedToday(row.created_at, ctx) && row.mode !== "ppt" && RESEARCH_MODES.has(row.mode || "market"));
  for (const row of diaryToday) {
    items.push(
      item({
        id: `research:${row.id}`,
        state: row.fallback ? "waiting" : "done",
        title_en: clip(row.question || "Research note"),
        title_zh: clip(row.question || "研究记录"),
        detail_en: row.fallback ? "Research reply fell back. Not a finished note." : "Research note recorded today.",
        detail_zh: row.fallback ? "研究回复回退了，不是完成的记录。" : "今天有研究记录。",
        at: row.created_at,
        href,
      }),
    );
  }
  if (items.length) return items;
  for (const row of ctx.marketMessages) {
    if (row.role !== "assistant" || row.mode === "ppt" || !touchedToday(row.created_at, ctx)) continue;
    items.push(
      item({
        id: `research-chat:${row.id}`,
        state: row.fallback ? "waiting" : "done",
        title_en: clip(row.content),
        title_zh: clip(row.content),
        detail_en: row.fallback ? "Research reply fell back." : "Research reply recorded today.",
        detail_zh: row.fallback ? "研究回复回退了。" : "今天有研究回复。",
        at: row.created_at,
        href,
      }),
    );
  }
  return items;
}

function presentationWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  const items: OpsWorkItem[] = [];
  const decks = ctx.decks.filter((row) => row.kind === "ppt" && touchedToday(row.created_at, ctx));
  for (const deck of decks) {
    items.push(
      item({
        id: `deck:${deck.id}`,
        state: "done",
        title_en: clip(deck.title || "Slide deck"),
        title_zh: clip(deck.title || "幻灯片"),
        detail_en: "Slide deck saved today.",
        detail_zh: "今天保存了幻灯片。",
        at: deck.created_at,
        href,
      }),
    );
  }
  for (const row of ctx.diary) {
    if (row.mode !== "ppt" || !touchedToday(row.created_at, ctx)) continue;
    if (!row.fallback && decks.length) continue;
    items.push(
      item({
        id: `ppt-note:${row.id}`,
        state: row.fallback ? "waiting" : "done",
        title_en: clip(row.question || "Slide deck"),
        title_zh: clip(row.question || "幻灯片"),
        detail_en: row.fallback ? "Deck request did not complete." : "Slide request recorded today.",
        detail_zh: row.fallback ? "幻灯片请求没有完成。" : "今天有幻灯片请求记录。",
        at: row.created_at,
        href,
      }),
    );
  }
  return items;
}

function socialWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  const items: OpsWorkItem[] = [];
  for (const post of ctx.socialPosts) {
    if (post.status === "failed" && touchedToday(post.updated_at, ctx)) {
      items.push(workRow("social", post.id, "waiting", post.title, "Publish failed today.", "今天发布失败。", post.updated_at, href, false));
    } else if (post.published_at && touchedToday(post.published_at, ctx)) {
      items.push(workRow("social", post.id, "done", post.title, "Published today.", "今天已发布。", post.published_at, href, false));
    } else if (post.status === "scheduled" && touchedToday(post.scheduled_at, ctx)) {
      const due = (timeMs(post.scheduled_at) ?? Infinity) <= ctx.now;
      items.push(workRow("social", post.id, due ? "in_progress" : "waiting", post.title, due ? "Scheduled for now." : "Scheduled today.", due ? "已到发布时间。" : "排在今天发布。", post.scheduled_at, href, false));
    }
  }
  return items;
}

function todoWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  const items: OpsWorkItem[] = [];
  for (const todo of ctx.todos) {
    if (todo.done && touchedToday(todo.completed_at, ctx)) {
      items.push(workRow("todo", todo.id, "done", todo.title, "To-do completed today.", "今天完成的待办。", todo.completed_at, href, false));
    } else if (!todo.done) {
      const overdue = (timeMs(todo.due_at) ?? Infinity) <= ctx.now && Boolean(todo.due_at);
      if (overdue || touchedToday(todo.due_at, ctx) || touchedToday(todo.created_at, ctx)) {
        items.push(workRow("todo", todo.id, "waiting", todo.title, overdue ? "To-do overdue." : "To-do open.", overdue ? "待办已逾期。" : "待办未完成。", todo.due_at ?? todo.created_at, href, overdue));
      }
    }
  }
  for (const job of ctx.jobs) {
    if (isBuildWork(job.title, job.category) || job.status === "cancelled") continue;
    pushJob(items, job, href, "/dashboard/my-assistant", ctx);
  }
  return items;
}

function chiefWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  const items: OpsWorkItem[] = [];
  for (const plan of ctx.plans) {
    if (plan.period === "weekly") continue;
    if (!ctx.planDates.has(plan.plan_date)) continue;
    for (const entry of plan.items) {
      items.push(
        workRow(
          "plan",
          `${plan.id}:${entry.id}`,
          entry.done ? "done" : "waiting",
          entry.text || plan.title,
          entry.done ? "Plan item done today." : "Plan item still open.",
          entry.done ? "今日计划已完成。" : "今日计划尚未完成。",
          null,
          href,
          false,
        ),
      );
    }
  }
  for (const log of ctx.workLogs) {
    if (!touchedToday(log.logged_at, ctx) || isBuildWork(log.title, log.category)) continue;
    items.push(workRow("log", log.id, "done", log.title, "Work log recorded today.", "今天写入的工作日志。", log.logged_at, href, false));
  }
  return items;
}

function builderWork(ctx: DailyContext, href: string): OpsWorkItem[] {
  const items: OpsWorkItem[] = [];
  for (const job of ctx.jobs) {
    if (!isBuildWork(job.title, job.category) || job.status === "cancelled") continue;
    pushJob(items, job, href, href, ctx);
  }
  for (const log of ctx.workLogs) {
    if (!touchedToday(log.logged_at, ctx) || !isBuildWork(log.title, log.category)) continue;
    items.push(workRow("build-log", log.id, "done", log.title, "Code or app work logged today.", "今天记录的代码或应用工作。", log.logged_at, href, false));
  }
  return items;
}

function pushJob(items: OpsWorkItem[], job: JobLite, href: string, jobHref: string, ctx: DailyContext) {
  if (job.status === "done" && touchedToday(job.completed_at, ctx)) {
    items.push(workRow("job", job.id, "done", job.title, "Assistant job done today.", "今天完成的助理任务。", job.completed_at, jobHref, false));
    return;
  }
  if (job.status !== "todo" && job.status !== "in_progress") return;
  const overdue = (timeMs(job.due_at) ?? Infinity) <= ctx.now && Boolean(job.due_at);
  const fresh = touchedToday(job.updated_at, ctx) || touchedToday(job.due_at, ctx) || overdue;
  if (!fresh && job.status !== "in_progress") return;
  if (job.status === "in_progress") {
    items.push(workRow("job", job.id, "in_progress", job.title, "In progress.", "进行中。", job.updated_at, jobHref, false));
    return;
  }
  items.push(workRow("job", job.id, "waiting", job.title, overdue ? "Job overdue." : "Job open.", overdue ? "任务逾期。" : "任务未开始。", job.due_at ?? job.updated_at, href, overdue));
}

function idleCopy(module: OpsModule): { en: string; zh: string } {
  switch (module) {
    case "gold":
      return { en: "No current gold signal", zh: "没有当前黄金信号" };
    case "xau":
      return { en: "No current XAUUSDT signal", zh: "没有当前 XAUUSDT 信号" };
    case "btc":
      return { en: "No current BTC signal", zh: "没有当前 BTC 信号" };
    case "eth":
      return { en: "No current ETH signal", zh: "没有当前 ETH 信号" };
    case "signals":
      return { en: "No current client signal", zh: "没有当前客户信号" };
    case "bridges":
      return { en: "No bridge poll today", zh: "今天没有桥接轮询" };
    case "grok":
      return { en: "No autopilot run today", zh: "今天没有自动驾驶记录" };
    case "followups":
      return { en: "No follow-up work today", zh: "今天没有跟进" };
    case "reminders":
      return { en: "No reminders today", zh: "今天没有提醒" };
    case "inbox":
      return { en: "No client messages today", zh: "今天没有客户消息" };
    case "bills":
      return { en: "No bills due", zh: "没有到期账单" };
    case "usdt":
      return { en: "No lookup recorded today", zh: "今天没有查询记录" };
    case "receipts":
      return { en: "No receipts today", zh: "今天没有收据" };
    case "market":
      return { en: "No research recorded today", zh: "今天没有研究记录" };
    case "social":
      return { en: "No social posts today", zh: "今天没有社媒发布" };
    case "todos":
      return { en: "No to-dos today", zh: "今天没有待办" };
    case "chief":
      return { en: "No plan or work log today", zh: "今天没有计划或工作日志" };
    case "builder":
      return { en: "No code or app work recorded today", zh: "今天没有代码或应用工作记录" };
    case "presentation":
      return { en: "No slide deck today", zh: "今天没有幻灯片" };
    default:
      return { en: "Nothing recorded today", zh: "今天没有记录" };
  }
}

function workRow(
  prefix: string,
  id: string,
  state: OpsWorkItem["state"],
  title: string,
  detail_en: string,
  detail_zh: string,
  at: string | null,
  href: string,
  overdue: boolean,
): OpsWorkItem {
  const label = overdue ? `Overdue · ${title}` : title;
  const labelZh = overdue ? `逾期 · ${title}` : title;
  return item({
    id: `${prefix}:${id}`,
    state,
    title_en: clip(label),
    title_zh: clip(labelZh),
    detail_en,
    detail_zh,
    at,
    href,
    overdue,
  });
}

function item(row: OpsWorkItem): OpsWorkItem {
  return row;
}

function rank(items: OpsWorkItem[]) {
  const order = { in_progress: 0, waiting: 1, done: 2 };
  return [...items].sort((a, b) => order[a.state] - order[b.state] || (timeMs(b.at) ?? 0) - (timeMs(a.at) ?? 0));
}

function touchedToday(value: string | null | undefined, ctx: DailyContext) {
  return dayKey(value) === ctx.today;
}

function clientKey(name: string, channel: string) {
  return `${channel}:${name.trim().toLowerCase()}`;
}

function channelLabel(channel: string): { en: string; zh: string } {
  if (channel === "whatsapp") return { en: "WhatsApp", zh: "WhatsApp" };
  if (channel === "wechat") return { en: "WeChat", zh: "微信" };
  if (channel === "telegram") return { en: "Telegram", zh: "Telegram" };
  if (channel === "web") return { en: "Web", zh: "网页" };
  return { en: channel, zh: channel };
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

function clip(text: string, max = 140) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}
