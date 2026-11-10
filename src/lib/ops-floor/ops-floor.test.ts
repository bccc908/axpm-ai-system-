import { mkdtemp, readdir, writeFile, mkdir } from "fs/promises";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { applyOpsFloorSnapshot, type NexusControls } from "@/lib/ops-floor/apply-live";
import { buildOpsFloorSummary, emptyOpsFloorSources } from "@/lib/ops-floor/build-summary";
import { recordBridgePoll, whenBridgePollsSettled } from "@/lib/ops-floor/bridge-poll";
import { loadOpsFloorSummary } from "@/lib/ops-floor/load-summary";
import type { OpsFloorSources } from "@/lib/ops-floor/types";

const NOW = "2026-11-10T02:00:00.000Z";

function sampleSources(): OpsFloorSources {
  const sources = emptyOpsFloorSources(new Date(NOW));
  sources.signals.gold = [
    {
      id: "gold-1",
      created_at: "2026-11-10T00:30:00.000Z",
      symbol: "XAUUSD",
      bias: "long",
      spot_price: 2650,
      entry_zone: { low: 2648, high: 2652 },
      stop_loss: 2635,
      take_profit: [2665, 2680],
      thesis: "Buyers defending the session low.",
      expires_at: "2026-11-10T12:00:00.000Z",
    },
  ];
  sources.signals.btc = [
    {
      id: "btc-1",
      created_at: "2026-11-09T00:00:00.000Z",
      symbol: "BTCUSD",
      bias: "short",
      spot_price: 68000,
      entry_zone: null,
      stop_loss: 69000,
      take_profit: [66000],
      thesis: "Old short.",
      expires_at: "2026-11-09T06:00:00.000Z",
    },
  ];
  sources.todos = [
    {
      id: "todo-open",
      title: "Call the IB desk",
      done: false,
      due_at: "2026-11-09T02:00:00.000Z",
      completed_at: null,
      created_at: "2026-11-08T02:00:00.000Z",
    },
    {
      id: "todo-done",
      title: "File the morning note",
      done: true,
      due_at: null,
      completed_at: "2026-11-10T01:00:00.000Z",
      created_at: "2026-11-10T00:00:00.000Z",
    },
  ];
  sources.tasks = [
    { id: "task-1", title: "KYC pack", status: "pending", due_at: null, created_at: "2026-11-08T00:00:00.000Z" },
    { id: "task-2", title: "Onboarding call", status: "in_progress", due_at: "2026-11-11T00:00:00.000Z", created_at: "2026-11-08T00:00:00.000Z" },
    { id: "task-3", title: "Archive lead", status: "done", due_at: null, created_at: "2026-11-01T00:00:00.000Z" },
  ];
  sources.reminders = [
    {
      id: "rem-1",
      title: "Deposit follow-up",
      message: "Ask about the wire",
      scheduled_at: "2026-11-10T01:00:00.000Z",
      sent_at: null,
      created_at: "2026-11-09T01:00:00.000Z",
    },
  ];
  sources.followUps = [
    {
      id: "fu-1",
      notes: "Check the new lead",
      summary: "New lead",
      scheduled_at: "2026-11-09T08:00:00.000Z",
      completed_at: null,
      created_at: "2026-11-08T08:00:00.000Z",
    },
  ];
  sources.bills = [
    {
      id: "bill-1",
      title: "Office rent",
      amount: 1200,
      currency: "USD",
      due_day: 1,
      remind_days_before: 3,
      is_active: true,
      last_paid_at: null,
    },
  ];
  sources.groktagon = {
    enabled: true,
    last_run_at: "2026-11-10T01:40:00.000Z",
    last_result: "order failed: rejected by gate",
    last_fired: false,
  };
  sources.hyperliquidConfigured = false;
  sources.bridgePolls = {
    mt5: { at: "2026-11-10T01:40:00.000Z", ok: true },
    atas: { at: "2026-11-10T01:20:00.000Z", ok: true },
  };
  sources.telegramReady = true;
  return sources;
}

