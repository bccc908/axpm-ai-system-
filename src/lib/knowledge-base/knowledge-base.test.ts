import { createHash } from "crypto";
import { readFileSync } from "fs";
import { mkdtemp, rm, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { roleCanAccessPath } from "@/lib/auth/permissions";
import { canApproveKnowledge, canEditKnowledge, canReadKnowledge } from "@/lib/knowledge-base/access";
import { parseKnowledgeMarkdown } from "@/lib/knowledge-base/markdown";
import { KNOWLEDGE_SECTIONS } from "@/lib/knowledge-base/sections";
import type { KnowledgeActor } from "@/lib/knowledge-base/types";

const tempDirs: string[] = [];
const seedDir = path.join(process.cwd(), "src/lib/knowledge-base/seeds");

const owner: KnowledgeActor = { id: "owner-1", name: "Kayden Chiew", role: "owner" };
const sales: KnowledgeActor = { id: "sales-1", name: "Floor Staff", role: "sales" };
const viewer: KnowledgeActor = { id: "viewer-1", name: "Read Only", role: "viewer" };

async function hashSeeds() {
  const names = [
    "library-index.md",
    "company-policy.md",
    "product-trading.md",
    "customer-support.md",
    "compliance-risk.md",
    "operations.md",
    "brand-marketing.md",
  ];
  const hash = createHash("sha256");
  for (const name of names) {
    hash.update(await readFile(path.join(seedDir, name)));
  }
  return hash.digest("hex");
}

beforeEach(async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "axpm-knowledge-"));
  tempDirs.push(dir);
  process.env.AXPM_KNOWLEDGE_BASE_FILE = path.join(dir, "knowledge-base.json");
});

