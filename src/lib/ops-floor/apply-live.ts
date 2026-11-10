import type { OpsFloorSummary } from "@/lib/ops-floor/types";

export type NexusControls = {
  updateAgentStatus: (id: string, status: string, quiet?: boolean) => void;
  setAgentTask: (id: string, task: string) => void;
  setAgentRole: (id: string, role: string) => void;
  moveAgentToFloor: (id: string, floor: number) => void;
  setFloorNames: (names: string[]) => void;
  setStats: (partial: Record<string, unknown>) => void;
  logActivity: (text: string, color?: string) => void;
  clearActivity: () => void;
  setDemo: (on: boolean) => void;
  getAgents: () => { id: string; floor: number; status: string }[];
  updateLabels?: (labels: OpsFloorLabels | null) => void;
  setPrices?: (prices: { symbol: string; price: number; change_pct: number | null }[]) => void;
};

export type OpsFloorLabels = {
  agents?: string;
  uptime?: string;
  cost?: string;
  pending?: string;
  doneToday?: string;
  openSignals?: string;
  dueReminders?: string;
  teamLine?: string;
  breakdown?: string;
  brand?: string;
  brandSub?: string;
  roster?: string;
  hint?: string;
  autoRotate?: string;
  glow?: string;
  reset?: string;
  following?: string;
  stopFollow?: string;
  status?: string;
  activity?: string;
  liveWord?: string;
  sessionWord?: string;
};

export type ApplyMemory = {
  seen: Set<string>;
  primed: boolean;
  demoHeld: boolean;
};

export type ApplyOptions = {
  quietStatus?: boolean;
  resetFeed?: boolean;
};

const TONE_COLOR = {
  info: "#4ff0ff",
  ok: "#5dff9e",
  error: "#ff4f6d",
} as const;

function pick(locale: "en" | "zh", en: string, zh: string) {
  return locale === "zh" ? zh : en;
}

function fill(template: string | undefined, vars: Record<string, string | number>, fallback: string) {
  const source = template || fallback;
  return source.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}

export function applyOpsFloorSnapshot(
  nexus: NexusControls,
  summary: OpsFloorSummary | null | undefined,
  locale: "en" | "zh",
  labels: OpsFloorLabels | null,
  memory: ApplyMemory,
  options: ApplyOptions = {},
) {
  if (!summary?.live) {
    nexus.setDemo(true);
    if (!memory.demoHeld) {
      nexus.setStats({
        mode: "demo",
        agents: "15",
        uptime: "87h",
        cost: "$1.08",
        agentsLabel: labels?.agents,
        uptimeLabel: labels?.uptime,
        costLabel: labels?.cost,
        breakdownTpl: labels?.breakdown,
      });
      memory.demoHeld = true;
    } else if (labels) {
      nexus.setStats({
        mode: "demo",
        agentsLabel: labels.agents,
        uptimeLabel: labels.uptime,
        costLabel: labels.cost,
        breakdownTpl: labels.breakdown,
      });
    }
    nexus.updateLabels?.(labels);
    memory.primed = false;
    return;
  }

  const first = !memory.primed;
  const quiet = options.quietStatus ?? first;
  const resetFeed = options.resetFeed ?? first;
  memory.demoHeld = false;
  nexus.setDemo(false);
  nexus.setFloorNames(
    [...summary.floors].sort((a, b) => a.index - b.index).map((floor) => pick(locale, floor.name_en, floor.name_zh)),
  );

  const current = new Map(nexus.getAgents().map((agent) => [agent.id, agent]));
  for (const agent of summary.agents) {
    nexus.setAgentRole(agent.id, pick(locale, agent.role_en, agent.role_zh));
    nexus.setAgentTask(agent.id, pick(locale, agent.task_en, agent.task_zh));
    const prev = current.get(agent.id);
    if (!prev || prev.status !== agent.status) {
      nexus.updateAgentStatus(agent.id, agent.status, quiet);
    }
    if (!prev || prev.floor !== agent.floor) {
      nexus.moveAgentToFloor(agent.id, agent.floor);
    }
  }

  const stats = summary.stats;
  nexus.setStats({
    mode: "live",
    agentsLabel: labels?.pending ?? "PENDING",
    agents: String(stats.pending_tasks),
    uptimeLabel: labels?.doneToday ?? "DONE TODAY",
    uptime: String(stats.done_today),
    uptimeSub: fill(labels?.dueReminders, { count: stats.due_reminders }, "{count} due reminders"),
    costLabel: labels?.openSignals ?? "OPEN SIGNALS",
    cost: String(stats.open_signals),
    costSub: fill(
      labels?.teamLine,
      { pending: summary.team_tasks.pending, progress: summary.team_tasks.in_progress },
      "{pending} team tasks open · {progress} in progress",
    ),
    breakdown: fill(
      labels?.breakdown,
      {
        working: stats.agents_working,
        busy: stats.agents_busy,
        idle: stats.agents_idle,
        error: stats.agents_error,
      },
      "{working} working · {busy} busy · {idle} idle · {error} error",
    ),
  });

  if (resetFeed) {
    memory.seen.clear();
    nexus.clearActivity();
  }
  const fresh = summary.activity.filter((event) => !memory.seen.has(event.id));
  for (const event of [...fresh].reverse()) {
    memory.seen.add(event.id);
    nexus.logActivity(pick(locale, event.text_en, event.text_zh), TONE_COLOR[event.tone] ?? TONE_COLOR.info);
  }
  nexus.setPrices?.(summary.prices);
  nexus.updateLabels?.(labels);
  memory.primed = true;
}
