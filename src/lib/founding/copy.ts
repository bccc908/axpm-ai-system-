/**
 * Founding waitlist page copy, EN + 中文.
 * Source: /workspace/team-files/01-tasks/1126-crm-first-subscribers/Marketing-crm-waitlist-copy-v4.md
 * (v4, 26 Nov 2026 18:35 UTC+8; final: LangQA and Compliance passed).
 *
 * Every fact Marketing marked unknown, HOLD or pending is a `ph(...)` segment.
 * ph segments render as <span class="ph">[TBD: ...]</span>, which the placeholder
 * gate rejects, so the page cannot go live until each one is resolved here.
 * Seller details are `seller(...)` segments, filled only from env (never hard-coded).
 * Reviewer-only notes (status columns, 〔需语言质检〕 tags) are not reader copy.
 */
import type { SellerKey } from "./config";

export type Locale = "en" | "zh";
export type Seg = string | { ph: string } | { seller: SellerKey } | { link: string; href: string | { seller: SellerKey } };
export type Rich = Seg[];
export type L10n<T> = Record<Locale, T>;

const ph = (label: string): Seg => ({ ph: label });
const seller = (key: SellerKey): Seg => ({ seller: key });

export type Feature = { text: L10n<string>; planned?: boolean; footnote?: boolean };

export const FEATURES: Feature[] = [
  { text: { en: "Leads, contacts and deals in one pipeline, with stages your team records", zh: "潜在客户、联系人和商机集中在同一个销售流程中，阶段由团队自行记录" } },
  { text: { en: "Activities, follow-ups and reminders", zh: "活动记录、跟进事项和提醒" } },
  { text: { en: "One shared inbox for WhatsApp, Telegram and WeChat Work", zh: "WhatsApp、Telegram、企业微信，集中在一个共享收件箱" }, planned: true },
  { text: { en: "AI-drafted first replies, based on your own knowledge base", zh: "根据您自己的知识库，由 AI 起草首条回复" }, footnote: true },
  { text: { en: "CSV import and export", zh: "CSV 导入与导出" } },
  { text: { en: "Team roles", zh: "团队角色权限" } },
  { text: { en: "Reports and a daily summary", zh: "报表和每日汇总" } },
  { text: { en: "English and 中文 interface; add it to your phone's home screen", zh: "中英文界面；可添加到手机主屏幕使用" } },
  { text: { en: "Import IB reports from your broker's back office (CSV)", zh: "从经纪商后台导入 IB 报表（CSV）" }, planned: true },
  { text: { en: "Sub-IB team view", zh: "下级 IB 团队视图" }, planned: true },
];

