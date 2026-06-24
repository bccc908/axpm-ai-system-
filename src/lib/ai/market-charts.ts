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

export type ChartKind = "bar" | "line" | "pie" | "doughnut" | "area";

export type ChartSeries = {
  name: string;
  values: number[];
};

export type MarketChartSpec = {
  title: string;
  type: ChartKind;
  labels: string[];
  series: ChartSeries[];
  insight: string;
  dataSource?: string;
};

export type ChartDeckPlan = {
  deckTitle: string;
  executiveSummary: string;
  charts: MarketChartSpec[];
};

const CHART_COLORS = ["f59e0b", "38bdf8", "a78bfa", "34d399", "fb7185", "94a3b8"];

function normalizeChartType(raw: string): ChartKind {
  const t = raw.toLowerCase();
  if (t === "line") return "line";
  if (t === "pie") return "pie";
  if (t === "doughnut" || t === "donut") return "doughnut";
  if (t === "area") return "area";
  return "bar";
}

function sanitizeChartSpec(raw: unknown, index: number): MarketChartSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const title = String(c.title ?? `图表 ${index + 1}`).trim();
  const labels = (Array.isArray(c.labels) ? c.labels : []).map(String).filter(Boolean).slice(0, 12);
  const seriesRaw = Array.isArray(c.series) ? c.series : [];
  const series: ChartSeries[] = seriesRaw
    .map((s) => {
      const row = s as Record<string, unknown>;
      const values = (Array.isArray(row.values) ? row.values : [])
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v));
      return { name: String(row.name ?? "Series").trim(), values };
    })
    .filter((s) => s.values.length > 0);

  if (!labels.length || !series.length) return null;

  const len = labels.length;
  const normalizedSeries = series.map((s) => ({
    name: s.name,
    values: s.values.slice(0, len).concat(Array(Math.max(0, len - s.values.length)).fill(0)),
  }));

  return {
    title,
    type: normalizeChartType(String(c.type ?? "bar")),
    labels,
    series: normalizedSeries.slice(0, 3),
    insight: String(c.insight ?? "").trim() || "见图表数据趋势。",
    dataSource: c.dataSource ? String(c.dataSource) : undefined,
  };
}

