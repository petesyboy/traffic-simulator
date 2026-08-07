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
  MapNodeData,
  FilterNodeData,
  GigaSmartNodeData,
  InputNodeData,
  GigaStreamNodeData,
  ToolNodeData,
  HardwareNodeData,
} from '../../store/types';
import { NODE_TYPES } from '../../constants/nodeTypes';
import { getNodeValueProposition } from '../../constants/nodeValues';
import { generateBom, validateConfiguration } from '../../utils/bomEngine';
import { buildPhysicalItems } from '../bom/physicalItems';
import {
  buildTopologyStats,
  describeMapConditions,
  describeFilterNode,
  describeGigaSmartAction,
  describeInputNode,
  describeGigaStreamNode,
  describeToolNode,
} from './describeTopology';
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
}

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
  } = input;

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
      statBlock('Total Simulated Traffic', stats.totalBandwidthLabel),
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
      content.push({
        stack: [
          { text: `${data.label} — ${describeInputNode(data)}`, style: 'body', bold: true },
          { text: getNodeValueProposition(NODE_TYPES.INPUT, data.configType), style: 'muted' },
        ],
        margin: [0, 0, 0, 8],
      });
    });
  }

  const mapNodes = nodes.filter((n) => n.type === NODE_TYPES.MAP);
  if (mapNodes.length > 0) {
    content.push({ text: 'Traffic Maps', style: 'subHeading' });
    mapNodes.forEach((n) => {
      const data = n.data as MapNodeData;
      content.push({
        stack: [
          { text: data.label, style: 'body', bold: true },
          { text: describeMapConditions(data.conditions || []), style: 'muted' },
        ],
        margin: [0, 0, 0, 8],
      });
    });
  }

  const filterNodes = nodes.filter((n) => n.type === NODE_TYPES.FILTER);
  if (filterNodes.length > 0) {
    content.push({ text: 'Filters', style: 'subHeading' });
    filterNodes.forEach((n) => {
      const data = n.data as FilterNodeData;
      content.push({
        stack: [
          { text: data.label, style: 'body', bold: true },
          { text: describeFilterNode(data), style: 'muted' },
        ],
        margin: [0, 0, 0, 8],
      });
    });
  }

  const gigaSmartNodes = nodes.filter((n) => n.type === NODE_TYPES.GIGASMART);
  const gigaStreamNodes = nodes.filter((n) => n.type === NODE_TYPES.GIGASTREAM);
  if (gigaSmartNodes.length > 0 || Object.keys(stats.gigaSmartActionCounts).length > 0) {
    content.push({ text: 'GigaSMART Processing', style: 'subHeading' });
    gigaSmartNodes.forEach((n) => {
      const data = n.data as GigaSmartNodeData;
      content.push({
        stack: [
          { text: `${data.label} — ${data.actionType}`, style: 'body', bold: true },
          { text: describeGigaSmartAction(data), style: 'muted' },
          { text: getNodeValueProposition(NODE_TYPES.GIGASMART, undefined, data.actionType), style: 'muted' },
        ],
        margin: [0, 0, 0, 8],
      });
    });
  }
  if (gigaStreamNodes.length > 0) {
    gigaStreamNodes.forEach((n) => {
      const data = n.data as GigaStreamNodeData;
      content.push({ text: `${data.label} — ${describeGigaStreamNode(data)}`, style: 'body', margin: [0, 0, 0, 8] });
    });
  }

  const toolNodes = nodes.filter((n) => n.type === NODE_TYPES.TOOL);
  if (toolNodes.length > 0) {
    content.push({ text: 'Destinations & Tools', style: 'subHeading' });
    toolNodes.forEach((n) => {
      const data = n.data as ToolNodeData;
      content.push({
        stack: [
          { text: describeToolNode(data), style: 'body', bold: true },
          {
            text: getNodeValueProposition(NODE_TYPES.TOOL, data.expectedType, undefined, data.toolName),
            style: 'muted',
          },
        ],
        margin: [0, 0, 0, 8],
      });
    });
  }

  const hardwareNodes = nodes.filter((n) => n.type === NODE_TYPES.HARDWARE);
  if (hardwareNodes.length > 0) {
    content.push({ text: 'Hardware', style: 'subHeading' });
    content.push({
      ul: hardwareNodes.map((n) => {
        const data = n.data as HardwareNodeData;
        return `${data.label} — ${data.model}${data.sku ? ` (${data.sku})` : ''}`;
      }),
      style: 'body',
    });
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
