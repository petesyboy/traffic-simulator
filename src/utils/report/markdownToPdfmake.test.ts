import { describe, it, expect } from 'vitest';
import { markdownToPdfmakeContent } from './markdownToPdfmake';

describe('markdownToPdfmakeContent', () => {
  it('renders plain text with no markdown as a single paragraph', () => {
    const content = markdownToPdfmakeContent('Just a plain sentence.');
    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({ style: 'body' });
  });

  it('splits bold and italic runs out of a paragraph', () => {
    const content = markdownToPdfmakeContent('This is **bold** and this is *italic* text.');
    const runs = (content[0] as { text: { text: string; bold?: boolean; italics?: boolean }[] }).text;
    expect(runs.some((r) => r.text === 'bold' && r.bold)).toBe(true);
    expect(runs.some((r) => r.text === 'italic' && r.italics)).toBe(true);
  });

  it('supports __bold__ and _italic_ underscore syntax too', () => {
    const content = markdownToPdfmakeContent('__strong__ and _emphasis_');
    const runs = (content[0] as { text: { text: string; bold?: boolean; italics?: boolean }[] }).text;
    expect(runs.some((r) => r.text === 'strong' && r.bold)).toBe(true);
    expect(runs.some((r) => r.text === 'emphasis' && r.italics)).toBe(true);
  });

  it('renders inline code with the mono style', () => {
    const content = markdownToPdfmakeContent('Run `npm install` first.');
    const runs = (content[0] as { text: { text: string; style?: string }[] }).text;
    expect(runs.some((r) => r.text === 'npm install' && r.style === 'mono')).toBe(true);
  });

  it('separates blank-line-delimited paragraphs into distinct blocks', () => {
    const content = markdownToPdfmakeContent('First paragraph.\n\nSecond paragraph.');
    expect(content).toHaveLength(2);
  });

  it('joins wrapped lines within one paragraph into a single block', () => {
    const content = markdownToPdfmakeContent('Line one\nstill line one.\n\nNew paragraph.');
    expect(content).toHaveLength(2);
  });

  it('converts a bullet list to a pdfmake ul block', () => {
    const content = markdownToPdfmakeContent('- First item\n- Second item\n* Third item (asterisk bullet)');
    expect(content).toHaveLength(1);
    expect((content[0] as { ul: unknown[] }).ul).toHaveLength(3);
  });

  it('converts a numbered list to a pdfmake ol block', () => {
    const content = markdownToPdfmakeContent('1. First\n2. Second\n3) Third (paren style)');
    expect(content).toHaveLength(1);
    expect((content[0] as { ol: unknown[] }).ol).toHaveLength(3);
  });

  it('renders headings as bold text distinct from body paragraphs', () => {
    const content = markdownToPdfmakeContent('# Heading\n\nBody text.');
    expect(content).toHaveLength(2);
    expect(content[0]).toMatchObject({ text: 'Heading', bold: true });
  });

  it('handles a mixed document: heading, paragraph, and list together', () => {
    const md = '# Key outcomes\n\nThis deployment covers:\n\n- Full east/west visibility\n- Reduced tool load\n\nFinal note.';
    const content = markdownToPdfmakeContent(md);
    expect(content).toHaveLength(4);
    expect(content[0]).toMatchObject({ text: 'Key outcomes', bold: true });
    expect(content[2]).toHaveProperty('ul');
  });

  it('falls back to a plain-text block for an empty string', () => {
    const content = markdownToPdfmakeContent('');
    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({ text: '' });
  });
});
