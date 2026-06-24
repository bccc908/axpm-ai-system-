import type { FortuneReading, FortuneTopic } from "@/types/fortune";

export type FortuneReadingImport = Omit<FortuneReading, "id">;

type ChatGptNode = {
  id?: string;
  message?: {
    author?: { role?: string };
    content?: { content_type?: string; parts?: unknown[] };
    create_time?: number;
  } | null;
  parent?: string | null;
  children?: string[];
};

type ChatGptConversation = {
  title?: string;
  create_time?: number;
  update_time?: number;
  current_node?: string;
  mapping?: Record<string, ChatGptNode>;
};

export type ParsedChatMessage = {
  role: "user" | "assistant" | "other";
  text: string;
  createTime: number | null;
};

const FORTUNE_KEYWORDS = [
  "fortune",
  "horoscope",
  "zodiac",
  "tarot",
  "astrology",
  "命理",
  "运势",
  "占卜",
  "八字",
  "星座",
  "塔罗",
  "风水",
  "求签",
  "算命",
  "紫微",
  "易经",
];

function extractTextFromParts(parts: unknown[] | undefined): string {
  if (!parts?.length) return "";
  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") {
        const obj = part as Record<string, unknown>;
        if (typeof obj.text === "string") return obj.text;
        if (typeof obj.content === "string") return obj.content;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function nodeText(node: ChatGptNode | undefined): string {
  const message = node?.message;
  if (!message?.content) return "";
  const type = message.content.content_type ?? "text";
  if (type === "text" || type === "multimodal_text") {
    return extractTextFromParts(message.content.parts);
  }
  if (type === "code" && message.content.parts?.[0]) {
    return String(message.content.parts[0]);
  }
  return extractTextFromParts(message.content.parts);
}

function nodeRole(node: ChatGptNode | undefined): ParsedChatMessage["role"] {
  const role = node?.message?.author?.role;
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  return "other";
}

function getActivePath(
  mapping: Record<string, ChatGptNode>,
  currentNode?: string,
): ChatGptNode[] {
  let nodeId = currentNode;
  if (!nodeId || !mapping[nodeId]) {
    const leaves = Object.values(mapping).filter((node) => !node.children?.length);
    const leaf = leaves.sort(
      (a, b) => (b.message?.create_time ?? 0) - (a.message?.create_time ?? 0),
    )[0];
    nodeId = leaf?.id;
  }

  const path: ChatGptNode[] = [];
  const seen = new Set<string>();
  while (nodeId && mapping[nodeId] && !seen.has(nodeId)) {
    seen.add(nodeId);
    path.unshift(mapping[nodeId]);
    nodeId = mapping[nodeId].parent ?? undefined;
  }
  return path;
}

export function parseChatGptConversation(conversation: ChatGptConversation): ParsedChatMessage[] {
  const mapping = conversation.mapping;
  if (!mapping) return [];

  return getActivePath(mapping, conversation.current_node)
    .map((node) => ({
      role: nodeRole(node),
      text: nodeText(node),
      createTime: node.message?.create_time ?? null,
    }))
    .filter((msg) => msg.text.length > 0 && msg.role !== "other");
}

function guessTopic(text: string): FortuneTopic {
  const sample = text.toLowerCase();
  if (/今日|daily|today|晨运|今日运/.test(sample)) return "daily";
  if (/事业|career|工作|职场|job/.test(sample)) return "career";
  if (/财|wealth|money|投资|赚钱|收入/.test(sample)) return "wealth";
  if (/感情|love|恋爱|婚姻|桃花|伴侣/.test(sample)) return "love";
  if (/紫微|ziwei|斗数|命宫|主星/.test(sample)) return "ziwei";
  if (/梅花|meihua|本卦|互卦|变卦/.test(sample)) return "meihua";
  if (/易经|周易|六十四卦|卦辞|象辞|yijing|i ching/.test(sample)) return "yijing";
  if (/称骨|骨重|袁天罡|两.*钱/.test(sample)) return "chenggu";
  if (/面相|五官|三停|天庭|地阁|眉|相学|physiognomy|mianxiang/.test(sample)) return "mianxiang";
  if (/星座|astro|zodiac sign|horoscope|水瓶座|白羊座|金牛座|双子座|巨蟹座|狮子座|处女座|天秤座|天蝎座|射手座|摩羯座|双鱼座/.test(sample))
    return "astro";
  if (/塔罗|tarot|大阿尔|权杖|圣杯|宝剑|星币/.test(sample)) return "tarot";
  if (/数字命理|numerology|生命灵数|灵数|数字能量/.test(sample)) return "numerology";
  if (/多维|综合解读|对照表|统一结论|combined/.test(sample)) return "combined";
  if (/综合|general|人生|命盘|八字/.test(sample)) return "general";
  return "custom";
}

function titleFromText(text: string, fallback: string) {
  const line = text.split("\n").find((part) => part.trim())?.trim() ?? fallback;
  return line.length > 80 ? `${line.slice(0, 77)}...` : line;
}

function toIsoTime(unix: number | null | undefined, fallback?: number) {
  const value = unix ?? fallback;
  if (!value) return new Date().toISOString();
  return new Date(value * 1000).toISOString();
}

export function messagesToReadings(input: {
  title: string;
  messages: ParsedChatMessage[];
  source: "chatgpt" | "paste";
}): FortuneReadingImport[] {
  const readings: FortuneReadingImport[] = [];
  let pendingQuestion: ParsedChatMessage | null = null;

  for (const message of input.messages) {
    if (message.role === "user") {
      pendingQuestion = message;
      continue;
    }
    if (message.role !== "assistant") continue;

    const question = pendingQuestion?.text ?? null;
    const combined = `${input.title}\n${question ?? ""}\n${message.text}`;
    readings.push({
      topic: guessTopic(combined),
      question,
      title: question ? titleFromText(question, input.title) : titleFromText(message.text, input.title),
      reading: message.text,
      summary: message.text.split("\n").find((line) => line.trim())?.slice(0, 120) ?? null,
      lucky: null,
      zodiac: null,
      created_at: toIsoTime(message.createTime, pendingQuestion?.createTime ?? undefined),
    });
    pendingQuestion = null;
  }

  if (readings.length === 0 && input.messages.length === 1 && input.messages[0].role === "assistant") {
    const only = input.messages[0];
    readings.push({
      topic: guessTopic(`${input.title}\n${only.text}`),
      question: null,
      title: titleFromText(only.text, input.title),
      reading: only.text,
      summary: only.text.split("\n").find((line) => line.trim())?.slice(0, 120) ?? null,
      lucky: null,
      zodiac: null,
      created_at: toIsoTime(only.createTime),
    });
  }

  return readings;
}

function normalizeConversations(raw: unknown): ChatGptConversation[] {
  if (Array.isArray(raw)) {
    return raw.filter((item) => item && typeof item === "object") as ChatGptConversation[];
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.conversations)) {
      return obj.conversations.filter((item) => item && typeof item === "object") as ChatGptConversation[];
    }
    if ("mapping" in obj) {
      return [obj as ChatGptConversation];
    }
  }
  return [];
}

