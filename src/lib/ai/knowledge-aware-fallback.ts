type CustomerReplyInput = {
  clientName: string;
  customerQuestion: string;
  customBrief?: string;
};

type CustomerReplyResult = {
  replies: string[];
  detectedLanguage: string;
};

function guessLanguage(text: string) {
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  return "en";
}

function briefTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fff\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function scoreParagraph(paragraph: string, questionTokens: string[]) {
  const p = paragraph.toLowerCase();
  let score = 0;
  for (const t of questionTokens) {
    if (p.includes(t)) score += 2;
  }
  return score;
}

function pickSnippets(brief: string, question: string, max = 4): string[] {
  const qTokens = briefTokens(question);
  const paragraphs = brief
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20 && !p.startsWith("--- Knowledge file"));

  const ranked = paragraphs
    .map((p) => ({ p, score: scoreParagraph(p, qTokens) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked.filter((r) => r.score > 0).slice(0, max).map((r) => r.p);
  if (top.length) return top;

  return paragraphs.slice(0, max);
}

function detectBrand(brief: string) {
  const m = brief.match(/([\u4e00-\u9fffA-Za-z0-9]+)\s*·/);
  if (m) return m[1];
  const m2 = brief.match(/^([^\n]{2,20})/);
  return m2?.[1]?.trim();
}

/** Offline replies grounded in uploaded training text + analysis bullets */
export function getKnowledgeAwareFallbackReply(
  params: CustomerReplyInput,
): CustomerReplyResult | null {
  const brief = params.customBrief?.trim();
  if (!brief || brief.length < 80) return null;

  const zh = guessLanguage(params.customerQuestion) === "zh";
  const q = params.customerQuestion.toLowerCase();
  const name = params.clientName;
  const brand = detectBrand(brief) ?? (zh ? "我们" : "our team");
  const snippets = pickSnippets(brief, params.customerQuestion);

  const positioning =
    snippets.find((s) => /定位|活命|交易者/.test(s)) ??
    snippets[0] ??
    "";
  const compliance =
    snippets.find((s) => /合规|红线|不喊单|不承诺|违法/.test(s)) ?? "";
  const funnel =
    snippets.find((s) => /诊断|漏斗|匹配|开户|导流/.test(s)) ?? "";

  if (zh) {
    if (/平台|是什么|干嘛|做什么|谁|介绍/.test(q)) {
      const core = positioning.slice(0, 200) || "我们是帮交易者「活得久一点」的社区，不是戒赌互助会。";
      return {
        detectedLanguage: "zh",
        replies: [
          `${name} 您好，我是${brand}客服。${core} 您更想先了解「免费爆仓模式诊断」，还是「合规平台怎么匹配」？回复 1 或 2 即可。`,
          `${name} 您好，简单说：我们先帮你看清为什么总在同一个位置爆，再在你愿意改变时匹配合规期货/券商平台——不硬推开户。您目前是境内还是境外用户？`,
          `小提示：我们不做喊单、不承诺收益。若您刚经历大亏，建议先做诊断而非马上开户——您方便说下最近最困扰的一点吗？`,
        ],
      };
    }

    if (/安全|正规|靠谱|诈骗|合法/.test(q)) {
      const rule = compliance.slice(0, 180) || "境内主轴是期货居间与持牌券商；不对大陆用户导流币圈/离岸外汇。";
      return {
        detectedLanguage: "zh",
        replies: [
          `${name} 您好，理解您对安全的关注。${rule} 所有说明均含风险提示，非投资建议。您主要在境内还是境外？我按您的地区说明合规路径。`,
          `${name} 您好，我们不会承诺收益或喊单。情绪极端时也不会推开户。您愿意我先发「合规说明摘要」吗？`,
          `补充：我们是「负责任导流」——匹配平台是为了让您活得久、少爆仓。您最关心的是资质还是流程？`,
        ],
      };
    }

    if (/开户|注册|加入|怎么开始|入门/.test(q)) {
      const step = funnel.slice(0, 180) || "建议路径：共鸣 → 免费爆仓诊断 → 课程/打卡 → 再匹配合规平台。";
      return {
        detectedLanguage: "zh",
        replies: [
          `${name} 您好，欢迎。${step} 建议先从免费诊断开始，不急着开户。您方便回复「已交易」或「新手」吗？`,
          `${name} 您好，若您刚亏过，我们先做情绪与模式梳理，再谈平台匹配——您今天方便填 3 分钟诊断问卷吗？`,
          `我们不搞「快来开户」式推销。您更关心诊断报告还是平台列表？回复即可我按项发送。`,
        ],
      };
    }

    if (/费|价格|会员|多少钱/.test(q)) {
      return {
        detectedLanguage: "zh",
        replies: [
          `${name} 您好，复盘/回测等工具会员约 9.9–29 元/月；核心入口「爆仓模式分析」可先免费体验。您想先看会员包含什么，还是直接预约诊断？`,
          `${name} 您好，平台匹配本身不按「首充一次性」赚快钱，我们更看重您长期能稳定交易。您目前交易品种是期货、股票还是其他？`,
          `若预算有限，建议先用免费诊断与社区内容。您回复「免费」或「会员」我发对应说明。`,
        ],
      };
    }

    const ref = snippets[0]?.slice(0, 160) ?? "";
    return {
      detectedLanguage: "zh",
      replies: [
        `${name} 您好，关于您的问题：${ref}… 我会按${brand}资料为您核实。您希望我先讲「诊断」还是「平台匹配」？`,
        `${name} 您好，已记录。为准确回复，请告知您主要在境内还是境外交易，以及最近是否刚经历较大亏损？`,
        `我们坚持不承诺收益、情绪极端不导流。您方便用一句话描述当前最急的需求吗？`,
      ],
    };
  }

  const ref = snippets[0]?.slice(0, 200) ?? brief.slice(0, 200);
  return {
    detectedLanguage: "en",
    replies: [
      `Hi ${name}, thanks for your message. Based on our training materials (${brand}): ${ref}… Would you like the free risk-pattern diagnosis first, or platform matching steps?`,
      `Hi ${name}, we focus on helping traders last longer — not quick signup pushes. Are you based in mainland China or overseas? I'll tailor the compliant path.`,
      `We don't give trade signals or guaranteed returns. What's your main concern today — safety, onboarding, or fees?`,
    ],
  };
}
