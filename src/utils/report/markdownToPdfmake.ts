/**
 * markdownToPdfmake.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts a small, deliberately limited Markdown subset - the kind an SE
 * would actually type into a plain-text box (bold, italic, bullet/numbered
 * lists, `#`/`##`/`###` headings, blank-line-separated paragraphs) - into
 * pdfmake Content nodes for the report's executive summary. Not a CommonMark
 * implementation: no nested lists, links, tables, or code blocks. Pulling in
 * a full Markdown library for one free-text field isn't worth the bundle
 * weight given this app already ships as a single ~5.7MB HTML file.
 */
import type { Content } from 'pdfmake/interfaces';
import { REPORT_COLOURS } from './reportStyles';

interface InlineRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
  style?: string;
}

const INLINE_PATTERN = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+)`/g;

/** Splits one line into styled runs for bold, italic, and inline-code spans. */
function parseInline(line: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(line))) {
    if (match.index > lastIndex) runs.push({ text: line.slice(lastIndex, match.index) });
    if (match[1]) runs.push({ text: match[2], bold: true });
    else if (match[3]) runs.push({ text: match[4], italics: true });
    else if (match[5] !== undefined) runs.push({ text: match[5], style: 'mono' });
    lastIndex = INLINE_PATTERN.lastIndex;
  }
  if (lastIndex < line.length) runs.push({ text: line.slice(lastIndex) });
  return runs.length > 0 ? runs : [{ text: line }];
}

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const UL_RE = /^[-*+]\s+(.*)$/;
const OL_RE = /^\d+[.)]\s+(.*)$/;

/** Converts a Markdown string to pdfmake report content, styled with the report's own palette. */
export function markdownToPdfmakeContent(markdown: string): Content[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const content: Content[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const joined = paragraphLines.join(' ').trim();
    paragraphLines = [];
    if (!joined) return;
    content.push({ text: parseInline(joined), style: 'body', margin: [0, 0, 0, 8] });
  };

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === '') {
      flushParagraph();
      i++;
      continue;
    }

    const heading = trimmed.match(HEADING_RE);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      content.push({
        text: heading[2],
        bold: true,
        fontSize: level === 1 ? 13 : level === 2 ? 11.5 : 10.5,
        color: REPORT_COLOURS.navy,
        margin: [0, level === 1 ? 8 : 6, 0, 4],
      });
      i++;
      continue;
    }

    const isOl = OL_RE.test(trimmed);
    const isUl = UL_RE.test(trimmed);
    if (isOl || isUl) {
      flushParagraph();
      const items: Content[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        const m = isOl ? t.match(OL_RE) : t.match(UL_RE);
        if (!m) break;
        items.push({ text: parseInline(m[1]) });
        i++;
      }
      content.push(isOl ? { ol: items, style: 'body', margin: [0, 0, 0, 8] } : { ul: items, style: 'body', margin: [0, 0, 0, 8] });
      continue;
    }

    paragraphLines.push(trimmed);
    i++;
  }
  flushParagraph();

  return content.length > 0 ? content : [{ text: markdown, style: 'body' }];
}