function parseTitleFilters(filter?: string | null) {
  if (!filter?.trim()) return [];
  return filter
    .split(/[,，;；\n]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function matchesTitleFilter(title: string, filters: string[]) {
  if (filters.length === 0) return true;
  const lower = title.toLowerCase();
  return filters.some((filter) => lower.includes(filter));
}

function autoFortuneFilter(title: string) {
  const lower = title.toLowerCase();
  return FORTUNE_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

export function parseChatGptExport(
  raw: unknown,
  options?: { titleFilter?: string | null; onlyFortune?: boolean },
): FortuneReadingImport[] {
  const filters = parseTitleFilters(options?.titleFilter);
  const onlyFortune = options?.onlyFortune ?? filters.length === 0;
  const conversations = normalizeConversations(raw);
  const readings: FortuneReadingImport[] = [];

  for (const conversation of conversations) {
    const title = conversation.title?.trim() || "ChatGPT reading";
    if (!matchesTitleFilter(title, filters)) continue;
    if (onlyFortune && filters.length === 0 && !autoFortuneFilter(title)) continue;

    const messages = parseChatGptConversation(conversation);
    if (messages.length === 0) continue;

    readings.push(
      ...messagesToReadings({
        title,
        messages,
        source: "chatgpt",
      }),
    );
  }

  return readings;
}

const PASTE_PATTERNS = [
  /^(?:You|User|Human|Me|我|用户)\s*[:：]\s*/i,
  /^(?:ChatGPT|Assistant|AI|GPT|助手|ChatGPT said)\s*[:：]\s*/i,
];

export function parsePastedConversation(text: string, title = "Imported chat"): FortuneReadingImport[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const messages: ParsedChatMessage[] = [];
  let currentRole: ParsedChatMessage["role"] | null = null;
  let buffer: string[] = [];

  function flush() {
    const content = buffer.join("\n").trim();
    if (currentRole && content) {
      messages.push({ role: currentRole, text: content, createTime: null });
    }
    buffer = [];
  }

  for (const line of lines) {
    let matched = false;
    for (const pattern of PASTE_PATTERNS) {
      if (pattern.test(line)) {
        flush();
        currentRole = /you|user|human|me|我|用户/i.test(line) ? "user" : "assistant";
        buffer.push(line.replace(pattern, "").trim());
        matched = true;
        break;
      }
    }
    if (!matched) {
      buffer.push(line);
    }
  }
  flush();

  if (messages.length === 0 && text.trim()) {
    return [
      {
        topic: guessTopic(text),
        question: null,
        title: titleFromText(text, title),
        reading: text.trim(),
        summary: text.trim().slice(0, 120),
        lucky: null,
        zodiac: null,
        created_at: new Date().toISOString(),
      },
    ];
  }

  return messagesToReadings({ title, messages, source: "paste" });
}

function isLikelyUserTurn(block: string): boolean {
  const trimmed = block.trim();
  if (!trimmed) return false;
  const lines = trimmed.split("\n").filter((line) => line.trim());
  if (lines.length > 8) return false;

  if (/^(?:You|User|Human|Me|我|用户)\s*[:：]/i.test(trimmed)) return true;
  if (/[?？]/.test(trimmed) && trimmed.length <= 220) return true;
  if (
    /^(好的|幫我|帮我|我要|星期|今天几号|开挂|配合运气|我的生成八字|现在我就负责|今天跑到心太累)/.test(
      trimmed,
    ) &&
    trimmed.length <= 420
  ) {
    return true;
  }
  if (/^我/.test(trimmed) && trimmed.length <= 420 && lines.length <= 8) return true;

  return false;
}

/** Paste without You:/ChatGPT: labels — common when copying from ChatGPT UI */
export function parseLooseChatPaste(text: string, title = "Imported chat"): FortuneReadingImport[] {
  const labeled = parsePastedConversation(text, title);
  if (labeled.length > 1) return labeled;
  if (labeled.length === 1 && labeled[0].question) return labeled;

  const blocks = text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const merged: string[] = [];
  let assistantBuffer: string[] = [];

  function flushAssistant() {
    if (assistantBuffer.length) {
      merged.push(assistantBuffer.join("\n\n"));
      assistantBuffer = [];
    }
  }

  for (const block of blocks) {
    if (isLikelyUserTurn(block)) {
      flushAssistant();
      merged.push(`__USER__${block}`);
    } else {
      assistantBuffer.push(block);
    }
  }
  flushAssistant();

  const messages: ParsedChatMessage[] = [];
  for (const item of merged) {
    if (item.startsWith("__USER__")) {
      messages.push({ role: "user", text: item.slice(8), createTime: null });
      continue;
    }
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      last.text = `${last.text}\n\n${item}`;
    } else {
      messages.push({ role: "assistant", text: item, createTime: null });
    }
  }

  if (messages.length === 0 && text.trim()) {
    return parsePastedConversation(text, title);
  }

  return messagesToReadings({ title, messages, source: "paste" });
}

export function parseReadingsJson(raw: unknown): FortuneReadingImport[] {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { readings?: unknown }).readings)
    ? (raw as { readings: unknown[] }).readings
    : [];

  const readings: FortuneReadingImport[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<FortuneReading>;
    if (!row.reading?.trim()) continue;
    readings.push({
      topic: row.topic ?? guessTopic(`${row.title ?? ""}\n${row.reading}`),
      question: row.question ?? null,
      title: row.title?.trim() || titleFromText(row.reading, "Imported reading"),
      reading: row.reading.trim(),
      summary: row.summary ?? row.reading.slice(0, 120),
      lucky: row.lucky ?? null,
      zodiac: row.zodiac ?? null,
      created_at: row.created_at ?? new Date().toISOString(),
    });
  }
  return readings;
}

export function previewImportSummary(readings: FortuneReadingImport[]) {
  const titles = new Set<string>();
  for (const reading of readings) {
    titles.add(reading.title);
  }
  return {
    readings: readings.length,
    conversations: titles.size,
    samples: readings.slice(0, 5).map((reading) => ({
      title: reading.title,
      question: reading.question,
      created_at: reading.created_at,
      preview: reading.reading.slice(0, 120),
    })),
  };
}