export const COPY = {
  meta: {
    title: { en: "Founding customers · Kayden Chiew CRM", zh: "创始客户 · Kayden Chiew CRM" },
  },
  /** Builder text (not from Marketing): preview banner shown while the gate is closed. */
  previewBanner: {
    en: "Preview only. Sign-ups are not open yet, and nothing you enter on this page is saved or sent.",
    zh: "仅为预览。报名尚未开放，您在本页填写的任何内容都不会被保存或发送。",
  },
  hero: {
    eyebrow: { en: "Founding customers · waitlist", zh: "创始客户 · 候补名单" },
    h1: { en: "Kayden Chiew CRM for IB teams", zh: "Kayden Chiew CRM，为 IB 团队打造" },
    sub: {
      en: "Your team's leads, follow-ups and WhatsApp, Telegram and WeChat Work conversations in one place, in English and 中文.",
      zh: "团队的潜在客户、跟进事项，以及 WhatsApp、Telegram、企业微信对话，集中在一个地方，中英双语。",
    },
    badge: { en: "Waitlist only. No card, no payment and no trial yet.", zh: "目前仅开放候补名单。无需银行卡，不收费，暂不提供试用。" },
    primary: { en: "Join the founding waitlist", zh: "加入创始客户候补名单" },
    secondary: {
      en: ["Book a free onboarding call ", ph("design-partner terms pending CRMPM")],
      zh: ["预约免费上手指导通话 ", ph("设计伙伴条款待 CRMPM")],
    } as L10n<Rich>,
  },
  problem: {
    h2: { en: "When the conversations are scattered, so is the team", zh: "对话分散，团队也跟着分散" },
    body: {
      en: [
        "Prospects message on WhatsApp, Telegram and WeChat. Notes sit in spreadsheets and on personal phones. When a teammate is away, it's hard to see who is waiting for a reply or what was already said. ",
        ph("pains to confirm with Research ICP scan"),
      ],
      zh: [
        "潜在客户在 WhatsApp、Telegram、微信上留言，记录散落在表格和个人手机里。同事不在时，很难看清谁在等回复、之前聊过什么。",
        ph("痛点待 Research 调研确认"),
      ],
    } as L10n<Rich>,
  },
  features: {
    h2: { en: "What it does", zh: "功能" },
    plannedLabel: {
      en: ["Planned for launch. Details may change. ", ph("Kayden to confirm")],
      zh: ["计划于上线时提供，细节可能调整。", ph("Kayden 确认")],
    } as L10n<Rich>,
    footnote: {
      en: "AI drafts aren't included for teams based in, or owned or controlled from, mainland China, Hong Kong or Macau. The founding price is the same. We'll confirm whether AI drafts apply to your team before you sign anything.",
      zh: "总部位于中国大陆、香港或澳门，或由当地人士或机构控股或实际控制的团队，不包含 AI 起草功能，创始价不变。在您签署任何文件之前，我们会向您确认贵团队是否可使用 AI 起草功能。",
    },
    scope: {
      en: "It works alongside the broker back office you already use. It does not connect to trading platforms, hold client money, run KYC or calculate rebates.",
      zh: "它与您现有的经纪商后台配合使用，不连接交易平台，不经手客户资金，不做 KYC，也不计算返佣。",
    },
    rolesNote: { en: [ph("which team roles ship")], zh: [ph("上线时提供哪些角色")] } as L10n<Rich>,
  },
  who: {
    h2: { en: "Built for IB teams who work in chat apps", zh: "为在聊天软件上工作的 IB 团队打造" },
    forLabel: { en: "For", zh: "适合" },
    for: {
      en: "Introducing-broker (IB) teams that talk with prospects on WhatsApp, Telegram or WeChat, in English, 中文 or both, and want one shared view of leads and follow-ups.",
      zh: "通过 WhatsApp、Telegram 或微信，用中文、英文或双语与潜在客户沟通，并希望共享查看潜在客户和跟进事项的 IB（介绍经纪商）团队。",
    },
    marketsLabel: { en: "Markets", zh: "地区" },
    markets: {
      en: ["Malaysia and Singapore ", ph("other markets: Kayden to confirm"), ". Sign-ups from mainland China aren't open yet."],
      zh: ["马来西亚和新加坡", ph("其他地区：Kayden 确认"), "。中国大陆暂未开放报名。"],
    } as L10n<Rich>,
    notForLabel: { en: "Not for", zh: "不适合" },
    notFor: {
      en: "Anyone looking for trading signals, investment advice, leads or client introductions. Brokers who need a client portal, KYC, payments or a rebate engine.",
      zh: "寻找交易信号、投资建议、潜在客户名单或介绍客户服务的人；需要客户门户、KYC、支付或返佣系统的经纪商。",
    },
  },
  offer: {
    h2: { en: "Founding price for the first 10 IB teams", zh: "前 10 个 IB 团队专享创始价" },
    lines: {
      en: [
        ["40% off the IB Team plan (US$199/month) for your first 3 paid months: US$119.40/month."],
        ["From month 4: US$199/month."],
        ["It starts only when paid plans open. Joining the waitlist is free, and nothing is charged now."],
        ["One founding price per team workspace. It can't be combined with annual billing."],
        ["The founding price covers the base IB Team plan. Extra users or add-ons, if any at launch, are at list price. Users included: ", ph("users included"), ". Other limits: ", ph("other limits"), "."],
        ["How the 10 places are held: ", ph("CRMPM open decision 5")],
        ["Messaging fees charged by WhatsApp (Meta) are not included. Tax: ", ph("tax"), "."],
        ["Launch date: ", ph("launch date"), "."],
      ],
      zh: [
        ["IB Team 方案（每月 199 美元）前 3 个付费月享 6 折：每月 119.40 美元。"],
        ["第 4 个月起：每月 199 美元。"],
        ["仅在付费方案开放后生效。加入候补名单免费，现在不收取任何费用。"],
        ["每个团队工作区限享一次创始价，不可与年付方案同时使用。"],
        ["创始价适用于 IB Team 基础方案。上线时如有额外用户或附加功能，按标价收费。包含用户数：", ph("包含用户数"), "。其他限额：", ph("其他限额"), "。"],
        ["10 个名额如何分配：", ph("CRMPM 待决事项 5")],
        ["不含 WhatsApp（Meta）收取的消息费用。税费：", ph("税费"), "。"],
        ["上线日期：", ph("上线日期"), "。"],
      ],
    } as L10n<Rich[]>,
  },
  partners: {
    h3: { en: "Help shape it as a design partner", zh: "成为设计伙伴，一起打磨产品" },
    lines: {
      en: [
        ["You get: free onboarding and discovery call(s) in English or 中文; early notice of the launch date; a set-up session on launch day; the founding price when paid plans open."],
        ["We ask for: a few short feedback sessions before launch ", ph("number and length of sessions"), " and feedback during your first 3 paid months ", ph("CRMPM assumption"), "."],
        ["Demos before launch use sample data only. Please don't share client data with us."],
        ["A short design-partner form records your intent ", ph("form text pending lawyer, C-W6"), ". It is not a payment authorisation. No card is collected."],
        ["You can leave any time before launch, in writing, and you owe nothing."],
        ["Your input is advisory. No feature or date is promised."],
      ],
      zh: [
        ["您将获得：中文或英文的免费上手与需求沟通通话；提前获知上线日期；上线当天的设置指导；付费方案开放时享创始价。"],
        ["我们希望您：上线前参加几次简短的反馈会议", ph("次数与时长"), "，并在前 3 个付费月提供使用反馈", ph("CRMPM 假设"), "。"],
        ["上线前的演示只使用示例数据，请勿向我们提供任何客户数据。"],
        ["一份简短的设计伙伴表用于记录您的意向", ph("表格文字待律师起草，C-W6"), "。它不是付款授权，我们不收集银行卡信息。"],
        ["上线前您可随时书面退出，无需承担任何费用。"],
        ["您的意见将作为我们的参考，我们不承诺任何功能或日期。"],
      ],
    } as L10n<Rich[]>,
  },
  faq: {
    h2: { en: "FAQ", zh: "常见问题" },
    items: {
      en: [
        { q: "Do I pay anything now?", a: ["No. We don't collect a card or take a deposit, and there's no payment and no trial yet. You join a waitlist, and we contact you when paid plans open."] },
        { q: "Is my sign-up binding?", a: ["No. The waitlist and the design-partner form record intent only. Neither is a payment authorisation, and you can leave any time before launch."] },
        { q: "When does it launch?", a: [ph("launch date"), ". We'll email waitlist members first."] },
        { q: "Does it come with leads or client introductions?", a: ["No. It's CRM software only. It doesn't provide leads, client introductions, trading signals or investment advice."] },
        { q: "Which brokers does it work with?", a: ["It works alongside whatever broker back office you already use. Importing IB reports from common CSV formats is planned. We don't name or partner with any broker."] },
        { q: "Where is my data stored, and who can see it?", a: [ph("HOLD: Compliance wording after Gate 14 evidence")] },
        { q: "Does Kayden work with brokers?", a: ["Kayden Chiew works in the brokerage industry as a paid service provider to several brokers, including marketing work and client referrals. That is separate from Kayden's CRM. Details: ", { link: "kaydenchiew.com/en/about", href: "https://www.kaydenchiew.com/en/about" }] },
        { q: "Which languages?", a: ["English and 中文."] },
        { q: "Is it available in mainland China?", a: ["Not yet. Sign-ups from mainland China aren't open yet. If you choose mainland China as your location on the form, we don't save your details."] },
        { q: "Who is the seller?", a: [seller("SELLER_LEGAL_NAME"), " (", seller("SELLER_REG_NO"), "), ", seller("SELLER_ADDRESS"), ". Contact: ", seller("SUPPORT_EMAIL"), "."] },
        { q: "How long do you keep my details?", a: ["If you don't become a paying customer, we delete your details 12 months after you sign up or 3 months after launch, whichever comes first. You can ask us to delete them sooner at ", seller("SUPPORT_EMAIL"), "."] },
      ],
      zh: [
        { q: "现在需要付费吗？", a: ["不需要。我们不收集银行卡信息，也不收取订金；现在不收费，暂不提供试用。您加入候补名单后，付费方案开放时我们会联系您。"] },
        { q: "报名有约束力吗？", a: ["没有。候补名单和设计伙伴表只记录意向，都不是付款授权，上线前您可随时退出。"] },
        { q: "什么时候上线？", a: [ph("上线日期"), "。我们会先发邮件通知候补名单成员。"] },
        { q: "会提供潜在客户名单或介绍客户吗？", a: ["不会。这只是 CRM 软件，不提供潜在客户名单、介绍客户、交易信号或投资建议。"] },
        { q: "支持哪些经纪商？", a: ["它可与您现有的任何经纪商后台配合使用。从常见 CSV 格式导入 IB 报表的功能正在规划中。我们不点名、也不与任何经纪商合作推广。"] },
        { q: "数据存放在哪里？谁能看到？", a: [ph("暂缓：Gate 14 证据通过后由合规提供措辞")] },
        { q: "Kayden 与经纪商有合作吗？", a: ["Kayden Chiew 在经纪商行业工作，为多家经纪商提供有偿服务，包括市场推广和介绍客户。这与 Kayden 的 CRM 是分开的。详情：", { link: "kaydenchiew.com/zh/about", href: "https://www.kaydenchiew.com/zh/about" }] },
        { q: "支持哪些语言？", a: ["英文和中文。"] },
        { q: "中国大陆可以使用吗？", a: ["暂不可以。中国大陆暂未开放报名；如果您在表单中选择中国大陆为所在地区，我们不会保存您的信息。"] },
        { q: "销售方是谁？", a: [seller("SELLER_LEGAL_NAME"), "（", seller("SELLER_REG_NO"), "），", seller("SELLER_ADDRESS"), "。联系方式：", seller("SUPPORT_EMAIL"), "。"] },
        { q: "我的信息会保留多久？", a: ["如果您没有成为付费客户，我们会在您报名满 12 个月或正式上线满 3 个月时删除您的信息，以较早者为准。您也可以随时发邮件至 ", seller("SUPPORT_EMAIL"), " 要求提前删除。"] },
      ],
    } as L10n<{ q: string; a: Rich }[]>,
  },
  form: {
    h2: { en: "Join the founding waitlist", zh: "加入创始客户候补名单" },
    name: { en: "Name*", zh: "姓名*" },
    email: { en: "Work email*", zh: "工作邮箱*" },
    role: { en: "You are…*", zh: "您的身份*" },
    roleOptions: {
      en: [["ib", "An IB"], ["broker", "A broker"], ["other", "Another business"]],
      zh: [["ib", "IB"], ["broker", "经纪商"], ["other", "其他企业"]],
    } as L10n<[string, string][]>,
    teamSize: { en: "Team size*", zh: "团队人数*" },
    workCountry: { en: "Country or territory where you work*", zh: "您工作所在的国家或地区*" },
    hqCountry: { en: "Where is your business headquartered?*", zh: "您的业务总部位于哪个国家或地区？*" },
    hqIndividual: { en: "Individual, no separate business", zh: "个人经营，未另设企业" },
    ownerCountry: {
      en: "Where is your business's majority owner or controller based? (optional)",
      zh: "您业务的控股股东或实际控制人位于哪个国家或地区？（选填）",
    },
    ownerSame: { en: "Same as HQ", zh: "与总部相同" },
    ownerCall: { en: "I'll confirm on the call", zh: "通话时确认" },
    whatsapp: { en: "WhatsApp number (optional)", zh: "WhatsApp 号码（选填）" },
    telegram: { en: "Telegram username (optional)", zh: "Telegram 用户名（选填）" },
    teamName: { en: "Your team or business name (optional)", zh: "您的团队或业务名称（选填）" },
    teamNameHelp: { en: "Used only to avoid contacting you twice.", zh: "仅用于避免重复联系您。" },
    language: { en: "Preferred language*", zh: "偏好语言*" },
    intentLabel: { en: "Founding intent*", zh: "创始订阅意向*" },
    intent: {
      en: "When paid plans open, I intend to start the IB Team plan at the founding price: US$119.40/month for the first 3 paid months, then US$199/month. I understand this is not an order or a payment authorisation, and nothing is charged now.",
      zh: "付费方案开放时，我有意以创始价开通 IB Team 方案：前 3 个付费月每月 119.40 美元，之后每月 199 美元。我了解这不是订单，也不是付款授权，现在不会收取任何费用。",
    },
    consentLabel: { en: "Consent*", zh: "同意*" },
    consent: {
      en: ["I agree that ", seller("SELLER_LEGAL_NAME"), " may use these details to contact me about the Kayden Chiew CRM waitlist and founding offer, as described in the ", { link: "privacy notice", href: { seller: "PRIVACY_URL" } }, ". If I don't become a paying customer, my details are deleted 12 months after I sign up or 3 months after launch, whichever comes first. I can ask for them to be deleted sooner at ", seller("SUPPORT_EMAIL"), "."],
      zh: ["我同意 ", seller("SELLER_LEGAL_NAME"), " 使用以上信息，就 Kayden Chiew CRM 候补名单和创始优惠与我联系，详见", { link: "隐私声明", href: { seller: "PRIVACY_URL" } }, "。如果我没有成为付费客户，我的信息会在报名满 12 个月或正式上线满 3 个月时删除，以较早者为准。我也可随时发邮件至 ", seller("SUPPORT_EMAIL"), " 要求提前删除。"],
    } as L10n<Rich>,
    updatesLabel: { en: "Updates (optional)", zh: "订阅动态（选填）" },
    updates: {
      en: "Send me occasional product updates about Kayden Chiew CRM. I can unsubscribe at any time.",
      zh: "不定期向我发送 Kayden Chiew CRM 的产品动态。我可随时取消订阅。",
    },
    ownerNote: {
      en: "For the question about your business's owner or controller, we ask only for a country, never a name or other details.",
      zh: "关于您业务的控股股东或实际控制人，我们只询问所在国家或地区，不收集姓名或其他信息。",
    },
    noCard: { en: "We don't collect a card or take a deposit.", zh: "我们不收集银行卡信息，也不收取订金。" },
    scope: {
      en: "Kayden Chiew CRM is software only. It doesn't open trading accounts, pay rebates, introduce clients, or provide investment advice or trading signals.",
      zh: "Kayden Chiew CRM 只是软件，不开设交易账户、不支付返佣、不介绍客户，也不提供投资建议或交易信号。",
    },
    mainland: {
      en: "Sign-ups from your region aren't open yet. We haven't saved your details.",
      zh: "您所在地区暂未开放报名，我们没有保存您的信息。",
    },
    submit: { en: "Join the founding waitlist", zh: "加入创始客户候补名单" },
    /** Builder text: shown instead of submitting while the gate is closed. */
    submitClosed: { en: "Not open yet", zh: "暂未开放" },
    notOpen: {
      en: "Sign-ups are not open yet. Nothing was sent or saved.",
      zh: "报名尚未开放，没有发送或保存任何内容。",
    },
    select: { en: "Select…", zh: "请选择…" },
  },
  cta: {
    h2: { en: "Be one of the first 10 IB teams", zh: "成为首批 10 个 IB 团队之一" },
    body: {
      en: "Join the waitlist now. No card and no payment. We'll contact you before paid plans open.",
      zh: "立即加入候补名单，无需银行卡，不收费。付费方案开放前我们会联系您。",
    },
    button: { en: "Join the founding waitlist", zh: "加入创始客户候补名单" },
  },
  footer: {
    en: ["Sold by ", seller("SELLER_LEGAL_NAME"), " (", seller("SELLER_REG_NO"), ") · ", seller("SELLER_ADDRESS"), " · ", seller("SUPPORT_EMAIL"), " · ", { link: "Privacy notice", href: { seller: "PRIVACY_URL" } }, " · ", { link: "Terms", href: { seller: "TERMS_URL" } }],
    zh: ["销售方 ", seller("SELLER_LEGAL_NAME"), "（", seller("SELLER_REG_NO"), "）· ", seller("SELLER_ADDRESS"), " · ", seller("SUPPORT_EMAIL"), " · ", { link: "隐私声明", href: { seller: "PRIVACY_URL" } }, " · ", { link: "条款", href: { seller: "TERMS_URL" } }],
  } as L10n<Rich>,
};

