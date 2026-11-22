export const KNOWLEDGE_SECTION_IDS = [
  "company_policy",
  "product_trading",
  "customer_support",
  "compliance_risk",
  "operations",
  "brand_marketing",
] as const;

export type KnowledgeSectionId = (typeof KNOWLEDGE_SECTION_IDS)[number];

export const KNOWLEDGE_STATUSES = ["template", "draft", "approved"] as const;

export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

/** Folder names match the staff Google Drive library. */
export const KNOWLEDGE_SECTIONS: Array<{
  id: KnowledgeSectionId;
  zh: string;
  en: string;
}> = [
  { id: "company_policy", zh: "公司政策", en: "Company Policy" },
  { id: "product_trading", zh: "产品与交易", en: "Product and Trading" },
  { id: "customer_support", zh: "客户支持", en: "Customer Support" },
  { id: "compliance_risk", zh: "合规与风控", en: "Compliance and Risk" },
  { id: "operations", zh: "运营流程", en: "Operations" },
  { id: "brand_marketing", zh: "品牌与市场", en: "Brand and Marketing" },
];

export function knowledgeSection(id: string) {
  return KNOWLEDGE_SECTIONS.find((section) => section.id === id) ?? null;
}

export function isKnowledgeSection(id: string): id is KnowledgeSectionId {
  return KNOWLEDGE_SECTION_IDS.some((sectionId) => sectionId === id);
}

export function isKnowledgeStatus(status: string): status is KnowledgeStatus {
  return KNOWLEDGE_STATUSES.some((value) => value === status);
}