export async function generateChartDeckPlan(
  topic: string,
  context?: string,
): Promise<ChartDeckPlan> {
  const system = await buildMarketAdvisorSystemPrompt("data");
  const knowledge = await getMarketKnowledgeBrief("all");

  const user = [
    `Create a professional data chart deck plan about: ${topic.trim()}`,
    context?.trim() ? `\nConversation context:\n${context.trim().slice(0, 4000)}` : "",
    knowledge ? `\nUploaded data (use REAL numbers from here — do not invent):\n${knowledge.slice(0, 12000)}` : "",
    "",
    "Return JSON only:",
    `{`,
    `  "deckTitle": "string",`,
    `  "executiveSummary": "2-3 sentences",`,
    `  "charts": [`,
    `    {`,
    `      "title": "chart title",`,
    `      "type": "bar|line|pie|doughnut|area",`,
    `      "labels": ["Jan","Feb",...],`,
    `      "series": [{ "name": "ROI", "values": [1.2, 1.5] }],`,
    `      "insight": "one professional interpretation sentence",`,
    `      "dataSource": "file name or column reference"`,
    `    }`,
    `  ]`,
    `}`,
    "",
    "Requirements:",
    "- 5 to 7 charts, each a different angle (trend, comparison, share, funnel, ROI, growth, regional, etc.)",
    "- Use numbers from uploaded files when available; if sparse, use realistic illustrative ranges and say so in dataSource",
    "- labels.length must match every series.values.length",
    "- Chinese if topic is Chinese",
    "- Pick chart type that fits the data (pie/doughnut for share, line/area for trends, bar for comparison)",
  ].join("\n");

  const result = await deepSeekChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    json: true,
    temperature: 0.35,
    maxTokens: 2800,
  });

  if (result.ok) {
    try {
      const parsed = JSON.parse(result.content) as ChartDeckPlan & { charts?: unknown[] };
      const charts = (parsed.charts ?? [])
        .map((c, i) => sanitizeChartSpec(c, i))
        .filter((c): c is MarketChartSpec => Boolean(c));

      if (charts.length >= 3) {
        return {
          deckTitle: String(parsed.deckTitle ?? topic).trim() || topic,
          executiveSummary: String(parsed.executiveSummary ?? "").trim(),
          charts: charts.slice(0, 8),
        };
      }
    } catch {
      /* fallback below */
    }
  }

  const zh = /[\u4e00-\u9fff]/.test(topic);
  return {
    deckTitle: topic.trim() || (zh ? "数据分析图表" : "Data Chart Deck"),
    executiveSummary: zh
      ? "基于已上传资料的关键指标可视化（示例数据 — 请上传 CSV/Excel 获取精确数字）。"
      : "Key metrics visualization from uploaded materials (sample data — upload CSV/Excel for exact figures).",
    charts: [
      {
        title: zh ? "渠道转化对比" : "Channel conversion",
        type: "bar",
        labels: zh ? ["抖音", "微信", "线下", "转介绍"] : ["Douyin", "WeChat", "Offline", "Referral"],
        series: [{ name: zh ? "转化率%" : "CVR %", values: [3.2, 2.8, 4.1, 5.5] }],
        insight: zh ? "转介绍渠道转化率最高，建议加大激励。" : "Referral converts best — increase incentives.",
      },
      {
        title: zh ? "月度增长趋势" : "Monthly growth",
        type: "line",
        labels: ["M1", "M2", "M3", "M4", "M5", "M6"],
        series: [{ name: zh ? "新增客户" : "New clients", values: [12, 18, 15, 22, 28, 31] }],
        insight: zh ? "近三月增速加快。" : "Growth accelerated in the last 3 months.",
      },
      {
        title: zh ? "预算占比" : "Budget share",
        type: "doughnut",
        labels: [zh ? "内容" : "Content", zh ? "投放" : "Ads", zh ? "活动" : "Events", zh ? "其他" : "Other"],
        series: [{ name: zh ? "占比" : "Share", values: [35, 40, 15, 10] }],
        insight: zh ? "投放占比最高，需关注 ROI。" : "Ads take the largest share — watch ROI.",
      },
    ],
  };
}

function pptxChartType(pptx: PptxGenJS, kind: ChartKind) {
  const map: Record<ChartKind, PptxGenJS.CHART_NAME> = {
    bar: pptx.ChartType.bar,
    line: pptx.ChartType.line,
    pie: pptx.ChartType.pie,
    doughnut: pptx.ChartType.doughnut,
    area: pptx.ChartType.area,
  };
  return map[kind] ?? pptx.ChartType.bar;
}

function chartDetailTableRows(chart: MarketChartSpec): string[][] {
  const header = ["维度", ...chart.series.map((s) => s.name)];
  const rows = chart.labels.map((label, i) => [
    label,
    ...chart.series.map((s) => String(s.values[i] ?? 0)),
  ]);
  return [header, ...rows];
}

function toChartData(chart: MarketChartSpec) {
  return chart.series.map((s) => ({
    name: s.name,
    labels: chart.labels,
    values: s.values,
  }));
}

