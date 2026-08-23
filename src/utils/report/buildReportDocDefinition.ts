/**
 * buildReportDocDefinition.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Assembles the pdfmake document-definition for a customer-facing solution
 * report: cover page, executive summary, topology diagram, plain-English
 * narrative per node category, a configuration-warnings callout, a Bill of
 * Materials appendix, and (Advanced Mode only) a physical/rack appendix.
 *
 * The BOM/physical figures are computed with the exact same calls the BOM
 * modal uses (generateBom / validateConfiguration / buildPhysicalItems) so the
 * report's numbers can never drift from what the BOM modal shows.
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
  /** Live per-node traffic metrics, only rendered when `isRunning` is true — never shown as if live when the simulation hasn't actually been run. */
  nodeMetrics: Record<string, NodeMetrics>;
  isRunning: boolean;
  /** Composited front-panel PNGs (base photo + installed-module faceplates), keyed by hardware node id. Only chassis with a calibrated catalogue photo have an entry. */
  chassisFrontPanelImages?: Record<string, string>;
  /** 42U Rack Elevation diagrams, keyed by physical site name. Embedded in Appendix B alongside physical specs. */
  siteRackImages?: Record<string, string>;
  /** Zoomed-in per-site architecture diagrams, keyed by site name, rendered when multi-site topologies are split for legibility. */
  siteDiagrams?: Record<string, string>;
  /** User-authored executive summary (what's being deployed and why, in the customer's context). Replaces the generic intro paragraph when provided. */
  execSummaryText?: string;
}

/** Renders a node's headline + detail bullets + (optional) value-proposition line, as one report entry. */
const detailStack = (headline: string, detail: NodeDetail, valueProposition?: string): Content => ({
  stack: [
    { text: headline, style: 'body', bold: true },
    ...(detail.bullets.length > 0 ? [{ ul: detail.bullets, style: 'muted' }] : []),
    ...(valueProposition
      ? [
          {
            text: valueProposition,
            style: 'muted',
            italics: true,
            margin: [0, 2, 0, 0] as [number, number, number, number],
          },
        ]
      : []),
  ],
  margin: [0, 0, 0, 10],
});

