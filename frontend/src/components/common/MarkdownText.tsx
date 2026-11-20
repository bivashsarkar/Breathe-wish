import { Fragment, type ReactNode } from "react";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={key} className="text-ink/60">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className="rounded bg-forest-50 px-1 py-0.5 text-[0.9em] text-forest-800">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

/**
 * A deliberately small Markdown renderer for assistant replies.
 * It never uses dangerouslySetInnerHTML, so model output cannot inject HTML.
 */
export default function MarkdownText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = [...listItems];
    listItems = [];
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-2 space-y-1.5 pl-0">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2.5">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-mint-500" aria-hidden="true" />
            <span>{renderInline(item, `li-${blocks.length}-${index}`)}</span>
          </li>
        ))}
      </ul>,
    );
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }
    if (/^[-•]\s+/.test(line)) {
      listItems.push(line.replace(/^[-•]\s+/, ""));
      return;
    }
    flushList();
    if (/^#{1,3}\s+/.test(line)) {
      blocks.push(
        <p key={`h-${index}`} className="mt-3 text-[13px] font-bold text-ink first:mt-0">
          {renderInline(line.replace(/^#{1,3}\s+/, ""), `h-${index}`)}
        </p>,
      );
      return;
    }
    blocks.push(
      <p key={`p-${index}`} className="my-1.5 leading-relaxed first:mt-0 last:mb-0">
        {renderInline(line, `p-${index}`)}
      </p>,
    );
  });
  flushList();

  return <div className="text-[13px] leading-relaxed text-ink/70">{blocks}</div>;
}
