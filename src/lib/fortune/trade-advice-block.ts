import type { FortuneReading, FortuneTopic } from "@/types/fortune";

/**
 * Hard block on personalised buy / sell / hold / allocate advice.
 * A fortune reflection can still run. A question that asks for a trade
 * instruction does not reach the model and is not stored as a reading.
 */
const INSTRUMENT =
  /\b(gold|xauusd|xauusdt|btc|bitcoin|eth|ethereum|stock|stocks|shares|forex|crypto|perp|perpetual)\b|黄金|比特币|以太坊|股票|合约|外汇/i;

export function asksForPersonalisedTradeAdvice(question: string | null | undefined): boolean {
  const q = question?.trim() ?? "";
  if (!q) return false;

  if (/\bshould i (buy|sell|short|hold|long)\b/i.test(q)) return true;
  if (/\b(go long|go short|stop[- ]loss|take[- ]profit|leverage|position size|entry zone)\b/i.test(q)) {
    return true;
  }
  if (/\b(buy|sell|short)\b/i.test(q) && (INSTRUMENT.test(q) || /\b(buy|sell)\s+\w+/i.test(q))) {
    return true;
  }
  if (/\b(allocate|allocation)\b/i.test(q) && INSTRUMENT.test(q)) return true;
  if (/\bhold\b/i.test(q) && INSTRUMENT.test(q)) return true;

  if (/买入|卖出|做多|做空|加仓|减仓|止损|止盈|开多|开空/.test(q)) return true;
  if (/该不该买|能不能买|要不要买|要不要卖|买不买|卖不卖/.test(q)) return true;
  if (/持有.{0,12}(黄金|比特币|以太|股票|合约)/.test(q)) return true;
  if (/配置.{0,8}(仓|黄金|比特币|以太|股票)/.test(q)) return true;
  if (/(杠杆|仓位)/.test(q) && INSTRUMENT.test(q)) return true;

  return false;
}

export function refusePersonalisedTradeAdvice(input: {
  topic: FortuneTopic;
  question?: string | null;
  locale: "en" | "zh";
}): FortuneReading | null {
  if (!asksForPersonalisedTradeAdvice(input.question)) return null;

  const zh = input.locale === "zh";
  const now = new Date().toISOString();
  return {
    id: "advice-blocked",
    topic: input.topic,
    question: input.question?.trim() || null,
    title: zh ? "不能给出交易指令" : "No trade instruction",
    summary: zh
      ? "命理解读不会给出买入、卖出、持有或配置的个人建议。"
      : "A fortune reading will not give a personal buy, sell, hold, or allocation call.",
    reading: zh
      ? "这个问题是在要一笔个人交易指令。这里只做命理反思，不会给出进场、止损、目标、杠杆或仓位。"
      : "This question asks for a personal trade instruction. Fortune stays on reflection, and will not give an entry, a stop, a target, leverage, or a position size.",
    lucky: null,
    zodiac: null,
    created_at: now,
    fortune_date: null,
  };
}
