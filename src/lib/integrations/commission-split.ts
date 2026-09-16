import type { ParsedExcelSheet } from "@/lib/integrations/excel-parse";

export type CommissionRow = {
  index: number;
  client: string;
  profit: number | null;
  rate: number | null;
  splitInSheet: number | null;
  computedSplit: number | null;
  effectiveSplit: number;
  raw: Record<string, string | number | null>;
};

export type ClientCommissionSummary = {
  client: string;
  profit: number;
  split: number;
  trades: number;
};

export type CommissionResult = {
  rows: CommissionRow[];
  summary: {
    totalProfit: number;
    totalSplit: number;
    rowCount: number;
    clientCount: number;
    byClient: ClientCommissionSummary[];
  };
  detectedColumns: {
    client: string | null;
    profit: string | null;
    rate: string | null;
    split: string | null;
    lots: string | null;
  };
  defaultRateUsed: number | null;
};

const CLIENT_PATTERNS = [/客户/, /姓名/, /账户/, /账号/, /交易员/, /跟单/, /名字/, /client/i, /name/i];
const PROFIT_PATTERNS = [/盈亏/, /利润/, /净盈亏/, /盈利/, /损益/, /pnl/i, /profit/i, /\bpl\b/i, /总盈/];
const RATE_PATTERNS = [/分成比例/, /佣金比例/, /提成比例/, /比例/, /rate/i, /%/];
const SPLIT_PATTERNS = [/分成金额/, /应分/, /分成额/, /^分成$/, /佣金/, /提成/, /commission/i];
const LOT_PATTERNS = [/手数/, /lots/i, /交易量/, /volume/i];

function findColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const header of headers) {
    const h = header.trim();
    if (patterns.some((p) => p.test(h))) return header;
  }
  return null;
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let text = String(value).trim();
  if (!text || text === "—" || text === "-") return null;
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
  text = text.replace(/[(),￥¥$%\s]/g, "").replace(/,/g, "");
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return negative && n > 0 ? -n : n;
}

/** Normalize rate to 0–1 (30 → 0.3, 0.3 → 0.3). */
export function parseRate(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1 && value <= 100) return value / 100;
    if (value >= 0 && value <= 1) return value;
    return null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const hasPercent = text.includes("%");
  const n = parseNumber(text);
  if (n == null) return null;
  if (hasPercent || n > 1) return n / 100;
  return n;
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeCommissionSplit(
  sheet: ParsedExcelSheet,
  options?: { defaultRate?: number },
): CommissionResult {
  const defaultRate =
    options?.defaultRate != null && options.defaultRate > 0
      ? options.defaultRate > 1
        ? options.defaultRate / 100
        : options.defaultRate
      : null;

  const clientCol = findColumn(sheet.headers, CLIENT_PATTERNS);
  const profitCol = findColumn(sheet.headers, PROFIT_PATTERNS);
  const rateCol = findColumn(sheet.headers, RATE_PATTERNS);
  const splitCol = findColumn(sheet.headers, SPLIT_PATTERNS);
  const lotsCol = findColumn(sheet.headers, LOT_PATTERNS);

  const rows: CommissionRow[] = [];
  let globalRate = defaultRate;

  for (let i = 0; i < sheet.rows.length; i++) {
    const raw = sheet.rows[i];
    const client = clientCol ? String(raw[clientCol] ?? "").trim() || "—" : `第${i + 1}笔`;
    const profit = profitCol ? parseNumber(raw[profitCol]) : null;
    const rate = rateCol ? parseRate(raw[rateCol]) : globalRate;
    const splitInSheet = splitCol ? parseNumber(raw[splitCol]) : null;

    if (rate != null && globalRate == null && !rateCol) {
      globalRate = rate;
    }

    let computedSplit: number | null = null;
    if (profit != null && rate != null) {
      computedSplit = roundMoney(profit * rate);
    }

    const effectiveSplit =
      splitInSheet != null
        ? roundMoney(splitInSheet)
        : computedSplit != null
          ? computedSplit
          : 0;

    const hasData =
      profit != null ||
      splitInSheet != null ||
      (lotsCol && raw[lotsCol] != null) ||
      (clientCol && client !== "—");

    if (!hasData) continue;

    rows.push({
      index: i + 1,
      client,
      profit,
      rate,
      splitInSheet,
      computedSplit,
      effectiveSplit,
      raw,
    });
  }

  const byClientMap = new Map<string, ClientCommissionSummary>();
  for (const row of rows) {
    const cur = byClientMap.get(row.client) ?? {
      client: row.client,
      profit: 0,
      split: 0,
      trades: 0,
    };
    cur.profit += row.profit ?? 0;
    cur.split += row.effectiveSplit;
    cur.trades += 1;
    byClientMap.set(row.client, cur);
  }

  const byClient = [...byClientMap.values()]
    .map((c) => ({
      ...c,
      profit: roundMoney(c.profit),
      split: roundMoney(c.split),
    }))
    .sort((a, b) => b.split - a.split);

  return {
    rows,
    summary: {
      totalProfit: roundMoney(rows.reduce((s, r) => s + (r.profit ?? 0), 0)),
      totalSplit: roundMoney(rows.reduce((s, r) => s + r.effectiveSplit, 0)),
      rowCount: rows.length,
      clientCount: byClient.length,
      byClient,
    },
    detectedColumns: {
      client: clientCol,
      profit: profitCol,
      rate: rateCol,
      split: splitCol,
      lots: lotsCol,
    },
    defaultRateUsed: globalRate ?? defaultRate,
  };
}
