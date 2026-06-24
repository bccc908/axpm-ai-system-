import "server-only";

import fs from "fs/promises";
import path from "path";
import PptxGenJS from "pptxgenjs";
import { deepSeekChat } from "@/lib/ai/deepseek-client";
import { buildMarketAdvisorSystemPrompt } from "@/lib/ai/market-advisor";
import { getMarketKnowledgeBrief } from "@/lib/ai/market-knowledge";
import {
  marketOutputDir,
  marketOutputFileUrl,
  registerMarketOutput,
  updateMarketOutputFiles,
} from "@/lib/ai/market-outputs";

import type { ComparisonColumn, ComparisonPlan, ComparisonTier } from "@/lib/ai/market-comparison-types";
import { SAMPLE_COMPARISON } from "@/lib/ai/market-comparison-types";

export type { ComparisonColumn, ComparisonPlan, ComparisonTier };
export { SAMPLE_COMPARISON };

const COLUMN_COLORS = ["f59e0b", "fbbf24", "e11d48", "fb7185", "3b82f6", "34d399", "a78bfa"];

function sanitizeTier(raw: unknown, index: number): ComparisonTier | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const level = String(t.level ?? `T${index + 1}`).trim();
  const value = String(t.value ?? t.range ?? "—").trim();
  if (!level) return null;
  return {
    level,
    title: t.title ? String(t.title).trim() : undefined,
    value,
    note: t.note ? String(t.note).trim() : undefined,
  };
}

function sanitizeColumn(raw: unknown, index: number): ComparisonColumn | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const name = String(c.name ?? `列${index + 1}`).trim();
  const tiers = (Array.isArray(c.tiers) ? c.tiers : [])
    .map((t, i) => sanitizeTier(t, i))
    .filter((t): t is ComparisonTier => Boolean(t));
  if (!name || !tiers.length) return null;
  return {
    name,
    color: String(c.color ?? COLUMN_COLORS[index % COLUMN_COLORS.length]).replace("#", ""),
    tiers: tiers.slice(0, 10),
  };
}

export async function generateComparisonPlan(
  topic: string,
  context?: string,
): Promise<ComparisonPlan> {
  const system = await buildMarketAdvisorSystemPrompt("data");
  const knowledge = await getMarketKnowledgeBrief("all");

  const user = [
    `Create a multi-column comparison ladder (like tech salary infographic) about: ${topic.trim()}`,
    context?.trim() ? `\nContext:\n${context.trim().slice(0, 4000)}` : "",
    knowledge ? `\nUploaded data (use REAL numbers):\n${knowledge.slice(0, 12000)}` : "",
    "",
    "Return JSON only:",
    `{`,
    `  "title": "string",`,
    `  "subtitle": "optional",`,
    `  "columns": [`,
    `    {`,
    `      "name": "TMGM",`,
    `      "color": "f59e0b",`,
    `      "tiers": [`,
    `        { "level": "Tier A", "title": "净入金17k", "value": "$140", "note": "85手" }`,
    `      ]`,
    `    }`,
    `  ]`,
    `}`,
    "",
    "Requirements:",
    "- 3 to 6 columns (platforms / brokers / categories)",
    "- Each column: 4-8 tiers stacked low→high",
    "- level = tier code; title = optional label; value = main number/range; note = extra",
    "- Use uploaded file numbers; Chinese if topic is Chinese",
    "- Match sample style: column headers + stacked tier cards with values",
  ].join("\n");

  const result = await deepSeekChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    json: true,
    temperature: 0.35,
    maxTokens: 3200,
  });

  if (result.ok) {
    try {
      const parsed = JSON.parse(result.content) as ComparisonPlan & { columns?: unknown[] };
      const columns = (parsed.columns ?? [])
        .map((c, i) => sanitizeColumn(c, i))
        .filter((c): c is ComparisonColumn => Boolean(c));
      if (columns.length >= 2) {
        return {
          title: String(parsed.title ?? topic).trim() || topic,
          subtitle: parsed.subtitle ? String(parsed.subtitle).trim() : undefined,
          columns: columns.slice(0, 6),
        };
      }
    } catch {
      /* fallback */
    }
  }

  const zh = /[\u4e00-\u9fff]/.test(topic);
  return {
    title: topic.trim() || (zh ? "平台阶梯对比" : "Platform tier comparison"),
    subtitle: zh ? "请上传资料以获取精确数字" : "Upload files for exact figures",
    columns: [
      {
        name: "TMGM",
        color: "f59e0b",
        tiers: [
          { level: "档1", title: "入门", value: "$140", note: "17k/85手" },
          { level: "档2", title: "进阶", value: "$700", note: "170k/850手" },
          { level: "档3", title: "最高", value: "$7000", note: "500k/2200手" },
        ],
      },
      {
        name: "Moneta",
        color: "3b82f6",
        tiers: [
          { level: "NND", title: "奖励", value: "按净入金", note: "见上传文件" },
          { level: "Tier", title: "返佣", value: "—", note: "见上传文件" },
        ],
      },
      {
        name: "IC Markets",
        color: "34d399",
        tiers: [
          { level: "IB", title: "返佣/手", value: "联网查询", note: "Serper" },
        ],
      },
    ],
  };
}

