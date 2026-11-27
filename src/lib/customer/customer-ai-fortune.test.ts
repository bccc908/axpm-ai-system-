import fs from "fs/promises";
import os from "os";
import path from "path";
import { readFileSync } from "fs";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { decideApiAccess } from "@/lib/auth/api-policy";
import {
  isCustomerAiFortunePath,
  modulesForRole,
  roleCanAccessModule,
  roleCanAccessPath,
} from "@/lib/auth/permissions";
import { loginSpaceForPath, postLoginPath } from "@/lib/auth/login-space";
import { createSessionToken } from "@/lib/auth/session";
import { CUSTOMER_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/auth/types";
import { middleware } from "@/middleware";
import {
  appendCustomerMarketPrompt,
  customerMarketFile,
  staffMarketChatFile,
} from "@/lib/ai/customer-market-store";
import { en } from "@/lib/i18n/locales/en";
import { zh } from "@/lib/i18n/locales/zh";
import { translate } from "@/lib/i18n";

const root = process.cwd();
const previousSecret = process.env.AUTH_SECRET;

afterEach(() => {
  if (previousSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = previousSecret;
});

function decide(pathname: string, role: "customer" | "owner" | "admin" | "sales" | null) {
  return decideApiAccess({
    pathname,
    role,
    cronAuthorized: false,
    bridgeAuthorized: false,
  });
}

describe("customer AI surface access", () => {
  it("opens Fortune, Market AI, and Gold Signals to a customer without the market module", () => {
    expect(modulesForRole("customer")).not.toContain("market");
    expect(roleCanAccessModule("customer", "market")).toBe(false);
    expect(roleCanAccessModule("customer", "crm")).toBe(false);
    expect(roleCanAccessPath("customer", "/dashboard/fortune")).toBe(true);
    expect(roleCanAccessPath("customer", "/dashboard/market-ai")).toBe(true);
    expect(roleCanAccessPath("customer", "/dashboard/gold-signals")).toBe(true);
    expect(isCustomerAiFortunePath("/dashboard/gold-signals")).toBe(true);
    expect(roleCanAccessPath("customer", "/dashboard/groktagon")).toBe(false);
    expect(roleCanAccessPath("customer", "/dashboard/crm")).toBe(false);
    expect(roleCanAccessPath("customer", "/dashboard/solana-bot")).toBe(false);
    expect(roleCanAccessPath("sales", "/dashboard/market-ai")).toBe(false);
    expect(roleCanAccessPath("sales", "/dashboard/gold-signals")).toBe(false);
    expect(roleCanAccessPath("owner", "/dashboard/groktagon")).toBe(true);
    expect(roleCanAccessPath("owner", "/dashboard/market-ai")).toBe(true);
    expect(roleCanAccessPath("admin", "/dashboard/gold-signals")).toBe(true);
  });

  it("sends logged-out Market AI and Gold Signals visits to the customer login", () => {
    expect(loginSpaceForPath("/dashboard/market-ai")).toBe("customer");
    expect(loginSpaceForPath("/dashboard/gold-signals")).toBe("customer");
    expect(loginSpaceForPath("/dashboard/fortune")).toBe("customer");
    expect(loginSpaceForPath("/dashboard/groktagon")).toBe("staff");
    expect(loginSpaceForPath("/dashboard/crm")).toBe("staff");
    expect(postLoginPath("customer", "/dashboard/gold-signals")).toBe("/dashboard/gold-signals");
    expect(postLoginPath("customer", "/dashboard/market-ai")).toBe("/dashboard/market-ai");
    expect(postLoginPath("customer", "/dashboard/groktagon")).toBe("/dashboard/account");
    expect(postLoginPath("customer", "/dashboard/crm")).toBe("/dashboard/account");
  });

  it("denies a customer the staff Market AI stores, gold list, and staff ops", () => {
    const denied = [
      "/api/ai/market-advisor/chat",
      "/api/ai/market-advisor/history",
      "/api/ai/market-advisor/diary",
      "/api/ai/market-advisor/outputs",
      "/api/ai/market-advisor/generate-ppt",
      "/api/ai/market-knowledge",
      "/api/gold-signals",
      "/api/gold-signals/generate",
      "/api/gold-signals/automation",
      "/api/btc-signals",
      "/api/eth-signals",
      "/api/hl-signals",
      "/api/xau-signals",
      "/api/gold-spread",
      "/api/groktagon",
      "/api/crm/board",
    ];
    for (const route of denied) {
      expect(decide(route, "customer"), route).toMatchObject({ allow: false, status: 403 });
      expect(decide(route, "owner").allow, route).toBe(true);
    }
    expect(decide("/api/customer/market-chat", "customer").allow).toBe(true);
    expect(decide("/api/customer/market-chat", "owner")).toMatchObject({ allow: false, status: 403 });
    expect(decide("/api/customer/market-chat", "admin")).toMatchObject({ allow: false, status: 403 });
    expect(decide("/api/gold-signals/daily", "customer").allow).toBe(false);
  });

  it("keeps a customer prompt out of the staff market chat file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "customer-market-"));
    const staffFile = path.join(dir, "market-chat.json");
    const staffBefore = JSON.stringify({ messages: [{ content: "STAFF DESK ONLY" }] });
    await fs.writeFile(staffFile, staffBefore);
    const prompt = "fixture customer prompt — not a staff note";
    const messages = await appendCustomerMarketPrompt({
      userId: "fixture-customer",
      message: prompt,
      mode: "market",
      dir: path.join(dir, "customer-market-chat"),
    });
    expect(messages.at(-1)?.content).toBe(prompt);
    expect(await fs.readFile(staffFile, "utf8")).toBe(staffBefore);
    const saved = await fs.readFile(customerMarketFile("fixture-customer", path.join(dir, "customer-market-chat")), "utf8");
    expect(saved).toContain(prompt);
    expect(saved).not.toContain("STAFF DESK ONLY");
    expect(customerMarketFile("fixture-customer")).not.toBe(staffMarketChatFile());
    expect(customerMarketFile("fixture-customer")).toContain(`${path.sep}customer-market-chat${path.sep}`);
    expect(staffMarketChatFile()).toMatch(/market-chat\.json$/);
  });

  it("does not let the customer chat route touch staff market stores", () => {
    const route = readFileSync(path.join(root, "src/app/api/customer/market-chat/route.ts"), "utf8");
    expect(route).not.toMatch(/market-chat-store|market-advisor|market-knowledge|market-diary|deepseek/i);
    expect(route).toContain("appendCustomerMarketPrompt");
    const gold = readFileSync(path.join(root, "src/components/customer/customer-gold-signals.tsx"), "utf8");
    expect(gold).not.toMatch(/\/api\/gold-signals|Generate signal|Hyperliquid address|walletTitle/i);
    expect(gold).toContain('t("customerAi.invalidationValue")');
    expect(gold).not.toContain("Break 2,628");
    expect(gold).not.toContain("破位");
  });
});

describe("customer middleware", () => {
  it("lets a fixture customer open the three pages and still blocks CRM and Groktagon", async () => {
    process.env.AUTH_SECRET = "d".repeat(32);
    const customer = await createSessionToken({
      sub: "fixture-customer",
      role: "customer",
      email: "jamie@example.com",
      name: "Jamie",
      space: "customer",
    });
    const staff = await createSessionToken({
      sub: "owner-1",
      role: "owner",
      email: "owner@example.com",
      name: "Owner",
      space: "staff",
    });
    const cookie = { cookie: `${CUSTOMER_SESSION_COOKIE}=${customer}` };

    const loggedOutGold = await middleware(new NextRequest("http://127.0.0.1:3000/dashboard/gold-signals"));
    expect(loggedOutGold.status).toBe(307);
    expect(loggedOutGold.headers.get("location")).toContain("/customer/login");

    const loggedOutMarket = await middleware(new NextRequest("http://127.0.0.1:3000/dashboard/market-ai"));
    expect(loggedOutMarket.headers.get("location")).toContain("/customer/login");

    const loggedOutGroktagon = await middleware(new NextRequest("http://127.0.0.1:3000/dashboard/groktagon"));
    expect(loggedOutGroktagon.headers.get("location")).toContain("/login");
    expect(loggedOutGroktagon.headers.get("location")).not.toContain("/customer/login");

    const gold = await middleware(new NextRequest("http://127.0.0.1:3000/dashboard/gold-signals", { headers: cookie }));
    const market = await middleware(new NextRequest("http://127.0.0.1:3000/dashboard/market-ai", { headers: cookie }));
    const fortune = await middleware(new NextRequest("http://127.0.0.1:3000/dashboard/fortune", { headers: cookie }));
    expect(gold.status).toBe(200);
    expect(market.status).toBe(200);
    expect(fortune.status).toBe(200);

    const crm = await middleware(new NextRequest("http://127.0.0.1:3000/dashboard/crm", { headers: cookie }));
    expect(crm.status).toBe(403);

    const grok = await middleware(new NextRequest("http://127.0.0.1:3000/dashboard/groktagon", { headers: cookie }));
    expect(grok.status).toBe(307);
    expect(grok.headers.get("location")).toContain("/dashboard");

    const staffGold = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/gold-signals", {
        headers: { cookie: `${SESSION_COOKIE}=${staff}` },
      }),
    );
    expect(staffGold.status).toBe(200);

    const customerList = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/gold-signals", { headers: cookie }),
    );
    expect(customerList.status).toBe(403);

    const customerChat = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/ai/market-advisor/chat", { headers: cookie }),
    );
    expect(customerChat.status).toBe(403);
  });
});

