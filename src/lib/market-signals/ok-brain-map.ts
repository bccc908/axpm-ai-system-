import { z } from "zod";

/** 0K脑图 — ten structured elements, each ≤10 graphemes */
export type OkBrainMap = {
  /** 1. 做什么事 */
  what: string;
  /** 2. 关键在于 */
  key: string;
  /** 3. 针对什么发力 */
  focus: string;
  /** 4. 鉴于什么形势 */
  context: string;
  /** 5. 发挥什么优势 */
  advantage: string;
  /** 6. 本着什么原则 */
  principle: string;
  /** 7. 运用什么方法 */
  method: string;
  /** 8. 五个步骤 ①-⑤ */
  steps: [string, string, string, string, string];
  /** 9. 经过什么时间 */
  duration: string;
  /** 10. 实现什么目标 */
  goal: string;
};

const MAX_FIELD_LEN = 10;

export function truncateOkField(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return [...trimmed].slice(0, MAX_FIELD_LEN).join("");
}

const okFieldSchema = z.string().transform(truncateOkField);

export const okBrainMapSchema = z.object({
  what: okFieldSchema,
  key: okFieldSchema,
  focus: okFieldSchema,
  context: okFieldSchema,
  advantage: okFieldSchema,
  principle: okFieldSchema,
  method: okFieldSchema,
  steps: z
    .array(z.string())
    .length(5)
    .transform((arr) => arr.map(truncateOkField) as OkBrainMap["steps"]),
  duration: okFieldSchema,
  goal: okFieldSchema,
});

function isComplete(map: OkBrainMap): boolean {
  const fields = [
    map.what,
    map.key,
    map.focus,
    map.context,
    map.advantage,
    map.principle,
    map.method,
    map.duration,
    map.goal,
    ...map.steps,
  ];
  return fields.every((f) => f.length > 0);
}

function normalizeSteps(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? ""));
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return ["step1", "step2", "step3", "step4", "step5"].map((k) => String(obj[k] ?? ""));
  }
  return [];
}

