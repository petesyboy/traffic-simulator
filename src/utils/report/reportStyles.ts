/**
 * reportStyles.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * "Signal Path" design tokens and pdfmake style dictionary for customer reports.
 * Employs paper (#FBF7F1) and ink (#1B1D27), structural navy (#16213D),
 * Gigamon brand accent orange (#E1592A), and dedicated status colorways.
 */
import type { StyleDictionary } from 'pdfmake/interfaces';

export const REPORT_COLOURS = {
  // Surface / Paper
  paper: '#FBF7F1',
  paperRaised: '#FFFFFF',
  paperCard: '#FFFFFF',

  // Ink
  ink: '#1B1D27',
  inkSecondary: '#545765',
  inkMuted: '#8B8D99',
  
  // Lines & Hairlines
  line: '#E8E1D4',
  lineStrong: '#D8CFBC',

  // Accent & Brand (Gigamon Orange)
  accent: '#E1592A',
  accentInk: '#FFFFFF',

  // Structural (Dark Navy)
  structural: '#16213D',
  structuralTint: '#24304F',
  structuralInk: '#F1EFE9',

  // Status tokens
  statusGood: '#1E8A6E',
  statusGoodBg: '#E8F4EF',
  statusGoodBorder: '#1E8A6E',

  statusWarning: '#A9720B',
  statusWarningBg: '#FBF0DC',
  statusWarningBorder: '#A9720B',

  statusCritical: '#B23A2E',
  statusCriticalBg: '#FBE9E5',
  statusCriticalBorder: '#B23A2E',

  statusInfo: '#3A5385',
  statusInfoBg: '#EAEEF6',
  statusInfoBorder: '#3A5385',

  // Compatibility aliases for legacy consumers
  amber: '#E1592A',
  amberLight: '#FBF0DC',
  navy: '#16213D',
  bodyText: '#1B1D27',
  mutedText: '#545765',
  ruleLine: '#E8E1D4',
  tableHeaderBg: '#16213D',
  tableHeaderText: '#F1EFE9',
  tableRowAlt: '#FBF7F1',
  warningBg: '#FBF0DC',
  warningBorder: '#A9720B',
};

export const reportStyleDictionary: StyleDictionary = {
  // Cover typography
  coverKicker: { fontSize: 10, bold: true, color: REPORT_COLOURS.accent, characterSpacing: 1.2, margin: [0, 0, 0, 8] },
  coverTitle: { fontSize: 28, bold: true, color: REPORT_COLOURS.structuralInk, margin: [0, 0, 0, 6] },
  coverSubtitle: { fontSize: 12, color: '#A0AEC0', margin: [0, 0, 0, 3] },
  coverMeta: { fontSize: 10, color: '#CBD5E1', margin: [0, 0, 0, 0] },
  coverStatLabel: { fontSize: 8, bold: true, color: '#94A3B8', characterSpacing: 0.8 },
  coverStatValue: { fontSize: 18, bold: true, color: REPORT_COLOURS.accent },

  // Section wayfinding & titles
  sectionKicker: { fontSize: 10, bold: true, color: REPORT_COLOURS.accent, characterSpacing: 1.0, margin: [0, 16, 0, 2] },
  sectionHeading: { fontSize: 18, bold: true, color: REPORT_COLOURS.structural, margin: [0, 0, 0, 10] },
  subHeading: { fontSize: 12, bold: true, color: REPORT_COLOURS.structural, margin: [0, 12, 0, 4] },

  // Body & narrative
  body: { fontSize: 9.5, color: REPORT_COLOURS.ink, lineHeight: 1.35 },
  bodySecondary: { fontSize: 9, color: REPORT_COLOURS.inkSecondary, lineHeight: 1.3 },
  muted: { fontSize: 8.5, color: REPORT_COLOURS.inkMuted, italics: true },

  // Stat tiles
  statLabel: { fontSize: 8, color: REPORT_COLOURS.inkMuted, bold: true, characterSpacing: 0.6 },
  statValue: { fontSize: 18, color: REPORT_COLOURS.accent, bold: true },
  statCaption: { fontSize: 7.5, color: REPORT_COLOURS.inkMuted, characterSpacing: 0.2 },

  // Tables
  tableHeader: {
    fontSize: 8.5,
    bold: true,
    color: REPORT_COLOURS.tableHeaderText,
    fillColor: REPORT_COLOURS.tableHeaderBg,
  },
  tableCell: { fontSize: 8.5, color: REPORT_COLOURS.ink },
  mono: { fontSize: 8.5, characterSpacing: 0.3, color: REPORT_COLOURS.structural, bold: true },

  // Notice plates / callouts
  noticeTitleCritical: { fontSize: 10, bold: true, color: REPORT_COLOURS.statusCritical },
  noticeTitleWarning: { fontSize: 10, bold: true, color: REPORT_COLOURS.statusWarning },
  noticeTitleInfo: { fontSize: 10, bold: true, color: REPORT_COLOURS.statusInfo },
  noticeBody: { fontSize: 8.5, color: REPORT_COLOURS.inkSecondary, lineHeight: 1.3 },
  warningTitle: { fontSize: 10, bold: true, color: REPORT_COLOURS.statusWarning },
};

// ─── Format 2: Uplink (Executive / Budget-Holder Brief) ──────────────────────
export const REPORT_UPLINK_COLOURS = {
  paper: '#F4F6F6',
  ink: '#13181A',
  inkSecondary: '#4E5A5D',
  inkMuted: '#78878B',
  line: '#DDE3E3',
  accent: '#E1592A',
  structural: '#0F2E33',
  structuralInk: '#FFFFFF',
  cardBg: '#FFFFFF',
  metricBg: '#E9EFEF',
};