/** Countries for W5–W7. Builder list (Marketing gave no list): flagged as a copy gap. */
export const COUNTRIES: { code: string; en: string; zh: string }[] = [
  { code: "MY", en: "Malaysia", zh: "马来西亚" },
  { code: "SG", en: "Singapore", zh: "新加坡" },
  { code: "CN", en: "Mainland China", zh: "中国大陆" },
  { code: "HK", en: "Hong Kong", zh: "中国香港" },
  { code: "MO", en: "Macau", zh: "中国澳门" },
  { code: "TW", en: "Taiwan", zh: "中国台湾" },
  { code: "ID", en: "Indonesia", zh: "印度尼西亚" },
  { code: "TH", en: "Thailand", zh: "泰国" },
  { code: "VN", en: "Vietnam", zh: "越南" },
  { code: "PH", en: "Philippines", zh: "菲律宾" },
  { code: "OTHER", en: "Other", zh: "其他" },
];

export const TEAM_SIZES = ["1", "2-5", "6-15", "16+"] as const;

/** Every unresolved copy placeholder (both locales). Must be empty before go-live. */
export function unresolvedCopyItems(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(walk);
    const o = v as Record<string, unknown>;
    if (typeof o.ph === "string" && Object.keys(o).length === 1) {
      out.push(o.ph);
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(COPY);
  walk(FEATURES);
  return out;
}