describe("ops floor summary", () => {
  it("stays in demo mode when every store is empty", () => {
    const summary = buildOpsFloorSummary(emptyOpsFloorSources(new Date(NOW)));
    expect(summary.live).toBe(false);
    expect(summary.demo).toBe(true);
    expect(summary.stats).toMatchObject({
      pending_tasks: 0,
      done_today: 0,
      open_signals: 0,
      due_reminders: 0,
    });
    expect(summary.agents).toHaveLength(15);
    expect(summary.signals.map((row) => row.desk)).toEqual(["gold", "xau", "spread", "btc", "eth", "hl"]);
    expect(summary.signals.every((row) => row.time == null)).toBe(true);
  });

  it("maps desks, overdue work, and bridge health from real records", () => {
    const summary = buildOpsFloorSummary(sampleSources());
    expect(summary.live).toBe(true);
    expect(summary.demo).toBe(false);
    expect(summary.floors.map((floor) => floor.name_en)).toEqual([
      "Lobby & reception",
      "Gold trading desk",
      "Crypto & Groktagon",
      "CRM & IB team",
      "CEO office & finance",
    ]);
    expect(summary.prices.map((row) => row.symbol)).toEqual(["XAUUSD", "BTCUSD", "ETHUSD"]);
    expect(summary.stats.pending_tasks).toBe(3);
    expect(summary.stats.done_today).toBe(1);
    expect(summary.stats.open_signals).toBe(1);
    expect(summary.stats.due_reminders).toBe(4);
    expect(summary.team_tasks).toEqual({ pending: 1, in_progress: 1, done: 1, cancelled: 0 });

    const byId = Object.fromEntries(summary.agents.map((agent) => [agent.id, agent]));
    expect(byId["agent-1"]).toMatchObject({ status: "working", floor: 1 });
    expect(byId["agent-1"].task_en).toContain("XAUUSD");
    expect(byId["agent-1"].task_en).toContain("2,648");
    expect(byId["agent-4"].status).toBe("busy");
    expect(byId["agent-3"].status).toBe("working");
    expect(byId["agent-6"].status).toBe("error");
    expect(byId["agent-10"].status).toBe("busy");
    expect(byId["agent-15"].status).toBe("busy");

    const gold = summary.signals.find((row) => row.desk === "gold");
    expect(gold).toMatchObject({
      symbol: "XAUUSD",
      bias: "long",
      entry: "2,648–2,652",
      stop_loss: 2635,
      href: "/dashboard/gold-signals?tab=gold",
    });
    expect(gold?.take_profit).toEqual([2665, 2680]);
    expect(summary.reminders.overdue.some((item) => item.title === "Call the IB desk")).toBe(true);
    expect(summary.reminders.done.some((item) => item.title === "File the morning note")).toBe(true);
    expect(summary.reminders.pending.some((item) => item.href === "/dashboard/todos")).toBe(true);
    expect(summary.activity.some((event) => event.id === "signal:gold:gold-1")).toBe(true);
    expect(summary.integrations.find((row) => row.id === "mt5")?.status).toBe("ok");
    expect(summary.integrations.find((row) => row.id === "telegram")?.status).toBe("ok");
    expect(summary.integrations.find((row) => row.id === "hyperliquid")?.status).toBe("idle");
  });
});

describe("ops floor loader", () => {
  it("returns an empty demo summary when the data directory is missing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ops-floor-empty-"));
    const missing = path.join(dir, "does-not-exist");
    const summary = await loadOpsFloorSummary({ dataDir: missing, now: new Date(NOW), env: {}, skipQuotes: true });
    expect(summary.live).toBe(false);
    expect(summary.stats.pending_tasks).toBe(0);
    await expect(readdir(dir)).resolves.toEqual([]);
  });

  it("ignores corrupt files and still reads the stores that parse", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ops-floor-mixed-"));
    await writeFile(path.join(dir, "gold-signals.json"), "{ this is not json", "utf8");
    await writeFile(
      path.join(dir, "personal-assistant.json"),
      JSON.stringify({
        todos: [
          {
            id: "t1",
            title: "Review spreads",
            done: false,
            due_at: null,
            completed_at: null,
            created_at: "2026-11-10T00:00:00.000Z",
          },
        ],
        jobs: [],
      }),
      "utf8",
    );
    const summary = await loadOpsFloorSummary({ dataDir: dir, now: new Date(NOW), env: {}, skipQuotes: true });
    expect(summary.live).toBe(true);
    expect(summary.signals.find((row) => row.desk === "gold")?.time).toBeNull();
    expect(summary.stats.pending_tasks).toBe(1);
    expect(summary.agents.find((agent) => agent.id === "agent-15")?.status).toBe("working");
  });
});