export const uplinkStyleDictionary: StyleDictionary = {
  coverKicker: { fontSize: 9, bold: true, color: REPORT_UPLINK_COLOURS.accent, characterSpacing: 1.5, margin: [0, 0, 0, 10] },
  coverTitle: { fontSize: 28, bold: true, color: REPORT_UPLINK_COLOURS.structural, lineHeight: 1.15, margin: [0, 0, 0, 8] },
  coverSubtitle: { fontSize: 13, italics: true, color: REPORT_UPLINK_COLOURS.inkSecondary, margin: [0, 0, 0, 14] },
  coverMeta: { fontSize: 9, color: REPORT_UPLINK_COLOURS.inkMuted },
  heroStatement: { fontSize: 16, bold: true, color: REPORT_UPLINK_COLOURS.structural, lineHeight: 1.3, margin: [0, 0, 0, 12] },
  sectionHeading: { fontSize: 16, bold: true, color: REPORT_UPLINK_COLOURS.structural, margin: [0, 16, 0, 8] },
  subHeading: { fontSize: 11, bold: true, color: REPORT_UPLINK_COLOURS.structural, margin: [0, 10, 0, 4] },
  body: { fontSize: 9.5, color: REPORT_UPLINK_COLOURS.ink, lineHeight: 1.4 },
  bodySecondary: { fontSize: 8.5, color: REPORT_UPLINK_COLOURS.inkSecondary, lineHeight: 1.35 },
  metricValue: { fontSize: 16, bold: true, color: REPORT_UPLINK_COLOURS.accent },
  metricLabel: { fontSize: 8.5, bold: true, color: REPORT_UPLINK_COLOURS.structural },
  metricDesc: { fontSize: 8, color: REPORT_UPLINK_COLOURS.inkSecondary },
};

// ─── Format 3: Patch Sheet (Field Installation Work Order) ───────────────────
export const REPORT_PATCH_COLOURS = {
  paper: '#FFFFFF',
  ink: '#101010',
  inkSecondary: '#303030',
  inkMuted: '#606060',
  line: '#101010',
  accent: '#E1592A',
  accentBg: '#FFF3EE',
  tableHeaderBg: '#101010',
  tableHeaderText: '#FFFFFF',
};

export const patchSheetStyleDictionary: StyleDictionary = {
  docControlLabel: { fontSize: 7, bold: true, color: REPORT_PATCH_COLOURS.inkMuted, characterSpacing: 0.5 },
  docControlValue: { fontSize: 8.5, bold: true, color: REPORT_PATCH_COLOURS.ink },
  workOrderTitle: { fontSize: 18, bold: true, color: REPORT_PATCH_COLOURS.ink, characterSpacing: 1.0, margin: [0, 8, 0, 4] },
  workOrderScope: { fontSize: 9, color: REPORT_PATCH_COLOURS.inkSecondary, margin: [0, 0, 0, 10] },
  sectionHeading: { fontSize: 12, bold: true, color: REPORT_PATCH_COLOURS.ink, characterSpacing: 0.8, margin: [0, 14, 0, 6] },
  body: { fontSize: 8.5, color: REPORT_PATCH_COLOURS.ink, lineHeight: 1.3 },
  checkItem: { fontSize: 8.5, color: REPORT_PATCH_COLOURS.ink, lineHeight: 1.35 },
  checkItemBold: { fontSize: 8.5, bold: true, color: REPORT_PATCH_COLOURS.ink },
  tableHeader: { fontSize: 8, bold: true, color: '#FFFFFF', fillColor: '#101010' },
  tableCell: { fontSize: 8, color: '#101010' },
};

// ─── Format 4: Crossover (Configuration & Decision Comparison) ───────────────
export const REPORT_CROSSOVER_COLOURS = {
  paper: '#F7F6F3',
  ink: '#1B1D1F',
  inkSecondary: '#52565A',
  inkMuted: '#84888D',
  line: '#DEDCD6',
  optionA: '#E1592A',
  optionABg: '#FDF1EC',
  optionB: '#2A6C8C',
  optionBBg: '#EBF4F8',
  recommended: '#1E8A6E',
  recommendedBg: '#E8F4EF',
};

export const crossoverStyleDictionary: StyleDictionary = {
  coverTitle: { fontSize: 24, bold: true, color: REPORT_CROSSOVER_COLOURS.ink, characterSpacing: 1.2, margin: [0, 0, 0, 6] },
  coverSubtitle: { fontSize: 11, color: REPORT_CROSSOVER_COLOURS.inkSecondary, margin: [0, 0, 0, 12] },
  sectionHeading: { fontSize: 14, bold: true, color: REPORT_CROSSOVER_COLOURS.ink, characterSpacing: 0.8, margin: [0, 16, 0, 8] },
  subHeading: { fontSize: 10.5, bold: true, color: REPORT_CROSSOVER_COLOURS.ink, margin: [0, 8, 0, 4] },
  body: { fontSize: 9, color: REPORT_CROSSOVER_COLOURS.ink, lineHeight: 1.35 },
  verdictLine: { fontSize: 8.5, italics: true, color: REPORT_CROSSOVER_COLOURS.inkSecondary },
  badgeA: { fontSize: 7.5, bold: true, color: '#FFFFFF', fillColor: REPORT_CROSSOVER_COLOURS.optionA },
  badgeB: { fontSize: 7.5, bold: true, color: '#FFFFFF', fillColor: REPORT_CROSSOVER_COLOURS.optionB },
  badgeRec: { fontSize: 7.5, bold: true, color: '#FFFFFF', fillColor: REPORT_CROSSOVER_COLOURS.recommended },
};

export const REPORT_PAGE_MARGINS: [number, number, number, number] = [40, 45, 40, 50];