export async function buildComparisonCsv(plan: ComparisonPlan, outputPath: string) {
  const lines = ["平台/列,职级/档位,说明,数值/范围,备注"];
  for (const col of plan.columns) {
    for (const tier of col.tiers) {
      lines.push(
        [
          `"${col.name.replace(/"/g, '""')}"`,
          `"${tier.level.replace(/"/g, '""')}"`,
          `"${(tier.title ?? "").replace(/"/g, '""')}"`,
          `"${tier.value.replace(/"/g, '""')}"`,
          `"${(tier.note ?? "").replace(/"/g, '""')}"`,
        ].join(","),
      );
    }
  }
  await fs.writeFile(outputPath, lines.join("\n"), "utf-8");
}

export async function buildComparisonPptx(plan: ComparisonPlan, outputPath: string) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "AXPM Market AI";
  pptx.company = "Kayden";
  pptx.title = plan.title;

  const slide = pptx.addSlide();
  slide.background = { color: "0B1220" };

  slide.addText("TIER COMPARISON", {
    x: 0.4,
    y: 0.18,
    w: 12.5,
    h: 0.25,
    fontSize: 9,
    bold: true,
    color: "F59E0B",
    align: "center",
    charSpacing: 3,
  });

  slide.addText(plan.title, {
    x: 0.4,
    y: 0.38,
    w: 12.5,
    h: 0.55,
    fontSize: 24,
    bold: true,
    color: "F8FAFC",
    align: "center",
  });

  if (plan.subtitle) {
    slide.addText(plan.subtitle, {
      x: 0.4,
      y: 0.88,
      w: 12.5,
      h: 0.32,
      fontSize: 11,
      color: "94A3B8",
      align: "center",
    });
  }

  slide.addShape(pptx.ShapeType.line, {
    x: 5.85,
    y: 1.22,
    w: 1.5,
    h: 0,
    line: { color: "F59E0B", width: 1.5 },
  });

  const colCount = plan.columns.length;
  const gap = 0.14;
  const totalW = 12.4;
  const colW = (totalW - gap * (colCount - 1)) / colCount;
  const startX = 0.55;
  const startY = 1.38;
  const maxTiers = Math.max(...plan.columns.map((c) => c.tiers.length));
  const boxH = Math.min(0.58, 4.55 / maxTiers);
  const boxGap = 0.07;
  const tierCount = plan.columns.reduce((n, c) => n + c.tiers.length, 0);

  plan.columns.forEach((col, ci) => {
    const x = startX + ci * (colW + gap);

    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y: startY,
      w: colW,
      h: 0.4,
      fill: { color: col.color },
      rectRadius: 0.08,
      line: { color: "FFFFFF", width: 0.5, transparency: 70 },
    });
    slide.addText(col.name, {
      x,
      y: startY + 0.02,
      w: colW,
      h: 0.36,
      fontSize: 10,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });

    const pad = maxTiers - col.tiers.length;
    const allTiers = [...col.tiers, ...Array(pad).fill(null)];

    allTiers.forEach((tier, ti) => {
      const y = startY + 0.46 + ti * (boxH + boxGap);

      if (!tier) {
        slide.addShape(pptx.ShapeType.roundRect, {
          x,
          y,
          w: colW,
          h: boxH,
          fill: { color: "1E293B", transparency: 40 },
          line: { color: "334155", width: 0.5 },
          rectRadius: 0.06,
        });
        return;
      }

      const fillColor = ti % 2 === 0 ? col.color : lightenHex(col.color, 0.12);

      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: colW,
        h: boxH,
        fill: { color: fillColor },
        rectRadius: 0.06,
        line: { color: "FFFFFF", width: 0.4, transparency: 75 },
      });

      const lines: PptxGenJS.TextProps[] = [
        {
          text: tier.level,
          options: { bold: true, fontSize: 9, color: "FFFFFF", charSpacing: 0.5 },
        },
      ];
      if (tier.title) {
        lines.push({
          text: `\n${tier.title}`,
          options: { fontSize: 7, color: "F1F5F9" },
        });
      }
      lines.push({
        text: `\n${tier.value}`,
        options: { bold: true, fontSize: 11, color: "FFFFFF" },
      });
      if (tier.note) {
        lines.push({
          text: `\n${tier.note}`,
          options: { fontSize: 6.5, color: "CBD5E1" },
        });
      }

      slide.addText(lines, {
        x: x + 0.06,
        y: y + 0.03,
        w: colW - 0.12,
        h: boxH - 0.06,
        valign: "middle",
        align: "center",
      });
    });
  });

  slide.addText(`${colCount} 平台 · ${tierCount} 档位`, {
    x: 0.55,
    y: 6.95,
    w: 4,
    h: 0.25,
    fontSize: 8,
    color: "64748B",
  });
  slide.addText("AXPM Market AI", {
    x: 10.2,
    y: 6.95,
    w: 2.8,
    h: 0.25,
    fontSize: 8,
    bold: true,
    color: "475569",
    align: "right",
  });

  const detail = pptx.addSlide();
  detail.background = { color: "0B1220" };
  detail.addText("DATA TABLE", {
    x: 0.7,
    y: 0.28,
    w: 12,
    fontSize: 9,
    bold: true,
    color: "F59E0B",
    charSpacing: 2,
  });
  detail.addText("数据明细表", {
    x: 0.7,
    y: 0.48,
    w: 12,
    fontSize: 22,
    bold: true,
    color: "F8FAFC",
  });
  detail.addText(plan.title, {
    x: 0.7,
    y: 0.88,
    w: 12,
    fontSize: 10,
    color: "64748B",
  });

  type TableCell = {
    text: string;
    options: { bold?: boolean; color: string; fontSize: number; fill?: { color: string } };
  };
  const tableRows: TableCell[][] = [
    ["平台", "档位", "说明", "数值", "备注"].map((h) => ({
      text: h,
      options: { bold: true, color: "f59e0b", fontSize: 11, fill: { color: "1e293b" } },
    })),
  ];
  for (const col of plan.columns) {
    for (const tier of col.tiers) {
      tableRows.push(
        [col.name, tier.level, tier.title ?? "", tier.value, tier.note ?? ""].map((cell) => ({
          text: cell,
          options: { color: "E2E8F0", fontSize: 10, fill: { color: "0f172a" } },
        })),
      );
    }
  }

  detail.addTable(tableRows, {
    x: 0.5,
    y: 1.15,
    w: 12.3,
    colW: [1.8, 1.2, 2.5, 2.2, 2.5],
    border: { pt: 0.5, color: "334155" },
    rowH: 0.3,
  });

  detail.addText("AXPM Market AI · 数据仅供参考", {
    x: 0.55,
    y: 6.95,
    w: 12,
    h: 0.25,
    fontSize: 8,
    color: "475569",
    align: "center",
  });

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  await fs.writeFile(outputPath, buffer);
}

