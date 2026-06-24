import type { FortuneProfile, FortuneTopic } from "@/types/fortune";

const topicLabels: Record<FortuneTopic, { en: string; zh: string }> = {
  daily: { en: "Today's fortune", zh: "今日运势" },
  career: { en: "Career & work", zh: "事业运" },
  wealth: { en: "Wealth & money", zh: "财运" },
  love: { en: "Love & relationships", zh: "感情运" },
  general: { en: "General life path", zh: "综合运势" },
  astro: { en: "Western astrology", zh: "星座运势" },
  tarot: { en: "Tarot reading", zh: "塔罗占卜" },
  numerology: { en: "Numerology", zh: "数字命理" },
  ziwei: { en: "Zi Wei Dou Shu", zh: "紫微斗数" },
  meihua: { en: "Plum Blossom I Ching", zh: "梅花易数" },
  yijing: { en: "I Ching", zh: "易经" },
  chenggu: { en: "Bone weight fortune", zh: "称骨算命" },
  mianxiang: { en: "Chinese physiognomy", zh: "面相分析" },
  combined: { en: "Multi-system synthesis", zh: "多维综合" },
  custom: { en: "Personal question", zh: "个人问事" },
};

export function buildCustomerSystemPrompt(
  locale: "en" | "zh",
  topic: FortuneTopic,
  profile: FortuneProfile,
) {
  const topicLabel = topicLabels[topic][locale];
  const name = profile.name?.trim() || (locale === "zh" ? "用户" : "the reader");
  const birth = profile.birth_date?.trim() || (locale === "zh" ? "未提供" : "not provided");
  const time = profile.birth_time?.trim() || (locale === "zh" ? "未提供" : "not provided");
  const notes = profile.notes?.trim() || "";

  if (locale === "zh") {
    const extra =
      topic === "mianxiang"
        ? [
            "",
            "面相分析额外要求：",
            "- 用三停、五官、十二宫、气色体系解读",
            "- 若用户描述了五官/脸型/痣，必须逐条分析",
            "- 若无描述，据出生时辰推断典型面相倾向，并提示对照自身",
            "- 给仪容/作息/心态改运建议，非医疗整容建议",
          ].join("\n")
        : "";

    return [
      "你是一位温和、具体、可执行的命理顾问，为订阅用户做个人解读。",
      `读者：${name}；出生日期：${birth}；出生时辰：${time}`,
      notes ? `用户备注：${notes}` : "",
      `当前主题：${topicLabel}`,
      extra,
      "",
      "写作要求：",
      "1. 结合用户出生信息（若有）做个性化分析，禁止空泛鸡汤",
      "2. 给出今天/本周可执行建议，用 ## 小标题组织 Markdown",
      "3. 可用 ★ 星级、✅适合 / ❌不宜 清单",
      "4. 仅供娱乐与个人反思，非医疗/法律/投资建议",
      "5. 只输出合法 JSON：{ title, summary, reading, lucky: { color, number, direction, keyword } }",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const extraEn =
    topic === "mianxiang"
      ? [
          "",
          "Physiognomy extras:",
          "- Use three zones, five features, twelve palaces, complexion",
          "- If user describes facial features, analyze each point",
          "- Otherwise infer typical tendencies from birth hour; ask them to compare in mirror",
          "- Lifestyle/grooming tips only — not medical or cosmetic surgery advice",
        ].join("\n")
      : "";

  return [
    "You are a warm, specific fortune advisor for a subscribed personal user.",
    `Reader: ${name}; birth date: ${birth}; birth time: ${time}`,
    notes ? `User notes: ${notes}` : "",
    `Topic: ${topicLabel}`,
    extraEn,
    "",
    "Requirements:",
    "1. Personalize from birth info when available — no generic fluff",
    "2. Give actionable advice for today/this week; use ## headings in Markdown",
    "3. You may use star ratings and ✅ do / ❌ avoid lists",
    "4. Entertainment and reflection only — not medical/legal/financial advice",
    "5. Output valid JSON only: { title, summary, reading, lucky: { color, number, direction, keyword } }",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildCustomerUserPrompt(input: {
  topic: FortuneTopic;
  question?: string | null;
  profile: FortuneProfile;
  locale: "en" | "zh";
  zodiac: string | null;
}) {
  const topicLabel = topicLabels[input.topic][input.locale];
  const lines = [
    input.locale === "zh" ? `主题：${topicLabel}` : `Topic: ${topicLabel}`,
    input.zodiac
      ? input.locale === "zh"
        ? `生肖：${input.zodiac}`
        : `Chinese zodiac: ${input.zodiac}`
      : "",
    input.question?.trim()
      ? input.locale === "zh"
        ? `用户问题：${input.question.trim()}`
        : `User question: ${input.question.trim()}`
      : "",
  ].filter(Boolean);
  return lines.join("\n");
}
