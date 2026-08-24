/**
 * crossoverReport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * "Crossover" report format for architectural decisions and configuration
 * evaluations (e.g. High Availability vs Single Chassis, HTL Term vs Perpetual
 * Licensing, Direct TAP vs Aggregated TAP).
 *
 * Design Tokens:
 * • Paper: #F7F6F3, Ink: #1B1D1F, Hairline: #DEDCD6
 * • Option A (Gigamon Orange): #E1592A (Bg: #FDF1EC)
 * • Option B (Teal Blue): #2A6C8C (Bg: #EBF4F8)
 * • Recommended: #1E8A6E
 */
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ReportInput } from './buildReportDocDefinition';
import { buildTopologyStats } from './describeTopology';
import { REPORT_CROSSOVER_COLOURS, crossoverStyleDictionary, REPORT_PAGE_MARGINS } from './reportStyles';
import { markdownToPdfmakeContent } from './markdownToPdfmake';

/**
 * Builds the crossed-line connector icon SVG for the split Crossover cover.
 */
function buildCrossoverIconSvg(): string {
  const W = 60;
  const H = 40;
  const cA = REPORT_CROSSOVER_COLOURS.optionA;
  const cB = REPORT_CROSSOVER_COLOURS.optionB;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <line x1="5" y1="8" x2="55" y2="32" stroke="${cA}" stroke-width="3" stroke-linecap="round" />
    <line x1="5" y1="32" x2="55" y2="8" stroke="${cB}" stroke-width="3" stroke-linecap="round" />
    <circle cx="30" cy="20" r="5" fill="#FFFFFF" stroke="#1B1D1F" stroke-width="1.5" />
  </svg>`;
}

export function buildCrossoverReportDocDefinition(input: ReportInput): TDocumentDefinitions {
  const {
    nodes,
    edges,
    trafficStreams,
    projectName,
    projectRegion,
    projectLicenseMode,
    defaultTermDuration,
    execSummaryText,
    logoDataUrl,
  } = input;

  const stats = buildTopologyStats(nodes, edges, trafficStreams);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const content: Content[] = [];

  // ═══════════════════════════════════════════════════════════════
  // SPLIT COVER (Option A vs Option B)
  // ═══════════════════════════════════════════════════════════════
  if (logoDataUrl) {
    content.push({
      image: logoDataUrl,
      width: 110,
      alignment: 'right',
      margin: [0, 0, 0, 12],
    });
  }

  content.push({ text: 'ARCHITECTURAL DECISION & CONFIGURATION COMPARISON', style: 'badgeA', margin: [0, 0, 0, 8] });
  content.push({ text: `Crossover: ${projectName || 'Visibility Architecture'}`, style: 'coverTitle' });
  content.push({
    text: 'A structured side-by-side trade-off analysis between design options to resolve open configuration decisions.',
    style: 'coverSubtitle',
  });

  content.push({
    columns: [
      { text: `Scope: ${projectRegion || 'Global'} · ${stats.monitoredLinkCount} Links (${stats.totalFeedCount} Feeds)`, style: 'bodySecondary' },
      { text: `Date: ${dateFormatted}`, style: 'bodySecondary', alignment: 'right' },
    ],
    margin: [0, 0, 0, 14],
  });

  // Split banner with Crossover Icon
  content.push({
    table: {
      widths: ['45%', '10%', '45%'],
      body: [
        [
          {
            fillColor: REPORT_CROSSOVER_COLOURS.optionABg,
            border: [true, true, false, true],
            borderColor: [REPORT_CROSSOVER_COLOURS.optionA, REPORT_CROSSOVER_COLOURS.optionA, REPORT_CROSSOVER_COLOURS.optionA, REPORT_CROSSOVER_COLOURS.optionA],
            margin: [12, 10, 12, 10],
            stack: [
              { text: 'OPTION A · RECOMMENDED', style: 'subHeading', color: REPORT_CROSSOVER_COLOURS.optionA },
              { text: 'High-Availability Resilient Visibility Architecture', style: 'body', bold: true, margin: [0, 2, 0, 2] },
              { text: 'Redundant aggregation chassis, dual optic feeds, and hitless hardware failover for mission-critical core monitoring.', style: 'bodySecondary' },
            ],
          },
          {
            fillColor: '#FFFFFF',
            border: [false, true, false, true],
            borderColor: [REPORT_CROSSOVER_COLOURS.line, REPORT_CROSSOVER_COLOURS.line, REPORT_CROSSOVER_COLOURS.line, REPORT_CROSSOVER_COLOURS.line],
            alignment: 'center',
            margin: [0, 16, 0, 0],
            stack: [{ svg: buildCrossoverIconSvg(), width: 36, alignment: 'center' }],
          },
          {
            fillColor: REPORT_CROSSOVER_COLOURS.optionBBg,
            border: [false, true, true, true],
            borderColor: [REPORT_CROSSOVER_COLOURS.optionB, REPORT_CROSSOVER_COLOURS.optionB, REPORT_CROSSOVER_COLOURS.optionB, REPORT_CROSSOVER_COLOURS.optionB],
            margin: [12, 10, 12, 10],
            stack: [
              { text: 'OPTION B · ALTERNATIVE', style: 'subHeading', color: REPORT_CROSSOVER_COLOURS.optionB },
              { text: 'Single-Chassis Standard Architecture', style: 'body', bold: true, margin: [0, 2, 0, 2] },
              { text: 'Cost-optimised standalone aggregation with single-switch footprint for non-critical or lab environments.', style: 'bodySecondary' },
            ],
          },
        ],
      ],
    },
    margin: [0, 0, 0, 20],
  });

  // ═══════════════════════════════════════════════════════════════
  // EXECUTIVE CONTEXT & DECISION SUMMARY
  // ═══════════════════════════════════════════════════════════════
  content.push({ text: 'Decision Context & Evaluation Criteria', style: 'sectionHeading' });

  if (execSummaryText) {
    content.push(...markdownToPdfmakeContent(execSummaryText));
  } else {
    content.push({
      text:
        'When architecting an enterprise visibility fabric, engineering leaders must balance continuous uptime and failure resilience against initial capital investment. ' +
        'This document evaluates Option A (the resilient design reflected in this project) against Option B (the simplified single-appliance alternative).',
      style: 'body',
      margin: [0, 0, 0, 12],
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SIDE-BY-SIDE COMPARISON MATRIX
  // ═══════════════════════════════════════════════════════════════
  content.push({ text: 'Side-by-Side Architectural Trade-Offs', style: 'sectionHeading' });

  const comparisonRows = [
    {
      criterion: 'High Availability & Resiliency',
      optionA: 'Dual aggregation nodes per site; loss of a single chassis maintains 100% visibility to monitoring tools.',
      optionB: 'Single chassis per site; appliance maintenance causes temporary monitoring blackout.',
      verdict: 'Option A provides uninterrupted telemetry essential for 24/7 SOC operations.',
    },
    {
      criterion: 'Port Density & Expansion Headroom',
      optionA: `Modular chassis supporting up to ${stats.monitoredLinkCount * 2} ports with scalable line cards.`,
      optionB: 'Fixed-port chassis requiring full box replacement when port count exceeds capacity.',
      verdict: 'Option A protects investment by accommodating multi-year bandwidth growth.',
    },
    {
      criterion: 'Transformation & SSL Decryption',
      optionA: 'Dedicated hardware GigaSMART engine offloading CPU-intensive crypto and deduplication.',
      optionB: 'Basic flow aggregation without onboard decryption, forcing tools to perform SSL inspect.',
      verdict: 'Option A prevents tool CPU exhaustion and lowers SIEM ingestion license costs.',
    },
    {
      criterion: 'Licensing & Commercial Model',
      optionA: `${projectLicenseMode || 'HTL'} Subscription (${defaultTermDuration || '12'} mo) with bundled hardware support and tier flexibility.`,
      optionB: 'Perpetual licensing with separate recurring maintenance and annual renewals.',
      verdict: 'Option A delivers lower upfront CapEx and predictable operational expenditure.',
    },
  ];

  comparisonRows.forEach((row, i) => {
    content.push({
      table: {
        widths: ['26%', '37%', '37%'],
        dontBreakRows: true,
        body: [
          [
            {
              fillColor: '#FFFFFF',
              margin: [8, 8, 8, 8],
              stack: [
                { text: `DECISION POINT ${i + 1}`, fontSize: 7, bold: true, color: REPORT_CROSSOVER_COLOURS.inkMuted },
                { text: row.criterion, style: 'subHeading', margin: [0, 2, 0, 0] },
              ],
            },
            {
              fillColor: REPORT_CROSSOVER_COLOURS.optionABg,
              margin: [8, 8, 8, 8],
              stack: [
                { text: 'OPTION A [RECOMMENDED]', style: 'badgeRec', margin: [0, 0, 0, 4] },
                { text: row.optionA, style: 'body' },
              ],
            },
            {
              fillColor: REPORT_CROSSOVER_COLOURS.optionBBg,
              margin: [8, 8, 8, 8],
              stack: [
                { text: 'OPTION B [ALTERNATIVE]', style: 'badgeB', margin: [0, 0, 0, 4] },
                { text: row.optionB, style: 'body' },
              ],
            },
          ],
          [
            {
              colSpan: 3,
              fillColor: '#FAF9F6',
              margin: [8, 4, 8, 4],
              text: `Verdict: ${row.verdict}`,
              style: 'verdictLine',
            },
            {},
            {},
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => REPORT_CROSSOVER_COLOURS.line,
        vLineColor: () => REPORT_CROSSOVER_COLOURS.line,
      },
      margin: [0, 0, 0, 10],
    });
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: REPORT_PAGE_MARGINS,
    background: () => ({
      canvas: [
        {
          type: 'rect',
          x: 0,
          y: 0,
          w: 595.28,
          h: 841.89,
          color: REPORT_CROSSOVER_COLOURS.paper,
        },
      ],
    }),
    content,
    styles: crossoverStyleDictionary,
    defaultStyle: {
      font: 'Roboto',
      color: REPORT_CROSSOVER_COLOURS.ink,
      fontSize: 9,
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: 'CROSSOVER · ARCHITECTURAL DECISION BRIEF', fontSize: 7.5, color: REPORT_CROSSOVER_COLOURS.inkMuted },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 7.5, color: REPORT_CROSSOVER_COLOURS.inkMuted },
      ],
      margin: [40, 10, 40, 0],
    }),
  };
}
