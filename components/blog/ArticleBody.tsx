import type { ReactNode } from "react";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let index = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) nodes.push(<strong key={`${keyPrefix}-${index++}`}>{match[1]}</strong>);
    else if (match[2] !== undefined) nodes.push(<em key={`${keyPrefix}-${index++}`}>{match[2]}</em>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/**
 * Renders the constrained Markdown subset our AI content pipeline is instructed to produce
 * (## / ### headings, paragraphs, "- " lists, **bold** / *italic*) as plain React elements —
 * no dangerouslySetInnerHTML, so AI-generated text can never inject raw HTML/scripts.
 */
export default function ArticleBody({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
  let blockKey = 0;

  const flushParagraph = () => {
    const text = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    if (!text) return;
    const key = `p-${blockKey++}`;
    blocks.push(
      <p key={key} className="mb-5 leading-relaxed text-black/80">
        {renderInline(text, key)}
      </p>,
    );
  };

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const key = `ul-${blockKey++}`;
    blocks.push(
      <ul key={key} className="mb-5 list-disc pl-6 space-y-1 text-black/80">
        {listBuffer.map((item, itemIndex) => (
          <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const h2 = /^##\s+(.*)/.exec(line);
    const h3 = /^###\s+(.*)/.exec(line);
    const item = /^[-*]\s+(.*)/.exec(line);
    if (h2) {
      flushParagraph();
      flushList();
      const key = `h2-${blockKey++}`;
      blocks.push(
        <h2 key={key} className="text-2xl sm:text-3xl font-black text-black mt-10 mb-4 first:mt-0">
          {renderInline(h2[1]!, key)}
        </h2>,
      );
    } else if (h3) {
      flushParagraph();
      flushList();
      const key = `h3-${blockKey++}`;
      blocks.push(
        <h3 key={key} className="text-xl font-black text-black mt-8 mb-3">
          {renderInline(h3[1]!, key)}
        </h3>,
      );
    } else if (item) {
      flushParagraph();
      listBuffer.push(item[1]!);
    } else {
      flushList();
      paragraphBuffer.push(line);
    }
  }
  flushParagraph();
  flushList();

  return <div className="text-lg">{blocks}</div>;
}
