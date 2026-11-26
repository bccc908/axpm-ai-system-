export function formatWorkflowTimestamp(iso: string, locale: "en" | "zh"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const parts = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: locale === "zh" ? "numeric" : "short",
    day: locale === "zh" ? "numeric" : "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = value("hour").padStart(2, "0");
  const minute = value("minute").padStart(2, "0");
  const time = `${hour}:${minute}`;
  const zone = value("timeZoneName");

  if (locale === "zh") {
    return `${value("year")}年${value("month")}月${value("day")}日 ${zone} ${time}`;
  }
  return `${value("day")} ${value("month")} ${value("year")}, ${time} ${zone}`;
}
