"use client";

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function subheadingClass(line: string) {
  if (/^P0\s·/.test(line)) return "text-accent";
  if (/^P[12]\s·/.test(line)) return "text-foreground/90";
  return "text-muted";
}

export function FortuneReadingBody({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  function flushList() {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="list-disc space-y-1 pl-5 text-sm">
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      blocks.push(
        <h3 key={`h-${blocks.length}`} className="pt-3 text-sm font-bold tracking-wide text-accent">
          {renderInline(trimmed.slice(3))}
        </h3>,
      );
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushList();
      const label = trimmed.slice(4);
      blocks.push(
        <h4
          key={`h4-${blocks.length}`}
          className={`pt-1 text-xs font-semibold uppercase tracking-wider ${subheadingClass(label)}`}
        >
          {renderInline(label)}
        </h4>,
      );
      continue;
    }
    if (trimmed.startsWith(">")) {
      flushList();
      blocks.push(
        <blockquote
          key={`q-${blocks.length}`}
          className="border-l-2 border-accent/50 bg-accent/[0.06] py-2 pl-3 pr-2 text-sm leading-relaxed text-foreground/90"
        >
          {renderInline(trimmed.replace(/^>\s*/, ""))}
        </blockquote>,
      );
      continue;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      listBuffer.push(trimmed.replace(/^[-•]\s*/, ""));
      continue;
    }
    if (/^[✅❌①②③④⑤]/.test(trimmed)) {
      flushList();
      blocks.push(
        <p key={`p-${blocks.length}`} className="text-sm leading-relaxed">
          {renderInline(trimmed)}
        </p>,
      );
      continue;
    }
    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-sm leading-relaxed text-foreground">
        {renderInline(trimmed)}
      </p>,
    );
  }
  flushList();

  return <div className="space-y-2">{blocks}</div>;
}
