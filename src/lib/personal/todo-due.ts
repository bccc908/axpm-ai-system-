export type DueUrgency = "overdue" | "today" | "soon" | "later" | "none";

export function dueInputValue(dueAt: string | null) {
  if (!dueAt) return "";
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return dueAt.length >= 16 ? dueAt.slice(0, 16) : dueAt.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDueInput(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}

export function getDueUrgency(dueAt: string | null, done: boolean): DueUrgency {
  if (done || !dueAt) return "none";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "none";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfTomorrow = new Date(endOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  if (due.getTime() < now.getTime()) return "overdue";
  if (due.getTime() < endOfToday.getTime()) return "today";
  if (due.getTime() < endOfTomorrow.getTime()) return "soon";
  return "later";
}

export function formatDueTime(dueAt: string, locale: string) {
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return dueAt;
  const hasTime = dueAt.includes("T") && !dueAt.endsWith("T00:00:00.000Z");
  return d.toLocaleString(locale === "zh" ? "zh-CN" : "en-MY", {
    month: "short",
    day: "numeric",
    ...(hasTime || d.getHours() + d.getMinutes() > 0
      ? { hour: "2-digit", minute: "2-digit" }
      : {}),
  });
}

export function formatDueRelative(
  dueAt: string | null,
  done: boolean,
  locale: string,
): { label: string; urgency: DueUrgency } {
  const urgency = getDueUrgency(dueAt, done);
  if (!dueAt || urgency === "none") {
    return { label: locale === "zh" ? "无截止时间" : "No due time", urgency: "none" };
  }

  const due = new Date(dueAt);
  const now = new Date();
  const ms = due.getTime() - now.getTime();
  const absDays = Math.abs(Math.round(ms / 86_400_000));
  const timeStr = formatDueTime(dueAt, locale);

  if (urgency === "overdue") {
    if (absDays >= 1) {
      return {
        label:
          locale === "zh"
            ? `已逾期 ${absDays} 天 · ${timeStr}`
            : `Overdue ${absDays}d · ${timeStr}`,
        urgency,
      };
    }
    return {
      label: locale === "zh" ? `已逾期 · ${timeStr}` : `Overdue · ${timeStr}`,
      urgency,
    };
  }
  if (urgency === "today") {
    if (ms <= 3_600_000 * 8 && ms > 0) {
      return {
        label:
          locale === "zh"
            ? `${Math.max(1, Math.round(ms / 60_000))} 分钟后 · ${timeStr}`
            : `In ${Math.max(1, Math.round(ms / 60_000))} min · ${timeStr}`,
        urgency,
      };
    }
    return {
      label: locale === "zh" ? `今天 · ${timeStr}` : `Today · ${timeStr}`,
      urgency,
    };
  }
  if (urgency === "soon") {
    return {
      label: locale === "zh" ? `明天 · ${timeStr}` : `Tomorrow · ${timeStr}`,
      urgency,
    };
  }
  return { label: timeStr, urgency };
}

export function formatCompletedAt(completedAt: string | null, locale: string) {
  if (!completedAt) return null;
  const d = new Date(completedAt);
  if (Number.isNaN(d.getTime())) return completedAt;
  return d.toLocaleString(locale === "zh" ? "zh-CN" : "en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
