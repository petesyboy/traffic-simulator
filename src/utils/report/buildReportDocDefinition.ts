/**
 * buildReportDocDefinition.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Assembles the pdfmake document-definition for a customer-facing solution
 * report implementing the "Signal Path" design system:
 * • Full-bleed dark navy (#16213D) cover with abstract vector fan-in graphic
 * • Automated Table of Contents with section wayfinding kickers (§01, §02, etc.)
 * • Hairline stat tiles grid with intelligent zero-value handling (em-dash + caption)
 * • Multi-severity notice plates (Critical, Warning, Info) with 2px status borders
 * • High-contrast equipment-panel table headers (#16213D) and zebra rows
 * • Clean running headers, footers, and orphan prevention
 */
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Edge } from '@xyflow/react';
import type {
  CustomNode,
  TrafficStream,
  GigaSmartNodeData,
  InputNodeData,
  ToolNodeData,
  HardwareNodeData,
  NodeMetrics,
} from '../../store/types';
import { NODE_TYPES, ACTION_TYPES } from '../../constants/nodeTypes';
import { getNodeValueProposition } from '../../constants/nodeValues';
import { generateBom, validateConfiguration, getSkus } from '../../utils/bomEngine';
import { buildPhysicalItems, parseAndConvertDimensions, type PhysicalItem } from '../bom/physicalItems';
import { buildProjectWideOpticBom } from '../bom/opticPacks';
import {
  buildTopologyStats,
  describeInputNodeDetail,
  describeProcessingNodeDetail,
  describeToolNodeDetail,
  describeHostedGigaSmartAppDetail,
  describeGigaSmartAction,
  resolveNodeSite,
  getTapNodeLinks,
  type NodeDetail,
} from './describeTopology';
import { describeGigaSmartFunction } from './gigaSmartDescriptions';
import { describeAggregatedTapPhysicalLink } from './describeTapLink';
import { describeChassisPurpose } from './chassisDescriptions';
import { describeToolPurpose, describeToolOverloadRisk } from './toolDescriptions';
import { traceToTerminalInputs } from './graphTrace';
import { formatBandwidth } from '../format';
import { isAutoTrayModel } from '../trayModels';
import { reportStyleDictionary, REPORT_COLOURS, REPORT_PAGE_MARGINS } from './reportStyles';
import { markdownToPdfmakeContent } from './markdownToPdfmake';

export interface ReportInput {
  nodes: CustomNode[];
  edges: Edge[];
  trafficStreams: TrafficStream[];
  projectName: string;
  projectRegion: string;
  projectLicenseMode: 'HTL' | 'Perpetual';
  defaultTermDuration: string;
  peakNodeRxMbps: Record<string, number>;
  advancedMode: boolean;
  diagramDataUrl: string;
  logoDataUrl?: string;
  /** Live per-node traffic metrics, only rendered when `isRunning` is true. */
  nodeMetrics: Record<string, NodeMetrics>;
  isRunning: boolean;
  /** Composited front-panel PNGs, keyed by hardware node id. */
  chassisFrontPanelImages?: Record<string, string>;
  /** 42U Rack Elevation diagrams, keyed by physical site name. */
  siteRackImages?: Record<string, string>;
  /** Zoomed-in per-site architecture diagrams, keyed by site name. */
  siteDiagrams?: Record<string, string>;
  /** User-authored executive summary. */
  execSummaryText?: string;
}

/** Cleans trailing punctuation and stray brackets from generated bullets. */
function cleanBulletText(text: string): string {
  return text.trim().replace(/[,;]\s*$/, '').replace(/\)\s*\)$/, ')');
}

/** Renders a node's headline + detail bullets + value-proposition line, as one report entry. */
const detailStack = (headline: string, detail: NodeDetail, valueProposition?: string): Content => ({
  stack: [
    { text: headline, style: 'body', bold: true },
    ...(detail.bullets.length > 0
      ? [{ ul: detail.bullets.map(cleanBulletText), style: 'bodySecondary', margin: [0, 2, 0, 0] as [number, number, number, number] }]
      : []),
    ...(valueProposition
      ? [
          {
            text: valueProposition,
            style: 'muted',
            italics: true,
            margin: [0, 3, 0, 0] as [number, number, number, number],
          },
        ]
      : []),
  ],
  margin: [0, 0, 0, 10],
  unbreakable: true,
});

/** Stat Tile options with intelligent zero-value handling */
interface StatTileOptions {
  label: string;
  value: number | string;
  zeroCaption?: string;
  activeColor?: string;
}

function buildStatTile(options: StatTileOptions): Content {
  const { label, value, zeroCaption = 'not used in this design', activeColor = REPORT_COLOURS.accent } = options;
  const numVal = typeof value === 'number' ? value : parseInt(String(value), 10);
  const isZero = isNaN(numVal) ? value === '0' || value === '0.0' : numVal === 0;

  return {
    stack: [
      // LED indicator + mono uppercase label
      {
        columns: [
          {
            canvas: [
              {
                type: 'ellipse',
                x: 3.5,
                y: 3.5,
                r1: 3.5,
                r2: 3.5,
                color: isZero ? '#94A3B8' : activeColor,
              },
            ],
            width: 10,
          },
          {
            text: label.toUpperCase(),
            style: 'statLabel',
            color: isZero ? '#64748B' : REPORT_COLOURS.structural,
          },
        ],
        margin: [0, 0, 0, 3],
      },
      // Number or Em-dash
      {
        text: isZero ? '—' : String(value),
        style: 'statValue',
        color: isZero ? '#64748B' : activeColor,
        margin: [0, 0, 0, isZero ? 2 : 0],
      },
      // Zero caption
      ...(isZero
        ? [
            {
              text: zeroCaption,
              style: 'statCaption',
              color: '#8B8D99',
            },
          ]
        : []),
    ],
    margin: [6, 6, 6, 6],
    fillColor: isZero ? '#FAF9F6' : '#FFFFFF',
  };
}

/** Notice Plate severity definition */
export type NoticeSeverity = 'critical' | 'warning' | 'info';

export interface NoticePlateOptions {
  severity: NoticeSeverity;
  title: string;
  message?: string;
  bullets?: string[];
}

export function buildNoticePlate(options: NoticePlateOptions): Content {
  const { severity, title, message, bullets } = options;

  const config = {
    critical: {
      color: REPORT_COLOURS.statusCritical,
      bg: REPORT_COLOURS.statusCriticalBg,
      icon: 'X',
      style: 'noticeTitleCritical',
    },
    warning: {
      color: REPORT_COLOURS.statusWarning,
      bg: REPORT_COLOURS.statusWarningBg,
      icon: '!',
      style: 'noticeTitleWarning',
    },
    info: {
      color: REPORT_COLOURS.statusInfo,
      bg: REPORT_COLOURS.statusInfoBg,
      icon: 'i',
      style: 'noticeTitleInfo',
    },
  }[severity];

  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              // 2.5px top status color bar
              {
                canvas: [
                  {
                    type: 'line',
                    x1: 0,
                    y1: 0,
                    x2: 500,
                    y2: 0,
                    lineWidth: 2.5,
                    lineColor: config.color,
                  },
                ],
                margin: [0, 0, 0, 6],
              },
              {
                columns: [
                  {
                    text: `[ ${config.icon} ]`,
                    bold: true,
                    fontSize: 9.5,
                    color: config.color,
                    width: 22,
                  },
                  {
                    text: title,
                    style: config.style,
                  },
                ],
                margin: [0, 0, 0, 4],
              },
              ...(message
                ? [
                    {
                      text: message,
                      style: 'noticeBody',
                      margin: [22, 0, 0, bullets?.length ? 4 : 0] as [number, number, number, number],
                    },
                  ]
                : []),
              ...(bullets && bullets.length > 0
                ? [
                    {
                      ul: bullets.map(cleanBulletText),
                      style: 'noticeBody',
                      margin: [22, 0, 0, 0] as [number, number, number, number],
                    },
                  ]
                : []),
            ],
            fillColor: config.bg,
            margin: [8, 6, 8, 8],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => REPORT_COLOURS.lineStrong,
      vLineColor: () => REPORT_COLOURS.lineStrong,
    },
    margin: [0, 6, 0, 10],
    unbreakable: true,
  };
}