afterEach(async () => {
  delete process.env.AXPM_KNOWLEDGE_BASE_FILE;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("staff knowledge base", () => {
  it("seeds six sections with template guides and no approved policy", async () => {
    const { listKnowledgeArticles, lookupApprovedKnowledge } = await import(
      "@/lib/knowledge-base/store"
    );
    const library = await listKnowledgeArticles();

    expect(library.sections.map((section) => section.zh)).toEqual([
      "公司政策",
      "产品与交易",
      "客户支持",
      "合规与风控",
      "运营流程",
      "品牌与市场",
    ]);
    expect(library.stats).toEqual({ total: 7, template: 7, draft: 0, approved: 0 });
    expect(library.articles.every((article) => article.status === "template")).toBe(true);
    expect(library.articles.every((article) => article.ownerName === "Kayden Chiew")).toBe(true);
    expect(library.sections.find((section) => section.id === "company_policy")?.count).toBe(2);
    expect(await lookupApprovedKnowledge("KYC")).toEqual([]);
    expect(await lookupApprovedKnowledge("leverage")).toEqual([]);
  });

  it("keeps the starter guides as writing templates, not invented product or compliance terms", async () => {
    const { getKnowledgeArticle } = await import("@/lib/knowledge-base/store");
    const product = await getKnowledgeArticle("kb-seed-product-trading");
    const compliance = await getKnowledgeArticle("kb-seed-compliance-risk");
    const support = await getKnowledgeArticle("kb-seed-customer-support");
    const brand = await getKnowledgeArticle("kb-seed-brand-marketing");

    expect(product?.title).toBe("产品与交易 / Product and Trading");
    expect(product?.body).toContain("Do not invent prices, leverage, or product terms.");
    expect(product?.body).not.toMatch(/\d+\s*:\s*\d+/);
    expect(product?.body).not.toMatch(/\d+%/);
    expect(compliance?.body).toContain("Do not invent a compliance position.");
    expect(support?.body).toContain(
      "Support bots should not send a client message that is not based on an approved document here",
    );
    expect(brand?.body).toContain("#ff6a32");
    expect(brand?.body).toContain("#111521");
    expect(brand?.body).toContain("Kayden’s approval");
  });

  it("searches title and body, and only returns approved articles from lookup", async () => {
    const before = await hashSeeds();
    const { listKnowledgeArticles, lookupApprovedKnowledge, updateKnowledgeArticle, getKnowledgeArticle } =
      await import("@/lib/knowledge-base/store");

    const kyc = await listKnowledgeArticles({ q: "kyc" });
    expect(kyc.articles.map((article) => article.id)).toContain("kb-seed-customer-support");
    const chinese = await listKnowledgeArticles({ q: "合规" });
    expect(chinese.articles.map((article) => article.id)).toContain("kb-seed-compliance-risk");
    expect(chinese.articles.every((article) => article.status === "template")).toBe(true);
    const bySection = await listKnowledgeArticles({ section: "operations" });
    expect(bySection.articles).toHaveLength(1);
    expect(bySection.articles[0]?.title).toBe("运营流程 / Operations");

    await expect(
      updateKnowledgeArticle("kb-seed-customer-support", { status: "approved" }, owner),
    ).rejects.toMatchObject({ code: "invalid" });

    const realText =
      "Agreed support note for this test only: ask the client to use the onboarding form already sent to them.";
    const approved = await updateKnowledgeArticle(
      "kb-seed-customer-support",
      { body: realText, status: "approved" },
      owner,
    );
    expect(approved.article.status).toBe("approved");
    expect(approved.demoted).toBe(false);

    const matches = await lookupApprovedKnowledge("onboarding form");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      id: "kb-seed-customer-support",
      status: "approved",
      ownerName: "Kayden Chiew",
    });
    expect(await lookupApprovedKnowledge("leverage")).toEqual([]);

    const demoted = await updateKnowledgeArticle(
      "kb-seed-customer-support",
      { body: `${realText}\nStaff edited the wording.` },
      sales,
    );
    expect(demoted.demoted).toBe(true);
    expect(demoted.article.status).toBe("draft");
    expect(await lookupApprovedKnowledge("onboarding form")).toEqual([]);

    const stored = await getKnowledgeArticle("kb-seed-customer-support");
    expect(stored?.updatedBy).toBe("Floor Staff");
    expect(await hashSeeds()).toBe(before);
  });

  it("lets staff create a draft, blocks viewers, and keeps the file after a fresh read", async () => {
    const {
      createKnowledgeArticle,
      listKnowledgeArticles,
      deleteKnowledgeArticle,
      getKnowledgeBaseFile,
    } = await import("@/lib/knowledge-base/store");

    await expect(
      createKnowledgeArticle(
        {
          title: "Handover note",
          section: "operations",
          body: "Replace this draft with the agreed handover steps.",
        },
        viewer,
      ),
    ).rejects.toMatchObject({ code: "forbidden" });

    await expect(
      createKnowledgeArticle(
        {
          title: "Not official yet",
          section: "customer_support",
          body: "A draft answer that has not been approved.",
          status: "approved",
        },
        sales,
      ),
    ).rejects.toMatchObject({ code: "approve_required" });

    const created = await createKnowledgeArticle(
      {
        title: "Handover note",
        section: "operations",
        body: "Replace this draft with the agreed handover steps.",
        ownerName: "Floor Staff",
      },
      sales,
    );
    expect(created.status).toBe("draft");
    expect(created.ownerName).toBe("Floor Staff");

    const again = await listKnowledgeArticles({ q: "handover note" });
    expect(again.articles.map((article) => article.id)).toContain(created.id);

    const file = JSON.parse(await readFile(getKnowledgeBaseFile(), "utf-8")) as {
      articles: Array<{ id: string }>;
    };
    expect(file.articles.some((article) => article.id === created.id)).toBe(true);

    await expect(deleteKnowledgeArticle(created.id, sales)).rejects.toMatchObject({ code: "forbidden" });
    await deleteKnowledgeArticle(created.id, owner);
    const afterDelete = await listKnowledgeArticles({ q: "handover note" });
    expect(afterDelete.articles).toHaveLength(0);
    expect((await listKnowledgeArticles()).stats.total).toBe(7);
  });

  it("does not reseed when the library file already exists", async () => {
    const { listKnowledgeArticles, getKnowledgeBaseFile } = await import("@/lib/knowledge-base/store");
    await writeFile(getKnowledgeBaseFile(), JSON.stringify({ articles: [] }), "utf-8");
    const library = await listKnowledgeArticles();
    expect(library.stats.total).toBe(0);
  });
});

