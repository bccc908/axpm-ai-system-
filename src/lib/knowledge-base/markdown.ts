export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

const HEADING = /^(#{1,3})\s+(.+?)\s*$/;
const UNORDERED = /^[-*]\s+(.+?)\s*$/;
const ORDERED = /^\d+\.\s+(.+?)\s*$/;

/** Small markdown subset for staff documents. HTML is left as text. */
export function parseKnowledgeMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1]!.length as 1 | 2 | 3,
        text: heading[2]!,
      });
      index += 1;
      continue;
    }

    if (UNORDERED.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index] ?? "";
        const match = (ordered ? ORDERED : UNORDERED).exec(current);
        if (!match) break;
        items.push(match[1]!);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (!current.trim() || HEADING.test(current) || UNORDERED.test(current) || ORDERED.test(current)) {
        break;
      }
      paragraph.push(current.trim());
      index += 1;
    }
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    }
  }

  return blocks;
}

export function plainKnowledgeText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`#>*_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