/** Cover background full-bleed SVG (Dark Navy + Signal Path fan-in vector lines) */
function generateCoverSvg(): string {
  return `
  <svg width="595.28" height="841.89" viewBox="0 0 595.28 841.89" xmlns="http://www.w3.org/2000/svg">
    <!-- Dark Navy Equipment-Panel Surface -->
    <rect width="595.28" height="841.89" fill="#16213D" />
    
    <!-- Subtle gradient wash -->
    <defs>
      <linearGradient id="navGlow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#24304F" stop-opacity="0.8"/>
        <stop offset="60%" stop-color="#16213D" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#0E1526" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <rect width="595.28" height="841.89" fill="url(#navGlow)" />

    <!-- Signal Path Fan-in Graphic (Converging to GigaSMART Hero Hub) -->
    <g stroke-linecap="round">
      <path d="M 40 100 Q 220 200 460 300" stroke="#3A5385" stroke-width="1.2" stroke-opacity="0.4" fill="none" />
      <path d="M 40 160 Q 220 230 460 300" stroke="#3A5385" stroke-width="1.2" stroke-opacity="0.4" fill="none" />
      <path d="M 40 220 Q 220 260 460 300" stroke="#3A5385" stroke-width="1.2" stroke-opacity="0.4" fill="none" />
      <path d="M 40 280 Q 220 290 460 300" stroke="#E1592A" stroke-width="2.5" stroke-opacity="0.95" fill="none" />
      <path d="M 40 340 Q 220 320 460 300" stroke="#3A5385" stroke-width="1.2" stroke-opacity="0.4" fill="none" />
      <path d="M 40 400 Q 220 350 460 300" stroke="#3A5385" stroke-width="1.2" stroke-opacity="0.4" fill="none" />

      <!-- Convergence Focus Node -->
      <circle cx="460" cy="300" r="5" fill="#E1592A" />
      <circle cx="460" cy="300" r="10" stroke="#E1592A" stroke-width="1" stroke-opacity="0.5" fill="none" />

      <!-- Fan-out to Monitoring Tools -->
      <path d="M 460 300 Q 505 300 550 260" stroke="#E1592A" stroke-width="2.0" stroke-opacity="0.9" fill="none" />
      <path d="M 460 300 Q 505 310 550 300" stroke="#3A5385" stroke-width="1.2" stroke-opacity="0.4" fill="none" />
      <path d="M 460 300 Q 505 320 550 340" stroke="#3A5385" stroke-width="1.2" stroke-opacity="0.4" fill="none" />
    </g>

    <!-- Bottom metadata divider hairline -->
    <line x1="40" y1="720" x2="555.28" y2="720" stroke="#2B3859" stroke-width="1" />
  </svg>`;
}

/**
 * Builds a compact SVG signal-path schematic for a single deployment site.
 * Shows the fan-in → process → fan-out shape:
 *   [N × TAPs] ──▶ [Aggregation] ──▶ [HC / GigaSMART] ──▶ [M × Tools]
 * Uses only Gigamon brand colours; no external assets required.
 */