describe("bridge poll log", () => {
  it("records a poll without throwing when the directory is new", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ops-floor-bridge-"));
    await mkdir(dir, { recursive: true });
    recordBridgePoll("mt5", true, dir);
    await whenBridgePollsSettled();
    const summary = await loadOpsFloorSummary({ dataDir: dir, now: new Date(), env: {}, skipQuotes: true });
    expect(summary.live).toBe(true);
    expect(summary.integrations.find((row) => row.id === "mt5")?.last_at).toBeTruthy();
  });
});

describe("applyOpsFloorSnapshot", () => {
  function fakeNexus() {
    const calls: string[] = [];
    const agents = [{ id: "agent-1", floor: 0, status: "idle" }];
    const nexus: NexusControls = {
      updateAgentStatus: (id, status, quiet) => calls.push(`status:${id}:${status}:${quiet ? "quiet" : "loud"}`),
      setAgentTask: (id, task) => calls.push(`task:${id}:${task}`),
      setAgentRole: (id, role) => calls.push(`role:${id}:${role}`),
      moveAgentToFloor: (id, floor) => calls.push(`move:${id}:${floor}`),
      setFloorNames: (names) => calls.push(`floors:${names.join("|")}`),
      setStats: (partial) => calls.push(`stats:${partial.mode}:${partial.agents}`),
      logActivity: (text) => calls.push(`log:${text}`),
      clearActivity: () => calls.push("clear"),
      setDemo: (on) => calls.push(`demo:${on}`),
      getAgents: () => agents,
      updateLabels: () => calls.push("labels"),
    };
    return { nexus, calls };
  }

  it("keeps demo mode when the summary has no live records", () => {
    const { nexus, calls } = fakeNexus();
    const memory = { seen: new Set<string>(), primed: false, demoHeld: false };
    applyOpsFloorSnapshot(nexus, buildOpsFloorSummary(emptyOpsFloorSources(new Date(NOW))), "en", null, memory);
    expect(calls).toContain("demo:true");
    expect(calls).toContain("stats:demo:15");
    expect(calls.some((call) => call.startsWith("status:"))).toBe(false);
  });

  it("drives robots once and does not replay the same activity", () => {
    const { nexus, calls } = fakeNexus();
    const memory = { seen: new Set<string>(), primed: false, demoHeld: false };
    const summary = buildOpsFloorSummary(sampleSources());
    applyOpsFloorSnapshot(
      nexus,
      summary,
      "zh",
      { pending: "待处理", doneToday: "今日完成", openSignals: "有效信号", dueReminders: "{count} 条", teamLine: "{pending}/{progress}", breakdown: "{working}/{busy}/{idle}/{error}" },
      memory,
    );
    expect(calls[0]).toBe("demo:false");
    expect(calls.some((call) => call.startsWith("floors:") && call.includes("黄金交易台"))).toBe(true);
    expect(calls.some((call) => call.startsWith("task:agent-1:") && call.includes("做多"))).toBe(true);
    expect(calls.filter((call) => call.startsWith("log:")).length).toBeGreaterThan(0);
    const before = calls.length;
    applyOpsFloorSnapshot(nexus, summary, "en", null, memory);
    const again = calls.slice(before);
    expect(again.some((call) => call.startsWith("log:"))).toBe(false);
    expect(again.some((call) => call.startsWith("clear"))).toBe(false);
  });
});
