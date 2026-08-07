/**
 * reportStyles.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Colour palette and pdfmake style dictionary for the PDF report. The in-app
 * canvas is dark-mode with neon amber/cyan accents; a printable customer
 * document reads better on a white page, so this is a print-safe cousin of
 * that palette (darker amber for contrast on paper, navy/charcoal instead of
 * pure black) rather than a literal replica.
 */
import type { StyleDictionary } from 'pdfmake/interfaces';

export const REPORT_COLOURS = {
  amber: '#e65100',
  amberLight: '#fff3e0',
  navy: '#1a1a2e',
  bodyText: '#333333',
  mutedText: '#666666',
  ruleLine: '#e0d5c7',
  tableHeaderBg: '#1a1a2e',
  tableHeaderText: '#ffffff',
  tableRowAlt: '#faf6f0',
  warningBg: '#fff3e0',
  warningBorder: '#e65100',
};

export const reportStyleDictionary: StyleDictionary = {
  coverTitle: { fontSize: 28, bold: true, color: REPORT_COLOURS.navy, margin: [0, 0, 0, 4] },
  coverSubtitle: { fontSize: 13, color: REPORT_COLOURS.mutedText, margin: [0, 0, 0, 2] },
  sectionHeading: {
    fontSize: 16,
    bold: true,
    color: REPORT_COLOURS.amber,
    margin: [0, 20, 0, 8],
  },
  subHeading: {
    fontSize: 12,
    bold: true,
    color: REPORT_COLOURS.navy,
    margin: [0, 10, 0, 4],
  },
  body: { fontSize: 10, color: REPORT_COLOURS.bodyText, lineHeight: 1.3 },
  muted: { fontSize: 9, color: REPORT_COLOURS.mutedText, italics: true },
  statLabel: { fontSize: 8, color: REPORT_COLOURS.mutedText, bold: true },
  statValue: { fontSize: 16, color: REPORT_COLOURS.amber, bold: true },
  tableHeader: {
    fontSize: 9,
    bold: true,
    color: REPORT_COLOURS.tableHeaderText,
    fillColor: REPORT_COLOURS.tableHeaderBg,
  },
  tableCell: { fontSize: 9, color: REPORT_COLOURS.bodyText },
  // Roboto only (the default pdfmake browser build only embeds Roboto in its vfs) —
  // "monospace-ish" is faked with letter-spacing rather than pulling in a second
  // embedded font family purely for SKU columns.
  mono: { fontSize: 8.5, characterSpacing: 0.3, color: REPORT_COLOURS.navy, bold: true },
  warningTitle: { fontSize: 11, bold: true, color: REPORT_COLOURS.amber },
};

export const REPORT_PAGE_MARGINS: [number, number, number, number] = [40, 40, 40, 60];
