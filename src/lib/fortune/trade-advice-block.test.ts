import { describe, expect, it } from "vitest";
import { buildCustomerSystemPrompt } from "@/lib/fortune/customer-prompts";
import { handleFortuneGenerate } from "@/lib/fortune/generate-handler";
import {
  asksForPersonalisedTradeAdvice,
  refusePersonalisedTradeAdvice,
} from "@/lib/fortune/trade-advice-block";
import type { FortuneProfile } from "@/types/fortune";

const profile: FortuneProfile = {
  name: "Jamie",
  birth_date: "1992-06-18",
  birth_time: "10:45",
  notes: null,
};

describe("fortune personalised trade-advice block", () => {
  it("refuses a Wealth question that asks for a buy call", () => {
    const question = "Should I buy gold now?";
    expect(asksForPersonalisedTradeAdvice(question)).toBe(true);
    const reading = refusePersonalisedTradeAdvice({ topic: "wealth", question, locale: "en" });
    expect(reading?.topic).toBe("wealth");
    expect(reading?.reading).toMatch(/will not give an entry/i);
    expect(reading?.reading).not.toMatch(/you should buy|long bias|entry zone|2,6/i);
    expect(reading?.summary).not.toMatch(/建议买入|做多/);
  });

  it("refuses an Ask-anything question that asks for a sell call in 中文", () => {
    const question = "现在该不该卖出 XAUUSD？";
    expect(asksForPersonalisedTradeAdvice(question)).toBe(true);
    const reading = refusePersonalisedTradeAdvice({ topic: "custom", question, locale: "zh" });
    expect(reading?.topic).toBe("custom");
    expect(reading?.reading).toContain("不会给出进场");
    expect(reading?.reading).not.toMatch(/建议卖出|做空|突破/);
    expect(reading?.reading).not.toContain("2,628");
  });

  it("still allows a Wealth reflection that is not a trade instruction", () => {
    expect(asksForPersonalisedTradeAdvice("How is my cash-flow luck this month?")).toBe(false);
    expect(asksForPersonalisedTradeAdvice("这个月财运节奏如何？")).toBe(false);
    expect(
      refusePersonalisedTradeAdvice({
        topic: "wealth",
        question: "How is my cash-flow luck this month?",
        locale: "en",
      }),
    ).toBeNull();
  });

  it("does not treat an ordinary life question as a trade call", () => {
    expect(asksForPersonalisedTradeAdvice("Should I sign the contract this week?")).toBe(false);
    expect(asksForPersonalisedTradeAdvice(null)).toBe(false);
  });

  it("keeps the hard rule on the customer Wealth and Ask-anything prompts", () => {
    const wealth = buildCustomerSystemPrompt("en", "wealth", profile);
    const ask = buildCustomerSystemPrompt("en", "custom", profile);
    const wealthZh = buildCustomerSystemPrompt("zh", "wealth", profile);
    const askZh = buildCustomerSystemPrompt("zh", "custom", profile);
    for (const prompt of [wealth, ask]) {
      expect(prompt).toMatch(/personalised buy, sell, hold, or allocation/i);
      expect(prompt).toMatch(/position size/i);
    }
    for (const prompt of [wealthZh, askZh]) {
      expect(prompt).toContain("禁止个人化的买入、卖出、持有或配置建议");
      expect(prompt).toContain("仓位");
    }
  });

  it("returns the refusal for a customer before any model call", async () => {
    const wealth = await handleFortuneGenerate({
      userId: "fixture-customer",
      role: "customer",
      body: { topic: "wealth", question: "Should I buy gold now?", locale: "en" },
    });
    expect(wealth.status).toBe(200);
    expect(wealth.body).toMatchObject({ adviceBlocked: true, usedAi: false });
    const wealthReading = "reading" in wealth.body ? wealth.body.reading : undefined;
    expect(wealthReading?.topic).toBe("wealth");
    expect(wealthReading?.reading).not.toMatch(/you should buy|long bias/i);

    const ask = await handleFortuneGenerate({
      userId: "fixture-customer",
      role: "customer",
      body: { topic: "custom", question: "帮我做多比特币，给止损和目标位", locale: "zh" },
    });
    expect(ask.status).toBe(200);
    expect(ask.body).toMatchObject({ adviceBlocked: true, usedAi: false });
    const askReading = "reading" in ask.body ? ask.body.reading : undefined;
    expect(askReading?.reading).toContain("不会给出进场");
    expect(askReading?.reading).not.toMatch(/建议做多|你可以做多/);
  });
});