function buildSiteSchematicSvg(
  tapUnitCount: number,
  tapLinkCount: number,
  tapFeedCount: number,
  aggCount: number,
  hcCount: number,
  toolCount: number,
  gigaSmartOps: number,
  siteName: string,
): string {
  const W = 515;
  const H = 80;
  const accent = '#E1592A';
  const navy = '#16213D';
  const muted = '#64748B';
  const lineC = '#94A3B8';

  // Node box positions (centre x)
  const x1 = 48;   // TAPs
  const x2 = 165;  // Aggregation
  const x3 = 295;  // HC / GigaSMART
  const x4 = 430;  // Tools
  const cy = 38;
  const bw = 84;
  const bh = 28;
  const r = 4;

  const box = (cx: number, fill: string, label: string, sub: string) => `
    <rect x="${cx - bw / 2}" y="${cy - bh / 2}" width="${bw}" height="${bh}" rx="${r}" fill="${fill}" />
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#fff">${label}</text>
    <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="rgba(255,255,255,0.7)">${sub}</text>`;

  const arrow = (x1a: number, x2a: number) => {
    const gx1 = x1a + bw / 2;
    const gx2 = x2a - bw / 2;
    const mx = (gx1 + gx2) / 2;
    return `<path d="M${gx1} ${cy} L${mx} ${cy} L${gx2} ${cy}" stroke="${lineC}" stroke-width="1.5" fill="none" marker-end="url(#arrowOrange)" />`;
  };

  const gsLabel = gigaSmartOps > 0 ? `${gigaSmartOps} Op${gigaSmartOps !== 1 ? 's' : ''}` : 'Aggregation';
  const tapSubLabel = tapFeedCount > tapLinkCount ? `${tapFeedCount} feeds (${tapLinkCount} links)` : `${tapFeedCount} feeds`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrowOrange" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="${lineC}" />
    </marker>
  </defs>

  <!-- Site label -->
  <text x="4" y="14" font-family="sans-serif" font-size="8" font-weight="bold" fill="${muted}" letter-spacing="0.5">${siteName.toUpperCase()} · SIGNAL PATH SCHEMATIC</text>

  ${box(x1, navy, `${tapUnitCount} TAP${tapUnitCount !== 1 ? 's' : ''}`, 'Optical Capture')}
  ${arrow(x1, x2)}
  ${box(x2, navy, `${aggCount} Aggr.`, 'Aggregation')}
  ${arrow(x2, x3)}
  ${box(x3, accent, `${hcCount} HC`, gsLabel)}
  ${arrow(x3, x4)}
  ${box(x4, navy, `${toolCount} Tool${toolCount !== 1 ? 's' : ''}`, 'Destinations')}

  <!-- Counts row -->
  <text x="${x1}" y="${cy + bh / 2 + 14}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="${muted}">${tapSubLabel}</text>
  <text x="${x2}" y="${cy + bh / 2 + 14}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="${muted}">${aggCount} unit${aggCount !== 1 ? 's' : ''}</text>
  <text x="${x3}" y="${cy + bh / 2 + 14}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="${accent}">${hcCount} engine${hcCount !== 1 ? 's' : ''}</text>
  <text x="${x4}" y="${cy + bh / 2 + 14}" text-anchor="middle" font-family="sans-serif" font-size="7" fill="${muted}">${toolCount} dest.</text>
</svg>`;
}

export function buildReportDocDefinition(input: ReportInput): TDocumentDefinitions {
  const {
    nodes,
    edges,
    trafficStreams,
    projectName,
    projectRegion,
    projectLicenseMode,
    defaultTermDuration,
    peakNodeRxMbps,
    diagramDataUrl,
    logoDataUrl,
    nodeMetrics,
    isRunning,
    chassisFrontPanelImages,
    siteDiagrams,
    execSummaryText,
  } = input;

  const liveMetrics = isRunning ? nodeMetrics : undefined;

  const stats = buildTopologyStats(nodes, edges, trafficStreams);
  const bomRows = generateBom(
    nodes,
    edges,
    projectLicenseMode,
    defaultTermDuration,
    projectRegion as 'US' | 'EU' | 'UK',
    true,
    peakNodeRxMbps,
  );
  const validationErrors = validateConfiguration(nodes, edges);
  const physicalItems = buildPhysicalItems(nodes, bomRows);
  const reportBomRows = buildProjectWideOpticBom(bomRows, getSkus()).sort(
    (a, b) => a.type.localeCompare(b.type) || a.sku.localeCompare(b.sku),
  );

  const generatedDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  // Gather unique physical sites
  const uniqueSites = Array.from(
    new Set(
      nodes
        .map((n) => resolveNodeSite(n, nodes, edges))
        .filter(Boolean),
    ),
  );
  const siteCountDisplay = uniqueSites.length > 0 ? uniqueSites.length : 1;
  const hardwareUnitCount = Object.values(stats.chassisCounts).reduce((a, b) => a + b, 0);
  const monitoredLinkText =
    stats.totalFeedCount > stats.monitoredLinkCount
      ? `${stats.monitoredLinkCount} Links (${stats.totalFeedCount} Feeds)`
      : `${stats.monitoredLinkCount} Feeds`;

  const content: Content[] = [];

  // ═══════════════════════════════════════════════════════════════
  // COVER PAGE (Full Bleed Dark Navy Panel + Vector Fan-in Graphic)
  // ═══════════════════════════════════════════════════════════════
  const coverStack: Content[] = [];
  if (logoDataUrl) {
    coverStack.push({ image: logoDataUrl, width: 140, margin: [0, 0, 0, 30] });
  } else {
    coverStack.push({ text: 'GIGAMON', fontSize: 16, bold: true, color: '#CBD5E1', characterSpacing: 1.5, margin: [0, 0, 0, 30] });
  }

  coverStack.push({ text: '§00 · VISIBILITY FABRIC SPECIFICATION', style: 'coverKicker' });
  coverStack.push({ text: projectName, style: 'coverTitle' });
  coverStack.push({ text: 'Next-Generation Network Visibility & Traffic Optimisation Report', style: 'coverSubtitle' });
  coverStack.push({
    text: `Generated ${generatedDate}  ·  Region: ${projectRegion}  ·  Licensing Model: ${projectLicenseMode} (${defaultTermDuration} Mo)`,
    style: 'coverMeta',
    margin: [0, 0, 0, 60],
  });

  // Hairline Teaser Stat Row on Cover
  coverStack.push({
    columns: [
      {
        stack: [
          { text: 'DEPLOYMENT SITES', style: 'coverStatLabel' },
          { text: `${siteCountDisplay} ${siteCountDisplay === 1 ? 'Site' : 'Sites'}`, style: 'coverStatValue' },
        ],
      },
      {
        stack: [
          { text: 'MONITORED LINKS', style: 'coverStatLabel' },
          { text: monitoredLinkText, style: 'coverStatValue' },
        ],
      },
      {
        stack: [
          { text: 'HARDWARE PLATFORMS', style: 'coverStatLabel' },
          { text: `${hardwareUnitCount} Units`, style: 'coverStatValue' },
        ],
      },
      {
        stack: [
          { text: 'TRAFFIC PROCESSED', style: 'coverStatLabel' },
          {
            text: isRunning && Object.values(nodeMetrics).length > 0
              ? formatBandwidth(Object.values(nodeMetrics).reduce((s, m) => s + (m.rxMbps || 0), 0))
              : 'Multi-Tbps Ready',
            style: 'coverStatValue',
          },
        ],
      },
    ],
    columnGap: 16,
    margin: [0, 10, 0, 0],
  });

  content.push({ stack: coverStack, margin: [0, 220, 0, 0] });
  content.push({ text: '', pageBreak: 'after' });

  // ═══════════════════════════════════════════════════════════════
  // TABLE OF CONTENTS
  // ═══════════════════════════════════════════════════════════════
  content.push({ text: '§00 · NAVIGATION', style: 'sectionKicker' });
  content.push({ text: 'Table of Contents', style: 'sectionHeading' });
  content.push({
    text: 'This specification report details the visibility pipeline architecture, active hardware platforms, transformation operations, and deployment logistics.',
    style: 'bodySecondary',
    margin: [0, 0, 0, 16],
  });

  const tocItems: { num: string; title: string; desc: string }[] = [
    { num: '§01', title: 'Executive Summary & Key Metrics', desc: 'Solution strategy, fabric inventory metrics, and platform summary.' },
    { num: '§02', title: 'Fabric Topology & Architecture Diagram', desc: 'Visual network diagram, multi-site signal flow, and connection topology.' },
    { num: '§03', title: 'Solution Overview & Component Narrative', desc: 'Detailed breakdown of traffic sources, maps, filters, GigaSMART engines, and tools.' },
    { num: '§04', title: 'Appendix A: Bill of Materials (BOM)', desc: 'Itemised SKUs, quantities, optic multipacks, and licence requirements.' },
  ];

  if (physicalItems.length > 0) {
    tocItems.push({
      num: '§05',
      title: 'Appendix B: Physical Rack & Deployment Specifications',
      desc: 'Rack space (RU), dimensions, power draw, heat dissipation, and rack elevation views.',
    });
  }

  content.push({
    table: {
      widths: [40, 180, '*'],
      dontBreakRows: true,
      body: tocItems.map((item) => [
        { text: item.num, style: 'mono', color: REPORT_COLOURS.accent },
        { text: item.title, style: 'body', bold: true },
        { text: item.desc, style: 'bodySecondary' },
      ]),
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => REPORT_COLOURS.line,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
    margin: [0, 0, 0, 24],
  });

  // ═══════════════════════════════════════════════════════════════
  // §01 EXECUTIVE SUMMARY & STAT TILES GRID
  // ═══════════════════════════════════════════════════════════════
  content.push({ text: '§01 · STRATEGY & METRICS', style: 'sectionKicker' });
  content.push({ text: 'Executive Summary', style: 'sectionHeading' });

  /** Helper to render executive summary markdown with automatic Scope Considerations notice plate conversion. */
  function renderExecSummaryContent(text: string): Content[] {
    const scopeRegex = /(?:^|\n)(?:#+\s*)?Scope\s+considerations?:?\s*\n((?:[ \t]*[-*•]\s*[^\n]+\n?)+)/i;
    const match = text.match(scopeRegex);
    if (!match) {
      return markdownToPdfmakeContent(text);
    }

    const fullBlock = match[0];
    const bulletsText = match[1];
    const bullets = bulletsText
      .split('\n')
      .map((line) => line.replace(/^[ \t]*[-*•]\s*/, '').trim())
      .filter(Boolean);

    const startIndex = match.index ?? 0;
    const beforeText = text.slice(0, startIndex).trim();
    const afterText = text.slice(startIndex + fullBlock.length).trim();

    const result: Content[] = [];
    if (beforeText) {
      result.push(...markdownToPdfmakeContent(beforeText));
    }

    result.push(
      buildNoticePlate({
        severity: 'warning',
        title: 'Scope Considerations & Key Assumptions',
        bullets,
      }),
    );

    if (afterText) {
      result.push(...markdownToPdfmakeContent(afterText));
    }

    return result;
  }

  if (execSummaryText) {
    content.push(...renderExecSummaryContent(execSummaryText));
  } else {
    content.push({
      text:
        'This report describes the Gigamon visibility pipeline configured for this project: the traffic sources feeding it, ' +
        'how traffic is filtered and processed, the tools and destinations receiving it, and the hardware required to deliver it.',
      style: 'body',
      margin: [0, 0, 0, 12],
    });
  }

  const totalGigaSmartOps = Object.values(stats.gigaSmartActionCounts).reduce((a, b) => a + b, 0);

  // Hairline Stat Tile Grid (2 rows x 4 columns)
  content.push({
    table: {
      widths: ['25%', '25%', '25%', '25%'],
      dontBreakRows: true,
      body: [
        [
          buildStatTile({
            label: 'Ingress Feeds',
            value: stats.totalFeedCount,
            zeroCaption: 'no ingress feeds mapped',
          }),
          buildStatTile({
            label: 'Monitored Links',
            value: stats.monitoredLinkCount,
            zeroCaption: 'no monitored links',
          }),
          buildStatTile({
            label: 'Optical TAPs',
            value: stats.tapUnitCount,
            zeroCaption: 'SPAN / virtual feeds only',
          }),
          buildStatTile({
            label: 'SPAN Sessions',
            value: stats.inputCounts.span,
            zeroCaption: 'pure optical TAP design',
          }),
        ],
        [
          buildStatTile({
            label: 'GigaSMART Ops',
            value: totalGigaSmartOps,
            zeroCaption: 'not required · pure aggregation',
          }),
          buildStatTile({
            label: 'Destinations',
            value: stats.toolCount,
            zeroCaption: 'pipeline stage only',
          }),
          buildStatTile({
            label: 'Chassis / Units',
            value: hardwareUnitCount,
            zeroCaption: 'virtual deployment',
          }),
          buildStatTile({
            label: 'Traffic Streams',
            value: stats.trafficStreamCount,
            zeroCaption: 'static architecture',
          }),
        ],
      ],
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => REPORT_COLOURS.line,
      vLineColor: () => REPORT_COLOURS.line,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 4, 0, 14],
    unbreakable: true,
  });

  if (Object.keys(stats.chassisCounts).length > 0) {
    content.push({
      text: 'Active Hardware Platform Summary',
      style: 'subHeading',
      margin: [0, 6, 0, 4],
    });
    content.push({
      ul: Object.entries(stats.chassisCounts).map(([model, count]) => `${model} × ${count}`),
      style: 'body',
      margin: [0, 0, 0, 10],
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // §02 TOPOLOGY DIAGRAM
  // ═══════════════════════════════════════════════════════════════
  content.push({ text: '§02 · NETWORK VISIBILITY FABRIC', style: 'sectionKicker', pageBreak: 'before' });
  content.push({ text: 'Topology Diagram', style: 'sectionHeading' });

  const hasMultipleSites = !!(siteDiagrams && Object.keys(siteDiagrams).length > 1);

  if (hasMultipleSites) {
    content.push({
      text: 'End-to-End Multi-Site Architecture Overview',
      style: 'subHeading',
      margin: [0, 0, 0, 6],
    });
  }

  content.push({
    text: 'High-level signal flow across network tap points, aggregation switches, transformation engines, and monitoring tools.',
    style: 'bodySecondary',
    margin: [0, 0, 0, 8],
  });

  content.push({ image: diagramDataUrl, width: 515, margin: [0, 0, 0, 12] });

  // Helper to calculate schematic metrics for any site subset
  const getSiteSchematicMetrics = (_siteName: string, siteNodes: CustomNode[]) => {
    const siteTapNodes = siteNodes.filter(
      (n) =>
        (n.type === NODE_TYPES.INPUT && String(n.data?.configType || '').toUpperCase().includes('TAP')) ||
        (n.type === NODE_TYPES.HARDWARE && String(n.data?.model || '').toUpperCase().includes('TAP') && !isAutoTrayModel(String(n.data?.model || ''))),
    );
    const siteTapUnitCount = siteTapNodes.length;
    const siteTapLinkCount = siteTapNodes.reduce((sum, n) => sum + getTapNodeLinks(n), 0);
    const siteTapFeedCount = siteTapLinkCount * 2;

    const siteSpanNodes = siteNodes.filter(
      (n) => n.type === NODE_TYPES.INPUT && !String(n.data?.configType || '').toUpperCase().includes('TAP'),
    );
    const siteSpanCount = siteSpanNodes.length;
    const siteTotalFeedCount = siteTapFeedCount + siteSpanCount;
    const siteTotalLinkCount = siteTapLinkCount + siteSpanCount;

    const siteAggCount = siteNodes.filter(
      (n) =>
        n.type === NODE_TYPES.HARDWARE &&
        !isAutoTrayModel(String(n.data?.model || '')) &&
        !String(n.data?.model || '').toUpperCase().includes('TAP') &&
        !String(n.data?.model || '').toUpperCase().includes('HC') &&
        !String(n.data?.model || '').toUpperCase().includes('HCT'),
    ).length;

    const siteHcCount = siteNodes.filter(
      (n) =>
        n.type === NODE_TYPES.HARDWARE &&
        (String(n.data?.model || '').toUpperCase().includes('HC') || String(n.data?.model || '').toUpperCase().includes('HCT')) &&
        !isAutoTrayModel(String(n.data?.model || '')),
    ).length;

    const siteToolCount = siteNodes.filter((n) => n.type === NODE_TYPES.TOOL).length;
    const siteGsOps = siteNodes.filter((n) => n.type === NODE_TYPES.GIGASMART).length;

    return {
      tapUnitCount: siteTapUnitCount || stats.tapUnitCount,
      totalLinkCount: siteTotalLinkCount || stats.monitoredLinkCount,
      totalFeedCount: siteTotalFeedCount || stats.totalFeedCount,
      aggCount: siteAggCount,
      hcCount: siteHcCount,
      toolCount: siteToolCount || stats.toolCount,
      gsOps: siteGsOps,
    };
  };

  if (hasMultipleSites) {
    const siteEntries = Object.entries(siteDiagrams!);
    const siteMetricsList = siteEntries.map(([siteName]) => {
      const siteNodes = nodes.filter((n) => (n.data?.site as string || '').trim() === siteName.trim());
      return {
        siteName,
        metrics: getSiteSchematicMetrics(siteName, siteNodes),
      };
    });

    // Check if all sites have identical metrics/structure
    const firstMetrics = siteMetricsList[0].metrics;
    const allSitesIdentical =
      siteMetricsList.length > 1 &&
      siteMetricsList.every(
        (entry) =>
          entry.metrics.tapUnitCount === firstMetrics.tapUnitCount &&
          entry.metrics.totalLinkCount === firstMetrics.totalLinkCount &&
          entry.metrics.totalFeedCount === firstMetrics.totalFeedCount &&
          entry.metrics.aggCount === firstMetrics.aggCount &&
          entry.metrics.hcCount === firstMetrics.hcCount &&
          entry.metrics.toolCount === firstMetrics.toolCount &&
          entry.metrics.gsOps === firstMetrics.gsOps,
      );

    if (allSitesIdentical) {
      // Single representative schematic under the overview diagram
      const siteNamesJoined = siteMetricsList.map((s) => s.siteName).join(' · ');
      content.push({
        svg: buildSiteSchematicSvg(
          firstMetrics.tapUnitCount,
          firstMetrics.totalLinkCount,
          firstMetrics.totalFeedCount,
          firstMetrics.aggCount,
          firstMetrics.hcCount,
          firstMetrics.toolCount,
          firstMetrics.gsOps,
          `REPRESENTATIVE SITE ARCHITECTURE (${siteNamesJoined})`,
        ),
        width: 515,
        margin: [0, 0, 0, 14],
      });
    }

    siteEntries.forEach(([siteName, siteDiagramUrl], index) => {
      content.push({
        text: `Site Architecture Breakdown — ${siteName}`,
        style: 'subHeading',
        margin: [0, 14, 0, 4],
      } as Content);
      content.push({
        text: `Focused topology diagram for ${siteName}, illustrating local TAP allocations, aggregation chassis ports, and tool feeds.`,
        style: 'bodySecondary',
        margin: [0, 0, 0, 6],
      } as Content);
      content.push({
        image: siteDiagramUrl,
        width: 515,
        margin: [0, 0, 0, 6],
      } as Content);

      // Only push per-site schematics if the sites actually differ in architecture
      if (!allSitesIdentical) {
        const m = siteMetricsList[index].metrics;
        content.push({
          svg: buildSiteSchematicSvg(
            m.tapUnitCount,
            m.totalLinkCount,
            m.totalFeedCount,
            m.aggCount,
            m.hcCount,
            m.toolCount,
            m.gsOps,
            siteName,
          ),
          width: 515,
          margin: [0, 0, 0, 14],
        });
      }
    });
  } else {
    // Single site deployment: single schematic below the main diagram
    const singleSiteName = uniqueSites[0] || 'FABRIC';
    const singleSiteNodes = nodes.filter((n) => (n.data?.site as string || '').trim() === singleSiteName.trim());
    const m = getSiteSchematicMetrics(singleSiteName, singleSiteNodes.length > 0 ? singleSiteNodes : nodes);

    content.push({
      svg: buildSiteSchematicSvg(
        m.tapUnitCount,
        m.totalLinkCount,
        m.totalFeedCount,
        m.aggCount,
        m.hcCount,
        m.toolCount,
        m.gsOps,
        singleSiteName,
      ),
      width: 515,
      margin: [0, 0, 0, 14],
    });
  }

  // Configuration Attention Notice Plate (if validation errors exist)
  if (validationErrors.length > 0) {
    content.push(
      buildNoticePlate({
        severity: 'warning',
        title: 'Configuration Scope Considerations & Unresolved Items',
        message: 'The current configuration contains items requiring verification. The Bill of Materials in this report may require adjustment before final procurement:',
        bullets: validationErrors.map((e) => e.message),
      }),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // §03 FABRIC NARRATIVE & COMPONENT BREAKDOWN
  // ═══════════════════════════════════════════════════════════════
  content.push({ text: '§03 · COMPONENT SPECIFICATIONS', style: 'sectionKicker', pageBreak: 'before' });
  content.push({ text: 'Solution Overview & Workflow Specifications', style: 'sectionHeading' });

  const inputNodes = nodes.filter((n) => n.type === NODE_TYPES.INPUT);
  if (inputNodes.length > 0) {
    content.push({ text: 'Traffic Sources', style: 'subHeading' });
    inputNodes.forEach((n) => {
      const data = n.data as InputNodeData;
      const detail = describeInputNodeDetail(n, nodes, edges, trafficStreams, liveMetrics);
      content.push(detailStack(detail.headline, detail, getNodeValueProposition(NODE_TYPES.INPUT, data.configType)));
    });
  }

  const mapNodes = nodes.filter((n) => n.type === NODE_TYPES.MAP);
  if (mapNodes.length > 0) {
    content.push({ text: 'Traffic Maps', style: 'subHeading' });
    mapNodes.forEach((n) => {
      const detail = describeProcessingNodeDetail(n, nodes, edges, liveMetrics);
      content.push(detailStack(n.data.label || n.id, detail));
    });
  }

  const filterNodes = nodes.filter((n) => n.type === NODE_TYPES.FILTER);
  if (filterNodes.length > 0) {
    content.push({ text: 'Filters', style: 'subHeading' });
    filterNodes.forEach((n) => {
      const detail = describeProcessingNodeDetail(n, nodes, edges, liveMetrics);
      content.push(detailStack(n.data.label || n.id, detail));
    });
  }

  const gigaStreamNodes = nodes.filter((n) => n.type === NODE_TYPES.GIGASTREAM);
  
  // Gather and consolidate all GigaSMART functions (standalone nodes, hosted apps, GTP modes)
  interface GigaSmartEntry {
    actionType: string;
    label?: string;
    appData?: GigaSmartNodeData;
    hostNode: CustomNode;
    hostLabel: string;
    site?: string;
    isStandaloneNode?: boolean;
  }

  const gigaSmartEntries: GigaSmartEntry[] = [];

  nodes.filter((n) => n.type === NODE_TYPES.GIGASMART).forEach((n) => {
    const data = n.data as GigaSmartNodeData;
    const actionType = data.actionType || ACTION_TYPES.DEDUPLICATION;
    const site = resolveNodeSite(n, nodes, edges);
    const sitePrefix = site ? `${site} · ` : '';
    const hostLabel = `${sitePrefix}${data.label || n.id}`;
    gigaSmartEntries.push({
      actionType,
      label: data.label,
      appData: data,
      hostNode: n,
      hostLabel,
      site,
      isStandaloneNode: true,
    });
  });

  nodes.forEach((n) => {
    const rawApps = (n.data as Record<string, unknown>)?.gigaSmartApps;
    const site = resolveNodeSite(n, nodes, edges);
    const nodeLabel = String(n.data?.label || (n.data as HardwareNodeData)?.model || n.id);
    const hostLabel = site ? `${site} · ${nodeLabel}` : nodeLabel;

    if (Array.isArray(rawApps)) {
      rawApps.forEach((app: GigaSmartNodeData) => {
        const actionType = app.actionType || ACTION_TYPES.DEDUPLICATION;
        gigaSmartEntries.push({
          actionType,
          label: app.label,
          appData: app,
          hostNode: n,
          hostLabel,
          site,
          isStandaloneNode: false,
        });
      });
    }

    const hwData = n.data as HardwareNodeData;
    if (hwData?.gtpCorrelationMode && hwData.gtpCorrelationMode !== 'none') {
      const alreadyHasGtp = Array.isArray(rawApps) && rawApps.some((a) => a.actionType?.toLowerCase().includes('gtp'));
      if (!alreadyHasGtp) {
        gigaSmartEntries.push({
          actionType: 'GTP Correlation',
          label: 'GTP Correlation',
          appData: { actionType: 'GTP Correlation' } as GigaSmartNodeData,
          hostNode: n,
          hostLabel,
          site,
          isStandaloneNode: false,
        });
      }
    }
  });

  if (gigaSmartEntries.length > 0) {
    content.push({ text: 'GigaSMART Processing', style: 'subHeading' });

    const gigaSmartGroups = new Map<string, GigaSmartEntry[]>();
    gigaSmartEntries.forEach((entry) => {
      const key = entry.actionType;
      if (!gigaSmartGroups.has(key)) gigaSmartGroups.set(key, []);
      gigaSmartGroups.get(key)!.push(entry);
    });

    gigaSmartGroups.forEach((group, actionType) => {
      if (group.length === 1) {
        const entry = group[0];
        if (entry.isStandaloneNode) {
          const detail = describeProcessingNodeDetail(entry.hostNode, nodes, edges, liveMetrics);
          const headline = entry.label || entry.actionType;
          content.push(
            detailStack(headline, detail, getNodeValueProposition(NODE_TYPES.GIGASMART, undefined, entry.actionType)),
          );
        } else {
          const detail = describeHostedGigaSmartAppDetail(
            entry.appData || ({ actionType: entry.actionType } as GigaSmartNodeData),
            entry.hostLabel,
          );
          content.push(
            detailStack(detail.headline, detail, getNodeValueProposition(NODE_TYPES.GIGASMART, undefined, entry.actionType)),
          );
        }
      } else {
        const siteCounts = new Map<string, number>();
        group.forEach((e) => {
          if (e.site) siteCounts.set(e.site, (siteCounts.get(e.site) || 0) + 1);
        });

        let headline: string;
        if (siteCounts.size > 1) {
          const siteBreakdown = Array.from(siteCounts.entries())
            .map(([site, count]) => `${count} at ${site}`)
            .join(', ');
          headline = `${actionType} (${group.length} instances deployed across ${siteCounts.size} sites: ${siteBreakdown})`;
        } else if (siteCounts.size === 1) {
          const [singleSite, count] = Array.from(siteCounts.entries())[0];
          const siteClause = count === group.length ? ` at ${singleSite}` : ` (${count} at ${singleSite})`;
          headline = `${actionType} (${group.length} instances deployed${siteClause})`;
        } else {
          headline = `${actionType} (${group.length} instances deployed)`;
        }

        const sampleApp = group[0].appData || ({ actionType } as GigaSmartNodeData);
        const uniqueHosts = Array.from(new Set(group.map((e) => e.hostLabel))).join(', ');
        const bullets: string[] = [
          describeGigaSmartAction(sampleApp),
          describeGigaSmartFunction(actionType),
          `Running on: ${uniqueHosts}`,
        ];

        content.push(
          detailStack(
            headline,
            { headline, bullets },
            getNodeValueProposition(NODE_TYPES.GIGASMART, undefined, actionType),
          ),
        );
      }
    });
  }

  if (gigaStreamNodes.length > 0) {
    gigaStreamNodes.forEach((n) => {
      const detail = describeProcessingNodeDetail(n, nodes, edges, liveMetrics);
      content.push(detailStack(n.data.label || n.id, detail));
    });
  }

  const toolNodes = nodes.filter((n) => n.type === NODE_TYPES.TOOL);
  if (toolNodes.length > 0) {
    content.push({ text: 'Destinations & Tools', style: 'subHeading' });
    
    // Vendor Verification Advisory Notice Plate (Info severity)
    content.push(
      buildNoticePlate({
        severity: 'info',
        title: 'Important Notice: Tool Ingest Capacities & Vendor Verification',
        message:
          'All tool, sensor, and probe ingest capacities stated in this report (e.g. 5 Gbps, 10 Gbps, 40 Gbps, 50 Gbps) are simulation baseline assumptions and estimates only. ' +
          'Actual maximum real-time traffic processing limits depend upon physical appliance sizing, allocated CPU/memory resources, software licence tiers, packet size distribution, and enabled inspection features. ' +
          'While the Gigamon visibility fabric can scale and deliver hundreds of gigabits per second of high-speed aggregated traffic, customers must consult the respective tool, probe, or sensor manufacturer directly to confirm the maximum sustained and burst ingest rates for their specific environment and model.',
      }),
    );

    // Group identical tool nodes by toolName / configType
    const toolGroups = new Map<string, CustomNode[]>();
    toolNodes.forEach((n) => {
      const data = n.data as ToolNodeData;
      const key = `${data.toolName || data.configType || 'Tool'}|${data.ingestLimitMbps || ''}`;
      if (!toolGroups.has(key)) toolGroups.set(key, []);
      toolGroups.get(key)!.push(n);
    });

    toolGroups.forEach((group) => {
      if (group.length === 1) {
        const n = group[0];
        const detail = describeToolNodeDetail(n, nodes, edges, liveMetrics);
        content.push(detailStack(detail.headline, detail));
      } else {
        const first = group[0];
        const data = first.data as ToolNodeData;
        const toolName = data.toolName || data.label || 'Custom Tool';

        // Clean per-site breakdown or unique labels
        const siteCounts = new Map<string, number>();
        group.forEach((n) => {
          const s = resolveNodeSite(n, nodes, edges);
          if (s) siteCounts.set(s, (siteCounts.get(s) || 0) + 1);
        });

        let headline: string;
        if (siteCounts.size > 1) {
          const siteBreakdown = Array.from(siteCounts.entries())
            .map(([site, count]) => `${count} at ${site}`)
            .join(', ');
          headline = `${toolName} (${group.length} instances deployed across ${siteCounts.size} sites: ${siteBreakdown})`;
        } else if (siteCounts.size === 1) {
          const [singleSite, count] = Array.from(siteCounts.entries())[0];
          const siteClause = count === group.length ? ` at ${singleSite}` : ` (${count} at ${singleSite})`;
          headline = `${toolName} (${group.length} instances deployed${siteClause})`;
        } else {
          headline = `${toolName} (${group.length} instances deployed)`;
        }

        const bullets: string[] = [
          describeToolPurpose(data.toolName),
          describeToolOverloadRisk(data.toolName, data.ingestLimitMbps),
        ];

        // Gather and group all origins across the instances cleanly
        const originCountMap = new Map<string, number>();
        group.forEach((gn) => {
          const origins = traceToTerminalInputs(gn.id, nodes, edges);
          origins.forEach((o) => {
            const odata = o.data as Record<string, unknown>;
            const omodel = String(odata.model || odata.configType || odata.label || 'Traffic Source');
            const originSite = resolveNodeSite(o, nodes, edges);
            const site = originSite ? ` (${originSite})` : '';
            const key = `${omodel}${site}`;
            originCountMap.set(key, (originCountMap.get(key) || 0) + 1);
          });
        });

        if (originCountMap.size > 0) {
          const originSummary = Array.from(originCountMap.entries())
            .map(([name, count]) => (count > 1 ? `${count} × ${name}` : name))
            .join(', ');
          bullets.push(`Traffic originates from: ${originSummary}`);
        }

        // Gather aggregate live metrics if running
        if (liveMetrics) {
          const totalRx = group.reduce((sum, gn) => sum + (liveMetrics[gn.id]?.rxMbps || 0), 0);
          if (totalRx > 0) {
            bullets.push(`Total aggregate traffic receiving: ${formatBandwidth(totalRx)} across ${group.length} instances`);
          }
        }

        content.push(detailStack(headline, { headline, bullets }));
      }
    });
  }

  const hardwareNodes = nodes.filter((n) => n.type === NODE_TYPES.HARDWARE);
  if (hardwareNodes.length > 0) {
    content.push({ text: 'Hardware Platforms & Physical Inventory', style: 'subHeading' });
    const plainLines: string[] = [];

    // 1. Group & Deduplicate Optical TAP Modules
    const tapModules = hardwareNodes.filter(
      (n) => !isAutoTrayModel(String(n.data?.model || '')) && String(n.data?.model || '').toUpperCase().includes('TAP'),
    );
    const tapGroups = new Map<string, CustomNode[]>();
    tapModules.forEach((n) => {
      const data = n.data as HardwareNodeData;
      const model = String(data.model || '');
      const key = `${model}|${data.sku || ''}`;
      if (!tapGroups.has(key)) tapGroups.set(key, []);
      tapGroups.get(key)!.push(n);
    });

    tapGroups.forEach((group) => {
      const first = group[0];
      const data = first.data as HardwareNodeData;
      const model = String(data.model || '');
      const bullets = describeAggregatedTapPhysicalLink(group, nodes, edges);
      if (group.length === 1) {
        const headline = `${data.label} — ${model}${data.sku ? ` (${data.sku})` : ''}`;
        content.push(detailStack(headline, { headline, bullets }));
      } else {
        const headline = `${model}${data.sku ? ` (${data.sku})` : ''} (${group.length} modules deployed)`;
        content.push(detailStack(headline, { headline, bullets }));
      }
    });

    // 2. Group & Deduplicate Active Chassis (HC and TA units)
    const activeChassis = hardwareNodes.filter(
      (n) => !isAutoTrayModel(String(n.data?.model || '')) && !String(n.data?.model || '').toUpperCase().includes('TAP'),
    );
    const chassisGroups = new Map<string, CustomNode[]>();
    activeChassis.forEach((n) => {
      const data = n.data as HardwareNodeData;
      const model = String(data.model || '');
      const key = `${model}|${data.sku || ''}`;
      if (!chassisGroups.has(key)) chassisGroups.set(key, []);
      chassisGroups.get(key)!.push(n);
    });

    chassisGroups.forEach((group) => {
      const first = group[0];
      const data = first.data as HardwareNodeData;
      const model = String(data.model || '');
      const purpose = describeChassisPurpose(model);

      const labelsWithSites = group
        .map((n) => {
          const ndata = n.data as HardwareNodeData;
          const sitePrefix = ndata.site ? `${ndata.site} · ` : '';
          return `${sitePrefix}${ndata.label || ndata.model}`;
        })
        .join(', ');

      const headline =
        group.length === 1
          ? `${first.data?.site ? `${first.data.site} · ` : ''}${data.label} — ${data.model}${data.sku ? ` (${data.sku})` : ''}`
          : `${data.model}${data.sku ? ` (${data.sku})` : ''} (${group.length} units deployed: ${labelsWithSites})`;

      if (purpose) {
        content.push(detailStack(headline, { headline, bullets: [purpose] }));

        // Single representative front panel image for the chassis model group
        const representativeImage = group
          .map((cn) => chassisFrontPanelImages?.[cn.id])
          .find((img): img is string => Boolean(img));

        if (representativeImage) {
          content.push({
            image: representativeImage,
            width: 380,
            alignment: 'left',
            margin: [0, 2, 0, 10],
          });
        }
      } else {
        plainLines.push(headline);
      }
    });

    // 3. Consolidated TAP Mounting Trays (Mentioned once)
    const trays = hardwareNodes.filter((n) => isAutoTrayModel(String(n.data?.model || '')));
    if (trays.length > 0) {
      const traySummaryMap = new Map<string, { model: string; count: number; sites: Set<string>; desc: string }>();
      trays.forEach((t) => {
        const model = String(t.data?.model || '');
        const site = (t.data?.site as string || '').trim();
        if (!traySummaryMap.has(model)) {
          const desc = model.includes('M200')
            ? '1RU, 6-slot chassis tray'
            : model.includes('M100')
            ? '0.5RU, 3-slot chassis tray'
            : 'mounting tray';
          traySummaryMap.set(model, { model, count: 0, sites: new Set(), desc });
        }
        const item = traySummaryMap.get(model)!;
        item.count += 1;
        if (site) item.sites.add(site);
      });

      const trayBullets: string[] = [];
      const allSites = new Set<string>();
      traySummaryMap.forEach(({ model, count, sites, desc }) => {
        sites.forEach((s) => allSites.add(s));
        trayBullets.push(`${count} × ${model} (${desc})`);
      });

      const siteText =
        allSites.size > 1
          ? `deployed across all physical sites (${Array.from(allSites).join(', ')})`
          : allSites.size === 1
          ? `deployed at ${Array.from(allSites)[0]}`
          : 'deployed';

      content.push(
        detailStack('G-TAP Modular Mounting Trays', {
          headline: 'G-TAP Modular Mounting Trays',
          bullets: [
            `Passive rack-mount chassis trays ${siteText} to house optical TAP modules and breakout panels: ${trayBullets.join(', ')}.`,
          ],
        }),
      );
    }

    if (plainLines.length > 0) content.push({ ul: plainLines, style: 'body' });
  }

  // ═══════════════════════════════════════════════════════════════
  // §04 BILL OF MATERIALS APPENDIX
  // ═══════════════════════════════════════════════════════════════
  content.push({ text: '§04 · PROCUREMENT & LICENSING', style: 'sectionKicker', pageBreak: 'before' });
  content.push({ text: 'Appendix A: Bill of Materials', style: 'sectionHeading' });

  if (reportBomRows.length === 0) {
    content.push({ text: 'No hardware nodes tracked in the current layout.', style: 'muted' });
  } else {
    content.push({
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: ['auto', 'auto', '*', 'auto', 'auto'],
        body: [
          [
            { text: 'TYPE', style: 'tableHeader' },
            { text: 'SKU', style: 'tableHeader' },
            { text: 'DESCRIPTION', style: 'tableHeader' },
            { text: 'TERM (MO)', style: 'tableHeader', alignment: 'right' },
            { text: 'QTY', style: 'tableHeader', alignment: 'right' },
          ],
          ...reportBomRows.map((row, idx) => {
            const rowFill = idx % 2 === 1 ? REPORT_COLOURS.paper : '#FFFFFF';
            return [
              { text: row.type, style: 'tableCell', fillColor: rowFill },
              { text: row.sku, style: 'mono', fillColor: rowFill },
              row.note
                ? {
                    stack: [
                      { text: row.description, style: 'tableCell' },
                      { text: `💡 ${row.note}`, style: 'muted', margin: [0, 2, 0, 0] as [number, number, number, number] },
                    ],
                    fillColor: rowFill,
                  }
                : { text: row.description, style: 'tableCell', fillColor: rowFill },
              { text: row.term || '-', style: 'tableCell', alignment: 'right' as const, fillColor: rowFill },
              { text: String(row.qty), style: 'tableCell', bold: true, alignment: 'right' as const, fillColor: rowFill },
            ];
          }),
        ],
      },
      layout: {
        hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => REPORT_COLOURS.line,
        paddingTop: () => 6,
        paddingBottom: () => 6,
      },
      margin: [0, 0, 0, 10],
    });

    if (reportBomRows.some((row) => row.note)) {
      content.push({
        text: 'Rows marked 💡 include a small surplus of pre-fitted optics because a full multipack works out cheaper and simpler to order than buying the exact number of loose singles.',
        style: 'muted',
        margin: [0, 0, 0, 10],
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // §05 PHYSICAL RACK & DEPLOYMENT REPORT
  // ═══════════════════════════════════════════════════════════════
  function aggregatePhysicalItems(items: PhysicalItem[]): PhysicalItem[] {
    const map = new Map<string, PhysicalItem>();
    for (const item of items) {
      const existing = map.get(item.name);
      if (!existing) {
        map.set(item.name, { ...item, site: 'All Sites (Aggregated)' });
      } else {
        const newQty = existing.qty + item.qty;
        const newRuNum = existing.ruNum + item.ruNum;
        const newWeightNum = existing.weightNum + item.weightNum;
        const newPowerNum = existing.powerNum + item.powerNum;
        const newHeatNum = existing.heatNum + item.heatNum;

        map.set(item.name, {
          ...existing,
          qty: newQty,
          ruNum: newRuNum,
          ru: `${newRuNum.toFixed(1)} RU`,
          weightNum: newWeightNum,
          weight: `${newWeightNum.toFixed(1)} lbs (${(newWeightNum * 0.45359237).toFixed(1)} kg)`,
          powerNum: newPowerNum,
          power: `${newPowerNum} W`,
          heatNum: newHeatNum,
          heat: `${newHeatNum.toFixed(1)} BTU/hr`,
        });
      }
    }
    return Array.from(map.values());
  }

  function renderPhysicalTable(items: PhysicalItem[]): Content {
    const physicalTableHeader = [
      { text: 'HARDWARE / CHASSIS', style: 'tableHeader' },
      { text: 'QTY', style: 'tableHeader', alignment: 'center' as const },
      { text: 'RACK SPACE', style: 'tableHeader', alignment: 'center' as const },
      { text: 'DIMENSIONS (H × W × D)', style: 'tableHeader' },
      { text: 'WEIGHT', style: 'tableHeader', alignment: 'right' as const },
      { text: 'MAX POWER', style: 'tableHeader', alignment: 'right' as const },
      { text: 'HEAT OUTPUT', style: 'tableHeader', alignment: 'right' as const },
      { text: 'AIRFLOW', style: 'tableHeader', alignment: 'center' as const },
    ];

    return {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
        body: [
          physicalTableHeader,
          ...items.map((item, idx) => {
            const { inches, cm } = parseAndConvertDimensions(item.dimensions);
            const lbs = `${item.weightNum.toFixed(1)} lbs`;
            const kg = `${(item.weightNum * 0.45359237).toFixed(1)} kg`;
            const rowFill = idx % 2 === 1 ? REPORT_COLOURS.paper : '#FFFFFF';

            return [
              { text: item.name, style: 'tableCell', bold: true, fillColor: rowFill },
              { text: String(item.qty), style: 'tableCell', bold: true, alignment: 'center' as const, fillColor: rowFill },
              { text: item.ru, style: 'tableCell', alignment: 'center' as const, color: REPORT_COLOURS.structural, bold: true, fillColor: rowFill },
              {
                stack: [
                  { text: cm, style: 'tableCell', fontSize: 8 },
                  { text: `(${inches})`, style: 'muted', fontSize: 7 },
                ],
                fillColor: rowFill,
              },
              {
                stack: [
                  { text: `${kg}`, style: 'tableCell', alignment: 'right' as const, fontSize: 8 },
                  { text: `(${lbs})`, style: 'muted', fontSize: 7, alignment: 'right' as const },
                ],
                fillColor: rowFill,
              },
              { text: item.power, style: 'tableCell', alignment: 'right' as const, fillColor: rowFill },
              { text: item.heat, style: 'tableCell', alignment: 'right' as const, fillColor: rowFill },
              { text: item.airflow, style: 'tableCell', alignment: 'center' as const, fillColor: rowFill },
            ];
          }),
        ],
      },
      layout: {
        hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => REPORT_COLOURS.line,
        paddingTop: () => 5,
        paddingBottom: () => 5,
      },
      margin: [0, 0, 0, 10],
    };
  }

  if (physicalItems.length > 0) {
    content.push({ text: '§05 · DATACENTRE DEPLOYMENT', style: 'sectionKicker', pageBreak: 'before' });
    content.push({ text: 'Appendix B: Physical Rack & Deployment Report', style: 'sectionHeading' });
    content.push({
      text: 'Detailed physical and environmental specifications for the hardware deployment, including rack space (RU), physical dimensions (metric and imperial), estimated equipment weights, maximum electrical power draws, heat dissipation, and airflow requirements.',
      style: 'bodySecondary',
      margin: [0, 0, 0, 12],
    });

    const totalRU = physicalItems.reduce((a, i) => a + i.ruNum, 0);
    const totalWeight = physicalItems.reduce((a, i) => a + i.weightNum, 0);
    const totalPower = physicalItems.reduce((a, i) => a + i.powerNum, 0);
    const totalHeat = physicalItems.reduce((a, i) => a + i.heatNum, 0);

    // Stat tiles for physical metrics
    content.push({
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        dontBreakRows: true,
        body: [
          [
            buildStatTile({
              label: 'Total Space Required',
              value: `${totalRU.toFixed(1)} RU`,
            }),
            buildStatTile({
              label: 'Total Est. Weight',
              value: `${(totalWeight * 0.45359237).toFixed(1)} kg`,
            }),
            buildStatTile({
              label: 'Total Max Power',
              value: `${totalPower.toFixed(0)} W`,
            }),
            buildStatTile({
              label: 'Total Heat Output',
              value: `${totalHeat.toFixed(0)} BTU/hr`,
            }),
          ],
        ],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => REPORT_COLOURS.line,
        vLineColor: () => REPORT_COLOURS.line,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
      margin: [0, 0, 0, 15],
      unbreakable: true,
    });

    // Site groups
    const siteGroups: Record<string, PhysicalItem[]> = {};
    physicalItems.forEach((item) => {
      const siteKey = item.site || 'Global / Unassigned';
      if (!siteGroups[siteKey]) siteGroups[siteKey] = [];
      siteGroups[siteKey].push(item);
    });

    const siteKeys = Object.keys(siteGroups);

    if (siteKeys.length > 1) {
      content.push({ text: 'Site-by-Site Deployment Breakdown', style: 'subHeading', margin: [0, 5, 0, 8] });
      siteKeys.forEach((siteKey) => {
        const siteItems = siteGroups[siteKey];
        const siteRU = siteItems.reduce((a, i) => a + i.ruNum, 0);
        const sitePower = siteItems.reduce((a, i) => a + i.powerNum, 0);
        const siteHeat = siteItems.reduce((a, i) => a + i.heatNum, 0);

        content.push({
          text: `Site: ${siteKey}  ·  ${siteRU.toFixed(1)} RU · ${sitePower.toFixed(0)} W · ${siteHeat.toFixed(0)} BTU/hr`,
          style: 'body',
          bold: true,
          color: REPORT_COLOURS.structural,
          margin: [0, 6, 0, 4],
        });
        content.push(renderPhysicalTable(siteItems));

        const rackImage = input.siteRackImages?.[siteKey];
        if (rackImage) {
          content.push({
            image: rackImage,
            width: 420,
            alignment: 'center',
            margin: [0, 6, 0, 14],
          });
        }
      });

      content.push({ text: 'Master Aggregate Deployment (All Sites Combined)', style: 'subHeading', margin: [0, 15, 0, 8] });
      const aggregatedItems = aggregatePhysicalItems(physicalItems);
      content.push(renderPhysicalTable(aggregatedItems));
    } else {
      content.push({ text: 'Hardware Deployment Specifications', style: 'subHeading', margin: [0, 5, 0, 8] });
      content.push(renderPhysicalTable(physicalItems));

      const singleSiteKey = siteKeys[0] || 'Global / Unassigned';
      const rackImage = input.siteRackImages?.[singleSiteKey] || Object.values(input.siteRackImages || {})[0];
      if (rackImage) {
        content.push({
          image: rackImage,
          width: 420,
          alignment: 'center',
          margin: [0, 6, 0, 14],
        });
      }
    }

    content.push({
      text: `Total Deployment Footprint: ${totalRU.toFixed(1)} RU · ${(totalWeight * 0.45359237).toFixed(1)} kg (${totalWeight.toFixed(1)} lbs) · ${totalPower.toFixed(0)} W · ${totalHeat.toFixed(0)} BTU/hr`,
      style: 'body',
      bold: true,
      margin: [0, 8, 0, 0],
    });
  }

  return {
    pageSize: 'A4',
    pageMargins: REPORT_PAGE_MARGINS,
    defaultStyle: { font: 'Roboto' },
    styles: reportStyleDictionary,
    background: (currentPage) => {
      if (currentPage === 1) {
        return { svg: generateCoverSvg(), width: 595.28, height: 841.89 };
      }
      return {
        canvas: [
          {
            type: 'rect',
            x: 0,
            y: 0,
            w: 595.28,
            h: 841.89,
            color: REPORT_COLOURS.paper,
          },
        ],
      };
    },
    header: (currentPage) => {
      if (currentPage <= 2) return null; // No header on Cover or TOC
      return {
        columns: [
          { text: 'GIGAMON VISIBILITY FABRIC SPECIFICATION', fontSize: 7.5, bold: true, color: REPORT_COLOURS.inkMuted, characterSpacing: 0.8 },
          { text: projectName, alignment: 'right', fontSize: 7.5, color: REPORT_COLOURS.inkMuted },
        ],
        margin: [40, 18, 40, 0],
      };
    },
    footer: (currentPage, pageCount) => {
      if (currentPage === 1) return null; // No footer on Cover
      return {
        columns: [
          { text: 'CONFIDENTIAL & PROPRIETARY  ·  GIGAMON SOLUTION ARCHITECTURE', fontSize: 7.5, color: REPORT_COLOURS.inkMuted },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 8, bold: true, color: REPORT_COLOURS.structural },
        ],
        margin: [40, 0, 40, 18],
      };
    },
    info: { title: `${projectName} — Gigamon Visibility Solution Report` },
    content,
  };
}