describe("customer copy", () => {
  it("puts the Gold Signals invalidation value on an I18N key (Z1)", () => {
    expect(translate(en, "customerAi.invalidationValue")).toBe("Break 2,628");
    expect(translate(zh, "customerAi.invalidationValue")).toBe("破位 2,628");
    expect(translate(zh, "customerAi.invalidationValue")).not.toContain("Break");
    expect(translate(zh, "customerAi.invalidationValue")).not.toBe("突破 2,628");
    expect(translate(en, "goldSignals.disclaimer")).toBe(
      "For research only — not financial advice. Test in simulation before live trading.",
    );
    expect(translate(zh, "goldSignals.disclaimer")).toBe(
      "仅供研究学习，非投资建议。实盘请先在模拟盘验证，并自行承担风险。",
    );
  });

  it("keeps locked customer titles and leaves staff titles off the customer view", () => {
    expect(translate(en, "customerAi.marketTitle")).toBe("Market AI");
    expect(translate(zh, "customerAi.marketTitle")).toBe("市场 AI");
    expect(translate(en, "customerAi.goldTitle")).toBe("Gold Signals");
    expect(translate(zh, "customerAi.goldTitle")).toBe("黄金信号");
    expect(translate(en, "nav.sectionAi")).toBe("AI & Fortune");
    expect(translate(zh, "nav.sectionAi")).toBe("AI 与命理");
    expect(translate(en, "nav.fortune")).toBe("Fortune");
    expect(translate(zh, "nav.fortune")).toBe("命理运势");
    expect(translate(en, "nav.overview")).toBe("Overview");
    expect(translate(zh, "nav.overview")).toBe("总览");
    expect(translate(en, "nav.account")).toBe("My plan");
    expect(translate(zh, "nav.account")).toBe("我的套餐");
    expect(en.marketAi.title).toBe("Market AI · Second Kayden");
    expect(en.goldSignals.title).toBe("Gold Analysis Signals");

    const customerDir = path.join(root, "src/components/customer");
    const files = ["customer-shell.tsx", "customer-fortune.tsx", "customer-market-ai.tsx", "customer-gold-signals.tsx"];
    const source = files.map((file) => readFileSync(path.join(customerDir, file), "utf8")).join("\n");
    expect(source).not.toMatch(/Second Kayden|Gold Analysis Signals|Kayden AI|AXPM|Groktagon|Operations/i);
    expect(source).toContain(">KD<");

    const goldPage = readFileSync(path.join(root, "src/app/(dashboard)/dashboard/gold-signals/page.tsx"), "utf8");
    const marketPage = readFileSync(path.join(root, "src/app/(dashboard)/dashboard/market-ai/page.tsx"), "utf8");
    expect(goldPage).toContain("GoldSignalsPanel");
    expect(marketPage).toContain("MarketAiTwin");
    expect(readFileSync(path.join(root, "src/components/layout/sidebar.tsx"), "utf8")).toContain("/dashboard/groktagon");
  });
});