describe("knowledge access", () => {
  it("is staff-only and keeps customers off the page", () => {
    expect(KNOWLEDGE_SECTIONS).toHaveLength(6);
    expect(canReadKnowledge("owner")).toBe(true);
    expect(canReadKnowledge("viewer")).toBe(true);
    expect(canEditKnowledge("viewer")).toBe(false);
    expect(canEditKnowledge("sales")).toBe(true);
    expect(canEditKnowledge("finance")).toBe(true);
    expect(canApproveKnowledge("sales")).toBe(false);
    expect(canApproveKnowledge("admin")).toBe(true);
    expect(canReadKnowledge("customer")).toBe(false);
    expect(canReadKnowledge("personal")).toBe(false);

    expect(roleCanAccessPath("customer", "/dashboard/knowledge")).toBe(false);
    expect(roleCanAccessPath("personal", "/dashboard/knowledge/new")).toBe(false);
    expect(roleCanAccessPath("viewer", "/dashboard/knowledge")).toBe(true);
    expect(roleCanAccessPath("sales", "/dashboard/knowledge/kb-seed-library")).toBe(true);
    expect(roleCanAccessPath("owner", "/dashboard/knowledge")).toBe(true);
  });
});

describe("knowledge markdown", () => {
  it("parses headings and lists without treating HTML as markup", () => {
    const blocks = parseKnowledgeMarkdown(
      "## Folders\n\n- 公司政策 — rules\n\n1. Drop official documents\n2. Use clear titles\n\n<script>alert(1)</script>",
    );
    expect(blocks).toEqual([
      { type: "heading", level: 2, text: "Folders" },
      { type: "list", ordered: false, items: ["公司政策 — rules"] },
      { type: "list", ordered: true, items: ["Drop official documents", "Use clear titles"] },
      { type: "paragraph", text: "<script>alert(1)</script>" },
    ]);
  });
});

describe("knowledge lookup does not send client messages", () => {
  it("keeps reply generation and public chat away from the library", () => {
    const srcRoot = path.join(process.cwd(), "src");
    const read = (rel: string) => readFileSync(path.join(srcRoot, rel), "utf-8");
    const replyAgent = read("components/ai/customer-reply-agent.tsx");
    const generateStart = replyAgent.indexOf("body: JSON.stringify({");
    const generateBlock = replyAgent.slice(generateStart, replyAgent.indexOf("});", generateStart));
    expect(replyAgent).toContain("ApprovedKnowledgeLookup");
    expect(generateBlock).not.toMatch(/knowledge|lookup|article/i);

    const lookup = read("components/knowledge/approved-knowledge-lookup.tsx");
    expect(lookup).toContain("/api/knowledge-base/lookup");
    expect(lookup).not.toMatch(/method:\s*"POST"/);
    expect(lookup).not.toMatch(/sendWhatsApp|sendWeChat|sendTelegram|createMessage/);

    const lookupRoute = read("app/api/knowledge-base/lookup/route.ts");
    expect(lookupRoute).toContain("lookupApprovedKnowledge");
    expect(lookupRoute).toContain("sendsToClient: false");
    expect(lookupRoute).toContain("approvedOnly: true");
    expect(lookupRoute).not.toMatch(/sendWhatsApp|sendWeChat|sendTelegram|createMessage/);

    for (const rel of [
      "app/api/ai/reply/route.ts",
      "lib/ai/auto-reply.ts",
      "lib/widget/chat-handler.ts",
      "lib/support/draft-approval.ts",
    ]) {
      const source = read(rel);
      expect(source).not.toContain("lookupApprovedKnowledge");
      expect(source).not.toContain("knowledge-base");
    }
  });
});