function addDetailTableSlide(pptx: PptxGenJS, plan: ChartDeckPlan) {
  const slide = pptx.addSlide();
  slide.background = { color: "0F172A" };
  slide.addText("数据明细总表", {
    x: 0.7,
    y: 0.35,
    w: 12,
    fontSize: 28,
    bold: true,
    color: "f59e0b",
  });

  let y = 1.0;
  for (const chart of plan.charts) {
    if (y > 4.8) break;
    slide.addText(chart.title, {
      x: 0.7,
      y,
      w: 12,
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: "FFFFFF",
    });
    y += 0.38;

    const tableData = chartDetailTableRows(chart).map((row, ri) =>
      row.map((cell) => ({
        text: cell,
        options: {
          bold: ri === 0,
          color: ri === 0 ? "f59e0b" : "E2E8F0",
          fontSize: ri === 0 ? 11 : 10,
          fill: { color: ri === 0 ? "1e293b" : "0f172a" },
        },
      })),
    );

    const rowCount = tableData.length;
    const tableH = Math.min(0.28 * rowCount, 1.2);
    slide.addTable(tableData, {
      x: 0.7,
      y,
      w: 12,
      colW: Array(tableData[0]?.length ?? 1).fill(12 / (tableData[0]?.length ?? 1)),
      border: { pt: 0.5, color: "334155" },
      rowH: 0.28,
      autoPage: false,
    });
    y += tableH + 0.25;
  }

  slide.addText("完整数据见 chart-data.csv", {
    x: 0.7,
    y: 5.1,
    w: 12,
    fontSize: 11,
    color: "64748B",
  });
}

export async function buildChartDataCsv(plan: ChartDeckPlan, outputPath: string) {
  const lines: string[] = [];

  lines.push("=== 明细总表 ===");
  for (const chart of plan.charts) {
    lines.push(`# ${chart.title}`);
    const header = ["维度", ...chart.series.map((s) => s.name)];
    lines.push(header.join(","));
    chart.labels.forEach((label, i) => {
      lines.push(
        [
          `"${label.replace(/"/g, '""')}"`,
          ...chart.series.map((s) => s.values[i] ?? 0),
        ].join(","),
      );
    });
    lines.push("");
  }

  lines.push("");
  lines.push("=== 长格式（Chart,Series,Label,Value,Insight,Source）===");
  lines.push("Chart,Series,Label,Value,Insight,Source");
  for (const chart of plan.charts) {
    for (const series of chart.series) {
      chart.labels.forEach((label, i) => {
        lines.push(
          [
            `"${chart.title.replace(/"/g, '""')}"`,
            `"${series.name.replace(/"/g, '""')}"`,
            `"${label.replace(/"/g, '""')}"`,
            series.values[i] ?? 0,
            `"${chart.insight.replace(/"/g, '""')}"`,
            `"${(chart.dataSource ?? "").replace(/"/g, '""')}"`,
          ].join(","),
        );
      });
    }
  }

  await fs.writeFile(outputPath, lines.join("\n"), "utf-8");
}

