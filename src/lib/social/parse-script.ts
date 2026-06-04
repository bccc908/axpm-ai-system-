/** Split 口播稿 into slide-sized chunks for visuals */
export function parseScriptToSlides(params: {
  title: string;
  script: string;
  maxSlides?: number;
}) {
  const { title, maxSlides = 5 } = params;
  const raw = params.script
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*投资有风险[^)]*\)/g, "")
    .trim();

  const lines = raw
    .split(/\n+/)
    .map((l) => l.replace(/^[·•\-\d️⃣1-9️⃣]+[\s.、)）]*/u, "").trim())
    .filter((l) => l.length > 2);

  const hook = lines[0] ?? title;
  const body = lines.slice(1).filter((l) => !/^(以上|评论|收藏|投资有风险)/.test(l));

  const points: string[] = [];
  for (const line of body) {
    if (points.length >= maxSlides - 2) break;
    if (line.length > 80) {
      points.push(line.slice(0, 78) + "…");
    } else {
      points.push(line);
    }
  }

  while (points.length < 3 && body[points.length]) {
    points.push(body[points.length]);
  }
  if (points.length === 0) {
    points.push("先搞清目标，再谈操作", "信息要核实，别只看一面之词", "小步试错，别一把梭");
  }

  const slides = [
    { kind: "cover" as const, headline: title, subline: hook.slice(0, 42) },
    ...points.slice(0, 3).map((text, i) => ({
      kind: "point" as const,
      index: i + 1,
      text,
    })),
    {
      kind: "outro" as const,
      headline: "觉得有用？",
      subline: "收藏备用 · 评论区交流 · 仅供参考",
    },
  ];

  return slides;
}
