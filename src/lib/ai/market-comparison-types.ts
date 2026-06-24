export type ComparisonTier = {
  level: string;
  title?: string;
  value: string;
  note?: string;
};

export type ComparisonColumn = {
  name: string;
  color: string;
  tiers: ComparisonTier[];
};

export type ComparisonPlan = {
  title: string;
  subtitle?: string;
  columns: ComparisonColumn[];
};

/** Demo matching the user's sample infographic (tech job levels). */
export const SAMPLE_COMPARISON: ComparisonPlan = {
  title: "互联网大厂职级年薪对比",
  subtitle: "多平台职级阶梯 · 年薪区间（万元 · 税前）",
  columns: [
    {
      name: "阿里 P",
      color: "f59e0b",
      tiers: [
        { level: "P5", title: "工程师", value: "¥41-48万" },
        { level: "P6", title: "高级工程师", value: "¥48-64万" },
        { level: "P7", title: "专家/经理", value: "¥91-118万" },
        { level: "P8", title: "高级专家/资深经理", value: "¥170-240万" },
        { level: "P9", title: "资深专家/总监", value: "¥290-380万" },
        { level: "P10", title: "研究员/资深总监", value: "—" },
      ],
    },
    {
      name: "字节 L",
      color: "fbbf24",
      tiers: [
        { level: "L6", value: "¥40-53万" },
        { level: "L7", value: "¥54-71万" },
        { level: "L8", value: "¥74-136万" },
        { level: "L9", value: "¥264-334万" },
        { level: "L10", value: "¥480-496万" },
      ],
    },
    {
      name: "腾讯",
      color: "e11d48",
      tiers: [
        { level: "13", value: "¥23-24万" },
        { level: "14", value: "¥32-40万" },
        { level: "15", value: "¥40-47万" },
        { level: "16", value: "¥51-70万" },
        { level: "17", value: "¥73-97万" },
        { level: "18", value: "¥107-155万" },
      ],
    },
    {
      name: "美团",
      color: "fb7185",
      tiers: [
        { level: "员工", value: "¥64-113万" },
        { level: "小组长", value: "¥136-212万" },
        { level: "二级主管", value: "—" },
        { level: "一级主管", value: "—" },
      ],
    },
    {
      name: "字节档",
      color: "3b82f6",
      tiers: [
        { level: "1-2", title: "工程师", value: "¥37-47万" },
        { level: "2-1", title: "资深工程师", value: "¥53-71万" },
        { level: "2-2", title: "专家", value: "¥86-128万" },
        { level: "3-1", title: "高级专家", value: "¥144-205万" },
        { level: "3-2", title: "资深专家", value: "¥250-300万" },
        { level: "4-1", value: "¥387-590万" },
      ],
    },
  ],
};
