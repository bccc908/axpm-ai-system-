import fs from "fs/promises";
import path from "path";
import type { KnowledgeSectionId } from "@/lib/knowledge-base/sections";
import type { KnowledgeArticle } from "@/lib/knowledge-base/types";

export const SEED_OWNER_NAME = "Kayden Chiew";
/** The starter index is dated 22 Nov 2026, Malaysia time. Noon keeps that calendar day in Malaysia and UTC. */
export const SEED_UPDATED_AT = "2026-11-22T12:00:00.000+08:00";

const SEED_DIR = path.join(process.cwd(), "src/lib/knowledge-base/seeds");

const SEED_FILES: Array<{ id: string; file: string; section: KnowledgeSectionId }> = [
  { id: "kb-seed-library", file: "library-index.md", section: "company_policy" },
  { id: "kb-seed-company-policy", file: "company-policy.md", section: "company_policy" },
  { id: "kb-seed-product-trading", file: "product-trading.md", section: "product_trading" },
  { id: "kb-seed-customer-support", file: "customer-support.md", section: "customer_support" },
  { id: "kb-seed-compliance-risk", file: "compliance-risk.md", section: "compliance_risk" },
  { id: "kb-seed-operations", file: "operations.md", section: "operations" },
  { id: "kb-seed-brand-marketing", file: "brand-marketing.md", section: "brand_marketing" },
];

function splitSeedDocument(raw: string): { title: string; body: string } {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n");
  const heading = lines[0]?.match(/^#\s+(.+?)\s*$/);
  if (!heading?.[1]) {
    throw new Error("Knowledge seed is missing a title");
  }
  return {
    title: heading[1],
    body: lines.slice(1).join("\n").trim(),
  };
}

/** How-to guides copied from the staff library. Status stays template until a person approves real text. */
export async function loadSeedArticles(): Promise<KnowledgeArticle[]> {
  const articles: KnowledgeArticle[] = [];
  for (const seed of SEED_FILES) {
    const raw = await fs.readFile(path.join(SEED_DIR, seed.file), "utf-8");
    const { title, body } = splitSeedDocument(raw);
    articles.push({
      id: seed.id,
      title,
      section: seed.section,
      body,
      status: "template",
      ownerName: SEED_OWNER_NAME,
      ownerUserId: null,
      createdAt: SEED_UPDATED_AT,
      updatedAt: SEED_UPDATED_AT,
      updatedBy: null,
    });
  }
  return articles;
}
