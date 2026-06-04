/**
 * Parse pasted WeChat chat exports / copied conversations.
 * Supports common copy formats from WeChat desktop and mobile.
 */

export type ParsedWeChatLine = {
  sender: string;
  content: string;
  sent_at: string | null;
  direction: "inbound" | "outbound";
};

const TIMESTAMP_NAME =
  /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;
const BRACKET_TIMESTAMP =
  /^\[(\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+?):\s*(.*)$/;
const NAME_COLON = /^([^:：]{1,40})[:：]\s*(.+)$/;

function isSelfLabel(name: string, myLabels: string[]) {
  const n = name.trim().toLowerCase();
  const defaults = ["me", "我", "you", "自己", "self"];
  return [...defaults, ...myLabels.map((l) => l.toLowerCase())].includes(n);
}

function parseTimestamp(raw: string): string | null {
  const normalized = raw.replace(/\//g, "-");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseWeChatPaste(
  text: string,
  options: { myName?: string; clientName?: string } = {},
): ParsedWeChatLine[] {
  const myLabels = [options.myName, options.clientName].filter(Boolean) as string[];
  const lines = text.split(/\r?\n/);
  const results: ParsedWeChatLine[] = [];
  let pending: ParsedWeChatLine | null = null;

  function flush() {
    if (pending?.content.trim()) {
      results.push({ ...pending, content: pending.content.trim() });
    }
    pending = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const bracket = line.match(BRACKET_TIMESTAMP);
    if (bracket) {
      flush();
      const [, ts, sender, content] = bracket;
      pending = {
        sender: sender.trim(),
        content: content.trim(),
        sent_at: parseTimestamp(ts),
        direction: isSelfLabel(sender, myLabels) ? "outbound" : "inbound",
      };
      continue;
    }

    const tsName = line.match(TIMESTAMP_NAME);
    if (tsName) {
      flush();
      const [, ts, rest] = tsName;
      pending = {
        sender: rest.trim(),
        content: "",
        sent_at: parseTimestamp(ts),
        direction: isSelfLabel(rest, myLabels) ? "outbound" : "inbound",
      };
      continue;
    }

    const nameColon = line.match(NAME_COLON);
    if (nameColon && nameColon[2].length > 0) {
      flush();
      const [, sender, content] = nameColon;
      pending = {
        sender: sender.trim(),
        content: content.trim(),
        sent_at: null,
        direction: isSelfLabel(sender, myLabels) ? "outbound" : "inbound",
      };
      continue;
    }

    if (pending) {
      pending.content += (pending.content ? "\n" : "") + line;
    } else {
      pending = {
        sender: options.clientName ?? "Unknown",
        content: line,
        sent_at: null,
        direction: "inbound",
      };
    }
  }

  flush();
  return results;
}
