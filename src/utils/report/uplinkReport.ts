/**
 * uplinkReport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * "Uplink" report format for budget holders, executive sponsors, and business
 * leaders. Replaces equipment inventory with business outcome reframes, risk
 * reduction metrics, and strategic investment justifications.
 *
 * Design Tokens:
 * • Paper: #F4F6F6, Ink: #13181A, Secondary Ink: #4E5A5D
 * • Line: #DDE3E3, Brand Accent: #E1592A, Structural: #0F2E33
 */
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ReportInput } from './buildReportDocDefinition';
import { buildTopologyStats } from './describeTopology';
import { REPORT_UPLINK_COLOURS, uplinkStyleDictionary, REPORT_PAGE_MARGINS } from './reportStyles';
import { markdownToPdfmakeContent } from './markdownToPdfmake';

/**
 * Builds the ascending milestone line chart SVG for the Uplink cover.
 * Shows progression: Ingress Deployed → Aggregation Live → Full Visibility.
 */
function buildMilestoneChartSvg(hasTaps: boolean, hasSpans: boolean): string {
  const W = 515;
  const H = 90;
  const c = REPORT_UPLINK_COLOURS;
  const milestone1Label = hasTaps && hasSpans ? 'Capture Live' : (hasTaps ? 'TAPs Deployed' : 'SPANs Live');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="upGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${c.structural}" />
        <stop offset="50%" stop-color="${c.structural}" />
        <stop offset="100%" stop-color="${c.accent}" />
      </linearGradient>
    </defs>

    <!-- Base guide line -->
    <line x1="40" y1="65" x2="475" y2="65" stroke="${c.line}" stroke-width="1" stroke-dasharray="3,3" />

    <!-- Milestone trajectory line -->
    <path d="M 50 60 Q 180 50, 260 38 T 465 18" stroke="url(#upGrad)" stroke-width="2.5" fill="none" />

    <!-- Milestone 1: TAPs/SPANs Deployed -->
    <circle cx="50" cy="60" r="5" fill="${c.structural}" />
    <circle cx="50" cy="60" r="2.5" fill="#FFFFFF" />
    <text x="50" y="78" font-family="sans-serif" font-size="8" font-weight="bold" fill="${c.structural}" text-anchor="middle">MILESTONE 01</text>
    <text x="50" y="87" font-family="sans-serif" font-size="7" fill="${c.inkSecondary}" text-anchor="middle">${milestone1Label}</text>

    <!-- Milestone 2: Aggregation Live -->
    <circle cx="260" cy="38" r="5" fill="${c.structural}" />
    <circle cx="260" cy="38" r="2.5" fill="#FFFFFF" />
    <text x="260" y="56" font-family="sans-serif" font-size="8" font-weight="bold" fill="${c.structural}" text-anchor="middle">MILESTONE 02</text>
    <text x="260" y="65" font-family="sans-serif" font-size="7" fill="${c.inkSecondary}" text-anchor="middle">Aggregation Live</text>

    <!-- Milestone 3: Full Visibility -->
    <circle cx="465" cy="18" r="6.5" fill="${c.accent}" />
    <circle cx="465" cy="18" r="3" fill="#FFFFFF" />
    <text x="465" y="36" font-family="sans-serif" font-size="8" font-weight="bold" fill="${c.accent}" text-anchor="middle">MILESTONE 03</text>
    <text x="465" y="45" font-family="sans-serif" font-size="7" font-weight="bold" fill="${c.structural}" text-anchor="middle">Full Visibility</text>
  </svg>`;
}

export function buildUplinkReportDocDefinition(input: ReportInput): TDocumentDefinitions {
  const {
    nodes,
    edges,
    trafficStreams,
    projectName,
    projectRegion,
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
  // COVER / EXECUTIVE HERO SECTION (Light Airy Palette)
  // ═══════════════════════════════════════════════════════════════
  if (logoDataUrl) {
    content.push({
      image: logoDataUrl,
      width: 110,
      alignment: 'right',
      margin: [0, 0, 0, 16],
    });
  }

  content.push({ text: 'EXECUTIVE VISIBILITY BRIEF · UPLINK', style: 'coverKicker' });
  content.push({ text: projectName || 'Network Visibility Strategy', style: 'coverTitle' });
  content.push({
    text: 'A business outcome and operational risk reduction overview of the visibility architecture.',
    style: 'coverSubtitle',
  });

  content.push({
    columns: [
      { text: `Prepared for: Enterprise Leadership · ${projectRegion || 'Global'}`, style: 'coverMeta' },
      { text: `Date: ${dateFormatted} · Term: ${defaultTermDuration || '12'} Months`, style: 'coverMeta', alignment: 'right' },
    ],
    margin: [0, 0, 0, 18],
  });

  const hasTaps = stats.tapUnitCount > 0;
  const hasSpans =
    (stats.inputCounts.span +
      stats.inputCounts.erspan +
      stats.inputCounts.eastWest +
      stats.inputCounts.vmware +
      stats.inputCounts.other) > 0;

  // Milestone trajectory chart
  content.push({
    svg: buildMilestoneChartSvg(hasTaps, hasSpans),
    width: 515,
    margin: [0, 0, 0, 20],
  });

  // ═══════════════════════════════════════════════════════════════
  // THE HERO REFRAME (Outcome-based Value Pillars)
  // ═══════════════════════════════════════════════════════════════
  const ingressFeedLabel =
    hasTaps && !hasSpans
      ? `${stats.totalFeedCount} Ingress Optical Feeds`
      : `${stats.totalFeedCount} Ingress Traffic Feeds`;
  const ingressFeedDesc =
    hasTaps
      ? 'Complete wire-speed capture without SPAN port contention or switch CPU degradation.'
      : 'Dedicated high-capacity ingress aggregation without packet drop or tool contention.';

  content.push({
    table: {
      widths: ['100%'],
      body: [
        [
          {
            fillColor: REPORT_UPLINK_COLOURS.cardBg,
            borderColor: [REPORT_UPLINK_COLOURS.line, REPORT_UPLINK_COLOURS.line, REPORT_UPLINK_COLOURS.line, REPORT_UPLINK_COLOURS.line],
            border: [true, true, true, true],
            margin: [16, 14, 16, 14],
            stack: [
              {
                text: '“Every critical link across all operational sites is captured passively and transformed in dedicated hardware — eliminating monitoring blind spots without imposing switch overhead.”',
                style: 'heroStatement',
              },
              {
                columns: [
                  {
                    stack: [
                      { text: `${stats.monitoredLinkCount} Monitored Links`, style: 'metricValue' },
                      { text: ingressFeedLabel, style: 'metricLabel', margin: [0, 2, 0, 2] },
                      { text: ingressFeedDesc, style: 'metricDesc' },
                    ],
                  },
                  {
                    stack: [
                      { text: `${stats.toolCount} Destination Tools`, style: 'metricValue' },
                      { text: 'Optimised Ingestion Flow', style: 'metricLabel', margin: [0, 2, 0, 2] },
                      { text: 'Feeds security and observability platforms with precisely filtered, deduplicated data.', style: 'metricDesc' },
                    ],
                  },
                  {
                    stack: [
                      { text: stats.totalBandwidthLabel, style: 'metricValue' },
                      { text: 'Total Visibility Capacity', style: 'metricLabel', margin: [0, 2, 0, 2] },
                      { text: 'Scalable multi-terabit processing fabric ready for line-rate expansion.', style: 'metricDesc' },
                    ],
                  },
                ],
                margin: [0, 8, 0, 0],
              },
            ],
          },
        ],
      ],
    },
    margin: [0, 0, 0, 22],
    layout: {
      defaultBorder: false,
    },
  });

  // ═══════════════════════════════════════════════════════════════
  // STRATEGIC BUSINESS IMPACT NARRATIVE
  // ═══════════════════════════════════════════════════════════════
  content.push({ text: 'Business Impact & Operational Governance', style: 'sectionHeading' });

  if (execSummaryText) {
    content.push(...markdownToPdfmakeContent(execSummaryText));
  } else {
    content.push({
      text:
        'Modern cybersecurity, performance monitoring, and compliance mandates require uncompromised packet visibility across every critical segment. ' +
        'By deploying a dedicated Gigamon visibility fabric, the organisation separates traffic capture from production routing — providing continuous inspection without risking network latency or tool overload.',
      style: 'body',
      margin: [0, 0, 0, 10],
    });
  }

  // Key Strategic Outcomes Table
  content.push({
    table: {
      widths: ['30%', '70%'],
      dontBreakRows: true,
      body: [
        [
          { text: 'STRATEGIC PILLAR', style: 'subHeading', fillColor: REPORT_UPLINK_COLOURS.metricBg },
          { text: 'BUSINESS & OPERATIONAL OUTCOME', style: 'subHeading', fillColor: REPORT_UPLINK_COLOURS.metricBg },
        ],
        [
          { text: 'Risk Mitigation', style: 'body', bold: true },
          {
            text: 'Eliminates blind spots across east-west and north-south traffic, ensuring SIEM, NDR, and APM tools receive complete signal paths.',
            style: 'bodySecondary',
          },
        ],
        [
          { text: 'Tool Cost Optimisation', style: 'body', bold: true },
          {
            text: 'Deduplication and flow filtering reduce unnecessary packet volume to downstream monitoring tools by up to 50%, deferring expensive tool license upgrades.',
            style: 'bodySecondary',
          },
        ],
        [
          { text: 'Zero Production Impact', style: 'body', bold: true },
          {
            text:
              stats.tapUnitCount > 0
                ? 'Optical TAPs operate purely at the physical layer with zero power consumption and zero software overhead on production core switches.'
                : 'Dedicated visibility fabric offloads monitoring traffic from production core switches, eliminating CPU degradation and SPAN session limits.',
            style: 'bodySecondary',
          },
        ],
        [
          { text: 'Architectural Agility', style: 'body', bold: true },
          {
            text: 'New monitoring tools, compliance probes, or cloud gateways can be attached instantly to the aggregation layer without maintenance windows or network reconfigurations.',
            style: 'bodySecondary',
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => REPORT_UPLINK_COLOURS.line,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
    margin: [0, 8, 0, 18],
  });

  // Reference footer note
  content.push({
    text: 'Note: For full technical specifications, port allocation maps, and hardware rack elevations, please refer to the accompanying Signal Path and Patch Sheet reports.',
    style: 'metricDesc',
    italics: true,
    margin: [0, 10, 0, 0],
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
          color: REPORT_UPLINK_COLOURS.paper,
        },
      ],
    }),
    content,
    styles: uplinkStyleDictionary,
    defaultStyle: {
      font: 'Roboto',
      color: REPORT_UPLINK_COLOURS.ink,
      fontSize: 9.5,
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: 'UPLINK · EXECUTIVE VISIBILITY BRIEF', fontSize: 7.5, color: REPORT_UPLINK_COLOURS.inkMuted },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 7.5, color: REPORT_UPLINK_COLOURS.inkMuted },
      ],
      margin: [40, 10, 40, 0],
    }),
  };
}