const statBlock = (label: string, value: string | number) => ({
  stack: [
    { text: label, style: 'statLabel' },
    { text: String(value), style: 'statValue' },
  ],
});

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
  // A customer-facing quote shows one aggregated line per SKU across the whole
  // project, rolled up into multipacks where that applies - not bomRows'
  // internal per-node breakdown (kept above only for physicalItems, which
  // needs it split by site for tray bin-packing).
  const reportBomRows = buildProjectWideOpticBom(bomRows, getSkus()).sort(
    (a, b) => a.type.localeCompare(b.type) || a.sku.localeCompare(b.sku),
  );

  const generatedDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  const content: Content[] = [];

  // ── Cover ──
  const coverStack: Content[] = [];
  if (logoDataUrl) {
    coverStack.push({ image: logoDataUrl, width: 160, margin: [0, 0, 0, 40] });
  }
  coverStack.push({ text: projectName, style: 'coverTitle' });
  coverStack.push({ text: 'Gigamon Visibility Solution Report', style: 'coverSubtitle' });
  coverStack.push({
    text: `Generated ${generatedDate} · Region: ${projectRegion} · Licensing: ${projectLicenseMode}`,
    style: 'coverSubtitle',
  });
  content.push({ stack: coverStack, margin: [0, 120, 0, 0] });
  content.push({ text: '', pageBreak: 'after' });

  // ── Executive summary ──
  content.push({ text: 'Executive Summary', style: 'sectionHeading' });
  if (execSummaryText) {
    content.push(...markdownToPdfmakeContent(execSummaryText));
  } else {
    content.push({
      text:
        'This report describes the Gigamon visibility pipeline configured for this project: the traffic sources feeding it, ' +
        'how traffic is filtered and processed, the tools and destinations receiving it, and the hardware required to deliver it.',
      style: 'body',
      margin: [0, 0, 0, 12],
    });
  }
  content.push({
    stack: [
      {
        columns: [
          statBlock('Traffic Sources', stats.inputCounts.total),
          statBlock('TAPs', stats.inputCounts.tap),
          statBlock('SPAN Sessions', stats.inputCounts.span),
          statBlock('Traffic Maps', stats.mapNodeCount),
          statBlock('Filters', stats.filterNodeCount),
        ],
        columnGap: 12,
        margin: [0, 0, 0, 8],
      },
      {
        columns: [
          statBlock(
            'GigaSMART Functions',
            Object.values(stats.gigaSmartActionCounts).reduce((a, b) => a + b, 0),
          ),
          statBlock('Destinations / Tools', stats.toolCount),
          statBlock(
            'Chassis / Hardware Units',
            Object.values(stats.chassisCounts).reduce((a, b) => a + b, 0),
          ),
          statBlock('Traffic Streams', stats.trafficStreamCount),
        ],
        columnGap: 12,
        margin: [0, 0, 0, 8],
      },
      ...(Object.keys(stats.chassisCounts).length > 0
        ? [
            { text: 'Hardware Platforms', style: 'subHeading', margin: [0, 6, 0, 4] as [number, number, number, number] },
            {
              ul: Object.entries(stats.chassisCounts).map(([model, count]) => `${model} × ${count}`),
              style: 'body',
            },
          ]
        : []),
    ],
    unbreakable: true,
    margin: [0, 4, 0, 0],
  });

  // ── Topology diagram ──
  content.push({ text: 'Topology Diagram', style: 'sectionHeading', pageBreak: 'before' });
  if (siteDiagrams && Object.keys(siteDiagrams).length > 1) {
    content.push({
      text: 'End-to-End Multi-Site Architecture Overview',
      style: 'subHeading',
      margin: [0, 0, 0, 6],
    });
  }
  content.push({ image: diagramDataUrl, width: 500, margin: [0, 0, 0, 10] });

  if (siteDiagrams && Object.keys(siteDiagrams).length > 1) {
    Object.entries(siteDiagrams).forEach(([siteName, siteDiagramUrl]) => {
      content.push({
        stack: [
          {
            text: `Site Architecture Breakdown — ${siteName}`,
            style: 'subHeading',
            margin: [0, 8, 0, 4],
          },
          {
            text: `High-resolution focused diagram for ${siteName}, ensuring legible port allocations, TAP feeds, and tool configurations.`,
            style: 'muted',
            margin: [0, 0, 0, 8],
          },
          {
            image: siteDiagramUrl,
            width: 500,
            margin: [0, 0, 0, 10],
          },
        ],
        unbreakable: true,
        margin: [0, 6, 0, 8],
      });
    });
  }

  // ── Configuration warnings ──
  if (validationErrors.length > 0) {
    content.push({
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: 'Configuration Attention Required', style: 'warningTitle' },
                {
                  text: 'The current configuration has unresolved items. The Bill of Materials in this report may be incomplete or invalid until these are addressed:',
                  style: 'body',
                  margin: [0, 4, 0, 6],
                },
                { ul: validationErrors.map((e) => e.message), style: 'body' },
              ],
            },
          ],
        ],
      },
      layout: {
        fillColor: () => REPORT_COLOURS.warningBg,
        hLineColor: () => REPORT_COLOURS.warningBorder,
        vLineColor: () => REPORT_COLOURS.warningBorder,
      },
      margin: [0, 10, 0, 10],
    });
  }

  // ── Narrative sections ──
  content.push({ text: 'Solution Overview', style: 'sectionHeading', pageBreak: 'before' });

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
    content.push({
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                {
                  text: 'Important Notice: Tool Ingest Capacities & Vendor Verification',
                  style: 'warningTitle',
                  fontSize: 9.5,
                  bold: true,
                  margin: [0, 0, 0, 3],
                },
                {
                  text:
                    'All tool, sensor, and probe ingest capacities stated in this report (e.g. 5 Gbps, 10 Gbps, 40 Gbps, 50 Gbps) are simulation baseline assumptions and estimates only. ' +
                    'Actual maximum real-time traffic processing limits depend upon physical appliance sizing, allocated CPU/memory resources, software licence tiers, packet size distribution, and enabled inspection features. ' +
                    'While the Gigamon visibility fabric can scale and deliver hundreds of gigabits per second of high-speed aggregated traffic, customers must consult the respective tool, probe, or sensor manufacturer directly to confirm the maximum sustained and burst ingest rates for their specific environment and model.',
                  style: 'body',
                  fontSize: 8.5,
                  lineHeight: 1.35,
                },
              ],
            },
          ],
        ],
      },
      layout: {
        fillColor: () => REPORT_COLOURS.warningBg,
        hLineColor: () => REPORT_COLOURS.warningBorder,
        vLineColor: () => REPORT_COLOURS.warningBorder,
      },
      margin: [0, 4, 0, 10],
    });

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
    content.push({ text: 'Hardware', style: 'subHeading' });
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
        group.forEach((cn) => {
          const frontPanelImage = chassisFrontPanelImages?.[cn.id];
          if (frontPanelImage) {
            const cdata = cn.data as HardwareNodeData;
            const sitePrefix = cdata.site ? `${cdata.site} · ` : '';
            const unitLabel = `${sitePrefix}${cdata.label || cdata.model}${cdata.sku ? ` (${cdata.sku})` : ''}`;
            content.push({
              text: unitLabel,
              style: 'body',
              bold: true,
              color: REPORT_COLOURS.navy,
              margin: [0, 6, 0, 2],
            });
            content.push({
              image: frontPanelImage,
              width: 380,
              margin: [0, 0, 0, 10],
            });
          }
        });
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

  // ── BOM appendix ──
  content.push({ text: 'Appendix A: Bill of Materials', style: 'sectionHeading', pageBreak: 'before' });
  if (reportBomRows.length === 0) {
    content.push({ text: 'No hardware nodes tracked in the current layout.', style: 'muted' });
  } else {
    content.push({
      table: {
        headerRows: 1,
        widths: ['auto', 'auto', '*', 'auto', 'auto'],
        body: [
          [
            { text: 'Type', style: 'tableHeader' },
            { text: 'SKU', style: 'tableHeader' },
            { text: 'Description', style: 'tableHeader' },
            { text: 'Term (Mo)', style: 'tableHeader' },
            { text: 'Qty', style: 'tableHeader' },
          ],
          ...reportBomRows.map((row) => [
            { text: row.type, style: 'tableCell' },
            { text: row.sku, style: 'mono' },
            row.note
              ? {
                  stack: [
                    { text: row.description, style: 'tableCell' },
                    { text: `💡 ${row.note}`, style: 'muted', margin: [0, 2, 0, 0] as [number, number, number, number] },
                  ],
                }
              : { text: row.description, style: 'tableCell' },
            { text: row.term || '-', style: 'tableCell', alignment: 'right' as const },
            { text: String(row.qty), style: 'tableCell', alignment: 'right' as const },
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
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

// Helper to aggregate physical items by name across all sites
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

// Helper to render physical spec table
function renderPhysicalTable(items: PhysicalItem[]): Content {
  const physicalTableHeader = [
    { text: 'Hardware Node / Chassis', style: 'tableHeader' },
    { text: 'Qty', style: 'tableHeader', alignment: 'center' as const },
    { text: 'Rack Space', style: 'tableHeader', alignment: 'center' as const },
    { text: 'Dimensions (H × W × D)', style: 'tableHeader' },
    { text: 'Weight', style: 'tableHeader', alignment: 'right' as const },
    { text: 'Max Power', style: 'tableHeader', alignment: 'right' as const },
    { text: 'Heat Output', style: 'tableHeader', alignment: 'right' as const },
    { text: 'Airflow', style: 'tableHeader', alignment: 'center' as const },
  ];

  return {
    table: {
      headerRows: 1,
      widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
      body: [
        physicalTableHeader,
        ...items.map((item) => {
          const { inches, cm } = parseAndConvertDimensions(item.dimensions);
          const lbs = `${item.weightNum.toFixed(1)} lbs`;
          const kg = `${(item.weightNum * 0.45359237).toFixed(1)} kg`;

          return [
            { text: item.name, style: 'tableCell', bold: true },
            { text: String(item.qty), style: 'tableCell', alignment: 'center' as const },
            { text: item.ru, style: 'tableCell', alignment: 'center' as const, color: REPORT_COLOURS.navy, bold: true },
            {
              stack: [
                { text: cm, style: 'tableCell', fontSize: 8 },
                { text: `(${inches})`, style: 'muted', fontSize: 7 },
              ],
            },
            {
              stack: [
                { text: `${kg}`, style: 'tableCell', alignment: 'right' as const, fontSize: 8 },
                { text: `(${lbs})`, style: 'muted', fontSize: 7, alignment: 'right' as const },
              ],
            },
            { text: item.power, style: 'tableCell', alignment: 'right' as const },
            { text: item.heat, style: 'tableCell', alignment: 'right' as const },
            { text: item.airflow, style: 'tableCell', alignment: 'center' as const },
          ];
        }),
      ],
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 10],
  };
}

  // ── Physical appendix ──
  if (physicalItems.length > 0) {
    content.push({ text: 'Appendix B: Physical Rack & Deployment Report', style: 'sectionHeading', pageBreak: 'before' });
    content.push({
      text: 'Detailed physical and environmental specifications for the hardware deployment, including rack space (RU), physical dimensions (metric and imperial), estimated equipment weights, maximum electrical power draws, heat dissipation, and airflow requirements.',
      style: 'body',
      margin: [0, 0, 0, 12],
    });

    const totalRU = physicalItems.reduce((a, i) => a + i.ruNum, 0);
    const totalWeight = physicalItems.reduce((a, i) => a + i.weightNum, 0);
    const totalPower = physicalItems.reduce((a, i) => a + i.powerNum, 0);
    const totalHeat = physicalItems.reduce((a, i) => a + i.heatNum, 0);

    content.push({
      columns: [
        statBlock('Total Space Required', `${totalRU.toFixed(1)} RU`),
        statBlock('Total Est. Weight', `${(totalWeight * 0.45359237).toFixed(1)} kg`),
        statBlock('Total Max Power', `${totalPower.toFixed(0)} W`),
        statBlock('Total Heat Output', `${totalHeat.toFixed(0)} BTU/hr`),
      ],
      columnGap: 12,
      margin: [0, 0, 0, 15],
    });

    // Site groups (for side-by-side site breakdown)
    const siteGroups: Record<string, PhysicalItem[]> = {};
    physicalItems.forEach((item) => {
      const siteKey = item.site || 'Global / Unassigned';
      if (!siteGroups[siteKey]) siteGroups[siteKey] = [];
      siteGroups[siteKey].push(item);
    });

    const siteKeys = Object.keys(siteGroups);

    // If multiple sites are configured, show the per-site breakdown first
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
          color: REPORT_COLOURS.navy,
          margin: [0, 6, 0, 4],
        });
        content.push(renderPhysicalTable(siteItems));

        const rackImage = input.siteRackImages?.[siteKey];
        if (rackImage) {
          content.push({
            image: rackImage,
            width: 150,
            alignment: 'center',
            margin: [0, 4, 0, 12],
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
          width: 160,
          alignment: 'center',
          margin: [0, 6, 0, 12],
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
    info: { title: `${projectName} — Gigamon Visibility Solution Report` },
    content,
  };
}
