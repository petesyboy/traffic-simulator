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
import { NODE_TYPES } from '../../constants/nodeTypes';
import { getNodeValueProposition } from '../../constants/nodeValues';
import { generateBom, validateConfiguration } from '../../utils/bomEngine';
import { buildPhysicalItems } from '../bom/physicalItems';
import {
  buildTopologyStats,
  describeInputNodeDetail,
  describeProcessingNodeDetail,
  describeToolNodeDetail,
  describeHostedGigaSmartAppDetail,
  type NodeDetail,
} from './describeTopology';
import { describeTapPhysicalLink } from './describeTapLink';
import { describeChassisPurpose } from './chassisDescriptions';
import { isAutoTrayModel } from '../trayModels';
import { reportStyleDictionary, REPORT_COLOURS, REPORT_PAGE_MARGINS } from './reportStyles';

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
    advancedMode,
    diagramDataUrl,
    logoDataUrl,
    nodeMetrics,
    isRunning,
    chassisFrontPanelImages,
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
  const physicalItems = advancedMode ? buildPhysicalItems(nodes, bomRows) : [];

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
  content.push({
    text:
      'This report describes the Gigamon visibility pipeline configured for this project: the traffic sources feeding it, ' +
      'how traffic is filtered and processed, the tools and destinations receiving it, and the hardware required to deliver it.',
    style: 'body',
    margin: [0, 0, 0, 12],
  });
  content.push({
    columns: [
      statBlock('Traffic Sources', stats.inputCounts.total),
      statBlock('TAPs', stats.inputCounts.tap),
      statBlock('SPAN Sessions', stats.inputCounts.span),
      statBlock('Traffic Maps', stats.mapNodeCount),
      statBlock('Filters', stats.filterNodeCount),
    ],
    columnGap: 12,
    margin: [0, 0, 0, 10],
  });
  content.push({
    columns: [
      statBlock('GigaSMART Functions', Object.keys(stats.gigaSmartActionCounts).length),
      statBlock('Destinations / Tools', stats.toolCount),
      statBlock(
        'Chassis / Hardware Units',
        Object.values(stats.chassisCounts).reduce((a, b) => a + b, 0),
      ),
      statBlock('Traffic Streams', stats.trafficStreamCount),
    ],
    columnGap: 12,
    margin: [0, 0, 0, 4],
  });

  if (Object.keys(stats.chassisCounts).length > 0) {
    content.push({ text: 'Hardware Platforms', style: 'subHeading' });
    content.push({
      ul: Object.entries(stats.chassisCounts).map(([model, count]) => `${model} × ${count}`),
      style: 'body',
    });
  }

  // ── Topology diagram ──
  content.push({ text: 'Topology Diagram', style: 'sectionHeading', pageBreak: 'before' });
  content.push({ image: diagramDataUrl, width: 500, margin: [0, 0, 0, 10] });

  // ── Configuration warnings ──
  if (validationErrors.length > 0) {
    content.push({
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: '⚠ Configuration Attention Required', style: 'warningTitle' },
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

  const gigaSmartNodes = nodes.filter((n) => n.type === NODE_TYPES.GIGASMART);
  const gigaStreamNodes = nodes.filter((n) => n.type === NODE_TYPES.GIGASTREAM);
  // GigaSMART functions can also run as an app hosted directly on a chassis's
  // onboard engine (HC1/HC3 etc.) or a GSA tool appliance, rather than as
  // their own canvas node — gather those alongside the standalone nodes so
  // e.g. deduplication configured on an HC1 gets described too.
  const hostedGigaSmartApps: { app: GigaSmartNodeData; hostLabel: string }[] = [];
  nodes.forEach((n) => {
    if (n.type === NODE_TYPES.HARDWARE) {
      const hwData = n.data as HardwareNodeData;
      (hwData.gigaSmartApps || []).forEach((app) => hostedGigaSmartApps.push({ app, hostLabel: hwData.label }));
    } else if (n.type === NODE_TYPES.TOOL) {
      const toolData = n.data as ToolNodeData;
      (toolData.gigaSmartApps || []).forEach((app) => hostedGigaSmartApps.push({ app, hostLabel: toolData.label }));
    }
  });
  if (gigaSmartNodes.length > 0 || hostedGigaSmartApps.length > 0) {
    content.push({ text: 'GigaSMART Processing', style: 'subHeading' });
    gigaSmartNodes.forEach((n) => {
      const data = n.data as GigaSmartNodeData;
      const detail = describeProcessingNodeDetail(n, nodes, edges, liveMetrics);
      content.push(
        detailStack(
          `${data.label} — ${data.actionType}`,
          detail,
          getNodeValueProposition(NODE_TYPES.GIGASMART, undefined, data.actionType),
        ),
      );
    });
    hostedGigaSmartApps.forEach(({ app, hostLabel }) => {
      const detail = describeHostedGigaSmartAppDetail(app, hostLabel);
      content.push(
        detailStack(detail.headline, detail, getNodeValueProposition(NODE_TYPES.GIGASMART, undefined, app.actionType)),
      );
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
    toolNodes.forEach((n) => {
      const data = n.data as ToolNodeData;
      const detail = describeToolNodeDetail(n, nodes, edges, liveMetrics);
      content.push(
        detailStack(
          detail.headline,
          detail,
          getNodeValueProposition(NODE_TYPES.TOOL, data.expectedType, undefined, data.toolName),
        ),
      );
    });
  }

  const hardwareNodes = nodes.filter((n) => n.type === NODE_TYPES.HARDWARE);
  if (hardwareNodes.length > 0) {
    content.push({ text: 'Hardware', style: 'subHeading' });
    const plainLines: string[] = [];
    hardwareNodes.forEach((n) => {
      const data = n.data as HardwareNodeData;
      const model = String(data.model || '');
      const headline = `${data.label} — ${data.model}${data.sku ? ` (${data.sku})` : ''}`;

      if (isAutoTrayModel(model)) {
        // TAP-M100T/M200T/M202ULT are passive mounting trays, not fibre-terminating
        // appliances — they have no fibre type of their own, so they get the plain
        // one-liner rather than being run through the TAP physical-link detail.
        plainLines.push(headline);
        return;
      }

      if (model.toUpperCase().includes('TAP')) {
        const bullets = describeTapPhysicalLink(n, nodes, edges);
        content.push(detailStack(headline, { headline, bullets }));
        return;
      }

      const purpose = describeChassisPurpose(model);
      if (purpose) {
        content.push(detailStack(headline, { headline, bullets: [purpose] }));
        const frontPanelImage = chassisFrontPanelImages?.[n.id];
        if (frontPanelImage) {
          content.push({
            image: frontPanelImage,
            width: 380,
            margin: [0, -6, 0, 10],
          });
        }
      } else {
        plainLines.push(headline);
      }
    });
    if (plainLines.length > 0) content.push({ ul: plainLines, style: 'body' });
  }

  // ── BOM appendix ──
  content.push({ text: 'Appendix A: Bill of Materials', style: 'sectionHeading', pageBreak: 'before' });
  if (bomRows.length === 0) {
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
          ...bomRows.map((row) => [
            { text: row.type, style: 'tableCell' },
            { text: row.sku, style: 'mono' },
            { text: row.description, style: 'tableCell' },
            { text: row.term || '-', style: 'tableCell', alignment: 'right' as const },
            { text: String(row.qty), style: 'tableCell', alignment: 'right' as const },
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 10],
    });
  }

  // ── Physical appendix (Advanced Mode only) ──
  if (advancedMode && physicalItems.length > 0) {
    content.push({ text: 'Appendix B: Physical Rack & Deployment', style: 'sectionHeading', pageBreak: 'before' });
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto', 'auto'],
        body: [
          [
            { text: 'Hardware', style: 'tableHeader' },
            { text: 'Qty', style: 'tableHeader' },
            { text: 'RU', style: 'tableHeader' },
            { text: 'Power', style: 'tableHeader' },
            { text: 'Heat', style: 'tableHeader' },
          ],
          ...physicalItems.map((item) => [
            { text: item.name, style: 'tableCell' },
            { text: String(item.qty), style: 'tableCell', alignment: 'right' as const },
            { text: item.ru, style: 'tableCell', alignment: 'right' as const },
            { text: item.power, style: 'tableCell', alignment: 'right' as const },
            { text: item.heat, style: 'tableCell', alignment: 'right' as const },
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 10],
    });
    const totalRU = physicalItems.reduce((a, i) => a + i.ruNum, 0);
    const totalPower = physicalItems.reduce((a, i) => a + i.powerNum, 0);
    const totalHeat = physicalItems.reduce((a, i) => a + i.heatNum, 0);
    content.push({
      text: `Total: ${totalRU.toFixed(1)} RU · ${totalPower.toFixed(0)} W · ${totalHeat.toFixed(0)} BTU/hr`,
      style: 'body',
      bold: true,
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