function lightenHex(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = Math.min(255, parseInt(h.slice(0, 2), 16) + Math.round(255 * amount));
  const g = Math.min(255, parseInt(h.slice(2, 4), 16) + Math.round(255 * amount));
  const b = Math.min(255, parseInt(h.slice(4, 6), 16) + Math.round(255 * amount));
  return [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

export async function generateMarketComparison(
  topic: string,
  context?: string,
  planOverride?: ComparisonPlan,
) {
  const plan = planOverride ?? (await generateComparisonPlan(topic, context));
  const entry = await registerMarketOutput({
    kind: "ppt",
    title: plan.title,
  });
  const dir = marketOutputDir(entry.id);
  const pptName = `comparison-${entry.id}.pptx`;
  const csvName = `comparison-${entry.id}.csv`;

  await buildComparisonPptx(plan, path.join(dir, pptName));
  await buildComparisonCsv(plan, path.join(dir, csvName));
  await updateMarketOutputFiles(entry.id, [pptName, csvName]);

  return {
    plan,
    output: { ...entry, files: [pptName, csvName] },
    downloadUrl: marketOutputFileUrl(entry.id, pptName),
    csvUrl: marketOutputFileUrl(entry.id, csvName),
    columnCount: plan.columns.length,
    tierCount: plan.columns.reduce((n, c) => n + c.tiers.length, 0),
  };
}
