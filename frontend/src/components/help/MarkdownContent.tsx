import { Fragment } from "react";
import type { ReactNode } from "react";
import { slugify } from "@/lib/docs";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; text: string }
  | { type: "callout"; tone: string; title: string; text: string };

export default function MarkdownContent({ markdown }: { markdown: string }) {
  const blocks = parseMarkdown(markdown);

  return (
    <div className="space-y-5 text-sm leading-7 text-muted-foreground">
      {blocks.map((block, index) => (
        <Fragment key={index}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  );
}

function renderBlock(block: Block): ReactNode {
  if (block.type === "heading") {
    const id = slugify(block.text);
    if (block.level === 2) {
      return (
        <h2 id={id} className="scroll-mt-24 text-2xl font-semibold tracking-tight text-foreground">
          {block.text}
        </h2>
      );
    }

    return (
      <h3 id={id} className="scroll-mt-24 text-lg font-semibold text-foreground">
        {block.text}
      </h3>
    );
  }

  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";
    return (
      <ListTag className={`space-y-2 ${block.ordered ? "list-decimal" : "list-disc"} pl-5`}>
        {block.items.map((item) => (
          <li key={item}>{renderInline(item)}</li>
        ))}
      </ListTag>
    );
  }

  if (block.type === "code") {
    return (
      <pre className="overflow-x-auto rounded-2xl border border-border bg-muted p-4 text-xs text-foreground">
        <code>{block.text}</code>
      </pre>
    );
  }

  if (block.type === "callout") {
    const toneClass = calloutTone(block.tone);
    return (
      <div className={`rounded-2xl border p-4 ${toneClass}`}>
        <div className="text-xs font-semibold uppercase tracking-[0.2em]">{block.title}</div>
        <p className="mt-2">{renderInline(block.text)}</p>
      </div>
    );
  }

  return <p>{renderInline(block.text)}</p>;
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}

function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", text: codeLines.join("\n") });
      index += 1;
      continue;
    }

    const callout = line.match(/^>\s+\[!(\w+)\]\s*(.*)$/);
    if (callout) {
      const textLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        textLines.push(lines[index].replace(/^>\s?/, "").trim());
        index += 1;
      }
      blocks.push({
        type: "callout",
        tone: callout[1].toLowerCase(),
        title: callout[2] || callout[1].replace("_", " "),
        text: textLines.join(" "),
      });
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith("```") &&
      !lines[index].startsWith("#") &&
      !lines[index].trim().startsWith(">") &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function calloutTone(tone: string) {
  if (tone === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (tone === "important") return "border-indigo-500/30 bg-indigo-500/10 text-indigo-200";
  if (tone === "not_available") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (tone === "role") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}