/** Parse AI output; returns null if structurally invalid */
export function parseOkBrainMap(raw: unknown): OkBrainMap | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  try {
    const parsed = okBrainMapSchema.parse({
      what: String(obj.what ?? obj.element_1 ?? obj["1"] ?? ""),
      key: String(obj.key ?? obj.element_2 ?? obj["2"] ?? ""),
      focus: String(obj.focus ?? obj.element_3 ?? obj["3"] ?? ""),
      context: String(obj.context ?? obj.element_4 ?? obj["4"] ?? ""),
      advantage: String(obj.advantage ?? obj.element_5 ?? obj["5"] ?? ""),
      principle: String(obj.principle ?? obj.element_6 ?? obj["6"] ?? ""),
      method: String(obj.method ?? obj.element_7 ?? obj["7"] ?? ""),
      steps: normalizeSteps(obj.steps ?? obj.element_8 ?? obj["8"]),
      duration: String(obj.duration ?? obj.element_9 ?? obj["9"] ?? ""),
      goal: String(obj.goal ?? obj.element_10 ?? obj["10"] ?? ""),
    });
    return isComplete(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function assetLabel(symbol: string, locale: "en" | "zh"): string {
  if (symbol.includes("XAU") || symbol.includes("GOLD")) {
    return locale === "zh" ? "黄金" : "gold";
  }
  if (symbol.includes("BTC")) return "BTC";
  if (symbol.includes("ETH")) return "ETH";
  return symbol;
}

function biasAction(
  bias: "long" | "short" | "neutral" | "wait",
  asset: string,
  locale: "en" | "zh",
): string {
  if (locale === "zh") {
    const map = {
      long: `做多${asset}`,
      short: `做空${asset}`,
      neutral: `震荡${asset}`,
      wait: `观望${asset}`,
    };
    return map[bias];
  }
  const map = {
    long: `Long ${asset}`,
    short: `Short ${asset}`,
    neutral: `Range ${asset}`,
    wait: `Wait ${asset}`,
  };
  return map[bias];
}

function clipPhrase(text: string): string {
  const clean = text.replace(/[\n\r|·•\-—]/g, " ").trim();
  if (!clean) return "";
  return truncateOkField(clean);
}

/** Fallback when AI omits ok_brain_map */
export function deriveOkBrainMapFromSignal(params: {
  locale: "en" | "zh";
  symbol: string;
  bias: "long" | "short" | "neutral" | "wait";
  timeframe: string;
  thesis: string;
  bookmap_playbook: string;
  orderflow_triggers: string[];
  invalidation: string;
  expires_hours?: number;
}): OkBrainMap {
  const asset = assetLabel(params.symbol, params.locale);
  const thesisClip = clipPhrase(params.thesis);
  const playbookClip = clipPhrase(params.bookmap_playbook);
  const triggers = params.orderflow_triggers.map((t) => clipPhrase(t)).filter(Boolean);

  const defaultSteps =
    params.locale === "zh"
      ? ["等触发", "确认结构", "分批进场", "移动止损", "分批止盈"]
      : ["Wait trig", "Confirm", "Scale in", "Trail SL", "Take prof"];

  const steps = [...triggers.slice(0, 5)];
  while (steps.length < 5) {
    steps.push(defaultSteps[steps.length] ?? defaultSteps[4]);
  }

  if (params.locale === "zh") {
    return {
      what: biasAction(params.bias, asset, "zh"),
      key: thesisClip || "客观预判",
      focus: triggers[0] || "关键价位",
      context: playbookClip || "盘面结构",
      advantage: "订单流读法",
      principle: "严格止损",
      method: asset === "黄金" ? "ATAS集群" : "订单流法",
      steps: steps.slice(0, 5) as OkBrainMap["steps"],
      duration: params.expires_hours ? `${params.expires_hours}小时` : clipPhrase(params.timeframe) || "本周期",
      goal: params.bias === "long" ? "捕获上涨" : params.bias === "short" ? "捕获下跌" : "控制回撤",
    };
  }

  return {
    what: biasAction(params.bias, asset, "en"),
    key: thesisClip || "Objective",
    focus: triggers[0] || "Key levels",
    context: playbookClip || "Structure",
    advantage: "Order flow",
    principle: "Strict SL",
    method: "Tape read",
    steps: steps.slice(0, 5) as OkBrainMap["steps"],
    duration: params.expires_hours ? `${params.expires_hours}h` : clipPhrase(params.timeframe) || "Session",
    goal: params.bias === "long" ? "Catch up" : params.bias === "short" ? "Catch dn" : "Limit risk",
  };
}

export function resolveOkBrainMap(
  raw: unknown,
  fallback: Parameters<typeof deriveOkBrainMapFromSignal>[0],
): OkBrainMap {
  const parsed = parseOkBrainMap(raw);
  if (parsed) return parsed;
  return deriveOkBrainMapFromSignal(fallback);
}

/** Render the 0K standard sentence */
export function formatOkBrainMap(map: OkBrainMap, locale: "en" | "zh" = "zh"): string {
  const [s1, s2, s3, s4, s5] = map.steps;
  if (locale === "zh") {
    return (
      `做${map.what}的事，关键在于${map.key}。` +
      `要针对${map.focus}发力，鉴于${map.context}的形势，` +
      `发挥${map.advantage}的优势，本着${map.principle}的原则，` +
      `运用${map.method}的方法，` +
      `通过：①${s1} ②${s2} ③${s3} ④${s4} ⑤${s5}，` +
      `经过${map.duration}时间，实现${map.goal}的目标。`
    );
  }
  return (
    `To ${map.what}, the key is ${map.key}. ` +
    `Focus on ${map.focus}; given ${map.context}, ` +
    `leverage ${map.advantage}, follow ${map.principle}, ` +
    `use ${map.method}: ①${s1} ②${s2} ③${s3} ④${s4} ⑤${s5}. ` +
    `Over ${map.duration}, achieve ${map.goal}.`
  );
}

export function okBrainMapPromptLines(locale: "en" | "zh"): string {
  if (locale === "zh") {
    return `
- 必须输出 ok_brain_map 对象，遵循 0K 脑图标准格式，每个字段最多 10 个汉字（步骤共 5 条）
- ok_brain_map 字段：what(做什么事), key(关键在于), focus(针对什么发力), context(鉴于什么形势), advantage(发挥什么优势), principle(本着什么原则), method(运用什么方法), steps[5](五个步骤), duration(经过什么时间), goal(实现什么目标)
- 示例：做做多黄金的事，关键在于客观预判。要针对关键价位发力…`;
  }
  return `
- Include ok_brain_map object (OK Brain Map format). Each field ≤10 graphemes; steps array of 5 items.
- Fields: what, key, focus, context, advantage, principle, method, steps[5], duration, goal`;
}