export async function buildChartPptxFile(plan: ChartDeckPlan, outputPath: string) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Kayden Market AI";
  pptx.title = plan.deckTitle;
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };

  const cover = pptx.addSlide();
  cover.background = { color: "0F172A" };
  cover.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.15,
    fill: { color: "f59e0b" },
  });
  cover.addText(plan.deckTitle, {
    x: 0.8,
    y: 2.2,
    w: 11.5,
    h: 1.5,
    fontSize: 40,
    bold: true,
    color: "FFFFFF",
  });
  cover.addText("Kayden Market AI · 数据图表自动生成", {
    x: 0.8,
    y: 3.8,
    w: 11,
    fontSize: 18,
    color: "94A3B8",
  });

  if (plan.executiveSummary) {
    const summarySlide = pptx.addSlide();
    summarySlide.background = { color: "0F172A" };
    summarySlide.addText("Executive Summary", {
      x: 0.7,
      y: 0.5,
      w: 12,
      fontSize: 28,
      bold: true,
      color: "f59e0b",
    });
    summarySlide.addText(plan.executiveSummary, {
      x: 0.8,
      y: 1.4,
      w: 11.5,
      h: 4.5,
      fontSize: 20,
      color: "E2E8F0",
      valign: "top",
    });
  }

  for (let i = 0; i < plan.charts.length; i++) {
    const chart = plan.charts[i];
    const slide = pptx.addSlide();
    slide.background = { color: "0F172A" };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.08,
      h: "100%",
      fill: { color: CHART_COLORS[i % CHART_COLORS.length] },
    });
    slide.addText(chart.title, {
      x: 0.6,
      y: 0.35,
      w: 12,
      h: 0.7,
      fontSize: 26,
      bold: true,
      color: "FFFFFF",
    });

    slide.addChart(pptxChartType(pptx, chart.type), toChartData(chart), {
      x: 0.6,
      y: 1.1,
      w: 7.2,
      h: 4.2,
      showLegend: chart.series.length > 1,
      legendPos: "b",
      chartColors: CHART_COLORS,
      valAxisLabelColor: "94A3B8",
      catAxisLabelColor: "94A3B8",
      valGridLine: { color: "334155", size: 0.5 },
    });

    const insightLines: PptxGenJS.TextProps[] = [
      { text: "解读", options: { bold: true, color: "f59e0b", fontSize: 14 } },
      { text: `\n${chart.insight}`, options: { color: "E2E8F0", fontSize: 16 } },
    ];
    if (chart.dataSource) {
      insightLines.push({
        text: `\n来源：${chart.dataSource}`,
        options: { color: "64748B", fontSize: 12 },
      });
    }

    slide.addText(insightLines, {
      x: 8.1,
      y: 1.2,
      w: 4.5,
      h: 4,
      valign: "top",
    });

    const miniTable = chartDetailTableRows(chart).map((row, ri) =>
      row.map((cell) => ({
        text: cell,
        options: {
          bold: ri === 0,
          color: ri === 0 ? "f59e0b" : "CBD5E1",
          fontSize: 9,
          fill: { color: ri === 0 ? "1e293b" : "0f172a" },
        },
      })),
    );
    slide.addTable(miniTable, {
      x: 0.6,
      y: 5.05,
      w: 12,
      colW: Array(miniTable[0]?.length ?? 1).fill(12 / (miniTable[0]?.length ?? 1)),
      border: { pt: 0.5, color: "334155" },
      rowH: 0.22,
    });
  }

  addDetailTableSlide(pptx, plan);

  const end = pptx.addSlide();
  end.background = { color: "0F172A" };
  end.addText("Next Steps", {
    x: 0.8,
    y: 1.5,
    w: 11,
    fontSize: 32,
    bold: true,
    color: "FFFFFF",
  });
  end.addText(
    [
      { text: "• 重点跟进高 ROI 渠道", options: { bullet: true, color: "E2E8F0", fontSize: 20 } },
      { text: "• 优化低转化环节", options: { bullet: true, color: "E2E8F0", fontSize: 20 } },
      { text: "• 下载 chart-data.csv 可在 Excel 二次编辑", options: { bullet: true, color: "94A3B8", fontSize: 16 } },
    ],
    { x: 0.9, y: 2.5, w: 11, h: 3 },
  );

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  await fs.writeFile(outputPath, buffer);
}

export async function generateMarketChartPpt(topic: string, context?: string) {
  const plan = await generateChartDeckPlan(topic, context);
  const entry = await registerMarketOutput({
    kind: "ppt",
    title: plan.deckTitle,
  });
  const dir = marketOutputDir(entry.id);
  const pptName = `chart-deck-${entry.id}.pptx`;
  const csvName = `chart-data-${entry.id}.csv`;

  await buildChartPptxFile(plan, path.join(dir, pptName));
  await buildChartDataCsv(plan, path.join(dir, csvName));
  await updateMarketOutputFiles(entry.id, [pptName, csvName]);

  return {
    output: { ...entry, files: [pptName, csvName] },
    plan,
    downloadUrl: marketOutputFileUrl(entry.id, pptName),
    csvUrl: marketOutputFileUrl(entry.id, csvName),
    chartCount: plan.charts.length,
    slideCount: plan.charts.length + (plan.executiveSummary ? 3 : 2) + 1,
    provider: "local-charts" as const,
  };
}
