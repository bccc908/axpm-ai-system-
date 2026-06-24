/** Post-process daily fortune markdown — strip AI drift without user intervention. */

export function sanitizeDailySummary(summary: string | null): string | null {
  if (!summary) return summary;
  let s = summary;
  s = s.replace(/[,，]?\s*综合\s*[\d.]+\/10/g, "");
  s = s.replace(/[,，]?\s*整体运势\s*[⭐★☆\s]+/g, "");
  return s.trim() || summary;
}

export function sanitizeDailyReadingMarkdown(text: string): string {
  let s = text;

  // Remove numeric x/10 scores (including after star lines)
  s = s.replace(/(⭐+[☆\s]*)+\s*[\d.]+\/10/g, (m) => m.replace(/\s*[\d.]+\/10/, "").trim());
  s = s.replace(/(^|\n)(##[^\n]*)\s+[\d.]+\/10\s*$/gm, "$1$2");
  s = s.replace(/\s+[\d.]+\/10(?=\s|$)/g, "");

  // Drop legacy hour-template sections if the model adds them
  s = s.replace(/\n##\s*时辰[^\n]*\n[\s\S]*?(?=\n##\s|$)/g, "");
  s = s.replace(/\n##\s*此时辰[^\n]*\n[\s\S]*?(?=\n##\s|$)/g, "");

  // Remove inline 时辰 callouts (daily style = no time-slot playbook)
  s = s.replace(/[（(]?(?:上午|下午|晚上)?[子丑寅卯辰巳午未申酉戌亥]时[（(][^）)\n]{2,40}[）)]/g, "");
  s = s.replace(/[，,。；;]\s*(?:上午|下午)?[子丑寅卯辰巳午未申酉戌亥]时[^。\n]{2,40}/g, "");

  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
