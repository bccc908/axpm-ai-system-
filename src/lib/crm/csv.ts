function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

function escapeCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(headers: string[], rows: string[][]) {
  const head = headers.map(escapeCell).join(",");
  const body = rows.map((row) => row.map((cell) => escapeCell(cell ?? "")).join(",")).join("\n");
  return `${head}\n${body}\n`;
}
