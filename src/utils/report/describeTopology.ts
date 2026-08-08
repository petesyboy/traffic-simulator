/**
 * describeTopology.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure, unit-testable helpers that turn the current topology (nodes, edges,
 * traffic streams) into plain-English descriptions and summary statistics for
 * the PDF report. Sentence logic here is ported from the inline
 * `exportDiagramMode` prose already used on-canvas (MapNode.tsx, FilterNode.tsx,
 * GigaSmartNode.tsx) and from InputNode.tsx's configType label switch, so the
 * report's wording matches what a user already sees when they enable
 * "Export Diagram Ready Mode" on the canvas — extracted rather than re-derived.
 */
import type { Edge } from '@xyflow/react';
import type {
  CustomNode,
  TrafficStream,
  MapCondition,
  MapNodeData,
  FilterNodeData,
  GigaSmartNodeData,
  InputNodeData,
  GigaStreamNodeData,
  ToolNodeData,
  HardwareNodeData,
  NodeMetrics,
} from '../../store/types';
import { CONFIG_TYPES, ACTION_TYPES, NODE_TYPES, isMetadataAction, isDedupAction } from '../../constants/nodeTypes';
import { formatBandwidth } from '../format';
import { getUpstreamNodes, getDownstreamNodes, traceToTerminalInputs, traceToTerminalOutputs } from './graphTrace';
import { describeTapPhysicalLink } from './describeTapLink';
import { describeGigaSmartFunction } from './gigaSmartDescriptions';
import { describeToolPurpose, describeToolOverloadRisk } from './toolDescriptions';

// ─── Stats ──────────────────────────────────────────────────────────────────

export interface TopologyStats {
  inputCounts: {
    tap: number;
    span: number;
    erspan: number;
    eastWest: number;
    vmware: number;
    other: number;
    total: number;
  };
  gigaSmartActionCounts: Record<string, number>;
  chassisCounts: Record<string, number>;
  mapNodeCount: number;
  filterNodeCount: number;
  toolCount: number;
  trafficStreamCount: number;
  totalBandwidthMbps: number;
  totalBandwidthLabel: string;
}

const bumpAction = (counts: Record<string, number>, actionType: string | undefined) => {
  if (!actionType) return;
  counts[actionType] = (counts[actionType] || 0) + 1;
};

export function buildTopologyStats(
  nodes: CustomNode[],
  _edges: Edge[],
  trafficStreams: TrafficStream[],
): TopologyStats {
  const inputCounts = { tap: 0, span: 0, erspan: 0, eastWest: 0, vmware: 0, other: 0, total: 0 };
  const gigaSmartActionCounts: Record<string, number> = {};
  const chassisCounts: Record<string, number> = {};
  let mapNodeCount = 0;
  let filterNodeCount = 0;
  let toolCount = 0;

  for (const node of nodes) {
    if (node.type === NODE_TYPES.INPUT) {
      const configType = String((node.data as InputNodeData).configType || '');
      inputCounts.total += 1;
      if (configType.startsWith(CONFIG_TYPES.TAP)) inputCounts.tap += 1;
      else if (configType.startsWith(CONFIG_TYPES.SPAN)) inputCounts.span += 1;
      else if (configType.startsWith(CONFIG_TYPES.ERSPAN)) inputCounts.erspan += 1;
      else if (configType.startsWith(CONFIG_TYPES.EAST_WEST)) inputCounts.eastWest += 1;
      else if (configType.startsWith(CONFIG_TYPES.VMWARE)) inputCounts.vmware += 1;
      else inputCounts.other += 1;
    } else if (node.type === NODE_TYPES.MAP) {
      mapNodeCount += 1;
    } else if (node.type === NODE_TYPES.FILTER) {
      filterNodeCount += 1;
    } else if (node.type === NODE_TYPES.TOOL) {
      toolCount += 1;
      const toolData = node.data as ToolNodeData;
      (toolData.gigaSmartApps || []).forEach((app) => bumpAction(gigaSmartActionCounts, app.actionType));
    } else if (node.type === NODE_TYPES.GIGASMART) {
      bumpAction(gigaSmartActionCounts, (node.data as GigaSmartNodeData).actionType);
    } else if (node.type === NODE_TYPES.HARDWARE) {
      const hwData = node.data as HardwareNodeData;
      const model = String(hwData.model || '').trim();
      if (model) chassisCounts[model] = (chassisCounts[model] || 0) + 1;
      (hwData.gigaSmartApps || []).forEach((app) => bumpAction(gigaSmartActionCounts, app.actionType));
    }
  }

  const totalBandwidthMbps = trafficStreams.reduce((sum, s) => sum + (s.bandwidth || 0), 0);

  return {
    inputCounts,
    gigaSmartActionCounts,
    chassisCounts,
    mapNodeCount,
    filterNodeCount,
    toolCount,
    trafficStreamCount: trafficStreams.length,
    totalBandwidthMbps,
    totalBandwidthLabel: formatBandwidth(totalBandwidthMbps),
  };
}

// ─── Per-node prose ──────────────────────────────────────────────────────────

/** Ported verbatim from MapNode.tsx's `exportDiagramMode` overlay. */
export function describeMapConditions(conditions: MapCondition[]): string {
  if (conditions.length === 0) return 'Traffic Map: Pass All (No filters)';
  return (
    `Traffic Map (Filtering Rules):\n` +
    conditions
      .map((c, i) => {
        const logicPrefix = i > 0 ? `${c.logic} ` : '';
        let fieldLabel = c.field.toUpperCase();
        if (c.field === 'portdst') fieldLabel = 'DST PORT';
        if (c.field === 'portsrc') fieldLabel = 'SRC PORT';
        if (c.field === 'ipdst') fieldLabel = 'DST IP';
        if (c.field === 'ipsrc') fieldLabel = 'SRC IP';
        if (c.field === 'ipver') fieldLabel = 'IP VER';
        if (c.field === 'vlan') fieldLabel = 'VLAN';
        if (c.field === 'protocol') fieldLabel = 'PROTO';

        const actionLabel = c.action === 'drop' ? 'DROP' : 'PASS';
        return `• ${logicPrefix}${fieldLabel} = ${c.value} -> ${actionLabel}`;
      })
      .join('\n')
  );
}

const conditionFieldPhrase = (field: string, value: string): string => {
  switch (field) {
    case 'vlan':
      return `VLAN ${value}`;
    case 'protocol':
      return `${value} protocol traffic`;
    case 'ipver':
      return `IPv${value} traffic`;
    case 'portdst':
      return `traffic to port ${value}`;
    case 'portsrc':
      return `traffic from port ${value}`;
    case 'ipdst':
      return `traffic to ${value}`;
    case 'ipsrc':
      return `traffic from ${value}`;
    default:
      return `${field} = ${value}`;
  }
};

/** Plain-English "what's included vs excluded" summary, ahead of the precise per-condition bullets. */
export function summarizeMapInclusionExclusion(conditions: MapCondition[]): string {
  if (conditions.length === 0) return 'Includes: all traffic (no filters configured).';

  const included: string[] = [];
  const excluded: string[] = [];
  conditions.forEach((c) => {
    const phrase = conditionFieldPhrase(c.field, c.value);
    (c.action === 'drop' ? excluded : included).push(phrase);
  });

  const parts: string[] = [];
  if (included.length > 0) parts.push(`Includes: ${included.join(', ')}`);
  if (excluded.length > 0) parts.push(`Excludes: ${excluded.join(', ')}`);
  return `${parts.join('. ')}.`;
}

/** Ported verbatim from FilterNode.tsx's `exportDiagramMode` overlay. */
export function describeFilterNode(data: FilterNodeData): string {
  const configType = data.configType;
  if (configType === CONFIG_TYPES.VLAN_FILTER) {
    return `VLAN Filter:\n• VLAN IDs: ${data.vlanIds || 'None'}\n• Action: PASS matching / DROP others`;
  } else if (configType === CONFIG_TYPES.IP_FILTER) {
    return `IP Filter:\n• Subnet: ${data.ipSubnet || 'None'}\n• Action: PASS matching / DROP others`;
  } else if (configType === CONFIG_TYPES.PORT_FILTER) {
    return `Port Filter:\n• Port numbers: ${data.ports || 'None'}\n• Action: PASS matching / DROP others`;
  }
  return 'Filter: No criteria set';
}

/** Ported verbatim from GigaSmartNode.tsx's always-rendered "Action summary line". */
export function describeGigaSmartAction(data: GigaSmartNodeData): string {
  const actionType = data.actionType || ACTION_TYPES.DEDUPLICATION;
  if (isDedupAction(actionType)) return 'Action: Drop';
  if (actionType === ACTION_TYPES.PACKET_SLICING) return `Action: Slice (${data.sliceSize || 128}B)`;
  if (actionType === ACTION_TYPES.HEADER_STRIP) return 'Action: Strip';
  if (isMetadataAction(actionType)) return `Format: ${data.metadataFormat || 'CEF'}`;
  return `Action: ${actionType}`;
}

/** Ported from InputNode.tsx's `nodeTypeLabel` switch. */
export function describeInputNode(data: InputNodeData): string {
  const configType = String(data.configType || '');
  if (configType.startsWith(CONFIG_TYPES.SPAN)) return 'SPAN Input Port';
  if (configType.startsWith(CONFIG_TYPES.TAP)) return 'TAP Hardware Device';
  if (configType.startsWith(CONFIG_TYPES.ERSPAN)) return 'ERSPAN Tunnel Input';
  if (configType.startsWith(CONFIG_TYPES.EAST_WEST)) return 'East/West Traffic Source';
  if (configType.startsWith(CONFIG_TYPES.VMWARE)) return 'VMWare Virtual Estate';
  return 'Network Input';
}

export function describeGigaStreamNode(data: GigaStreamNodeData): string {
  const algorithm = data.algorithm || 'Round Robin';
  const linkCount = data.linkCount || 2;
  return `GigaStream Load Balancer: distributes traffic across ${linkCount} links using ${algorithm}.`;
}

export function describeToolNode(data: ToolNodeData): string {
  const name = data.toolName || data.label || 'Tool';
  const format = data.expectedFormat || data.expectedType || 'packets';
  return `${name}: receives ${format} traffic${data.ingestLimitMbps ? ` (ingest limit ${formatBandwidth(data.ingestLimitMbps)})` : ''}.`;
}

// ─── Detail builders (headline + bullet list) ────────────────────────────────
// Combine the sentence helpers above with the graphTrace helpers and, when a
// simulation has actually been run, live per-node metrics — for the report's
// more verbose per-node breakdown of what feeds in, what happens to it, and
// what ultimately receives it.

export interface NodeDetail {
  headline: string;
  bullets: string[];
}

/** Splits a multi-line describe*() sentence into individual bullet lines, stripping any leading '• '. */
const toBulletLines = (multiline: string): string[] =>
  multiline
    .split('\n')
    .map((line) => line.replace(/^•\s*/, '').trim())
    .filter(Boolean);

const labelsOf = (nodes: CustomNode[]): string => nodes.map((n) => n.data.label || n.id).join(', ');

export function describeInputNodeDetail(
  node: CustomNode,
  nodes: CustomNode[],
  edges: Edge[],
  trafficStreams: TrafficStream[],
  nodeMetrics?: Record<string, NodeMetrics>,
): NodeDetail {
  const data = node.data as InputNodeData;
  const bullets: string[] = [];

  if (data.linkSpeed) bullets.push(`Link speed: ${formatBandwidth(data.linkSpeed)}`);
  if (data.portSpeed) bullets.push(`Port speed: ${data.portSpeed}`);
  if (data.encryptedTrafficPercentage) bullets.push(`Encrypted traffic: ${data.encryptedTrafficPercentage}%`);
  if (data.site) bullets.push(`Site: ${data.site}`);

  const streams = trafficStreams.filter((s) => s.sourceNodeId === node.id);
  streams.forEach((s) => {
    const parts = [s.vlan ? `VLAN ${s.vlan}` : null, s.protocol, s.portDst ? `port ${s.portDst}` : null].filter(
      Boolean,
    );
    bullets.push(`Traffic stream "${s.name}": ${parts.join(', ')} at ${formatBandwidth(s.bandwidth)}`);
  });

  if (String(data.configType || '').startsWith(CONFIG_TYPES.TAP)) {
    bullets.push(...describeTapPhysicalLink(node, nodes, edges));
  }

  const downstream = getDownstreamNodes(node.id, nodes, edges);
  if (downstream.length > 0) bullets.push(`Feeds into: ${labelsOf(downstream)}`);

  const terminals = traceToTerminalOutputs(node.id, nodes, edges);
  if (terminals.length > 0) bullets.push(`Ultimately reaches: ${labelsOf(terminals)}`);

  const metrics = nodeMetrics?.[node.id];
  if (metrics) bullets.push(`Observed: ${formatBandwidth(metrics.rxMbps)} in / ${formatBandwidth(metrics.txMbps)} out`);

  return { headline: `${data.label} — ${describeInputNode(data)}`, bullets };
}

export function describeProcessingNodeDetail(
  node: CustomNode,
  nodes: CustomNode[],
  edges: Edge[],
  nodeMetrics?: Record<string, NodeMetrics>,
): NodeDetail {
  const bullets: string[] = [];

  if (node.type === NODE_TYPES.MAP) {
    const conditions = (node.data as MapNodeData).conditions || [];
    bullets.push(summarizeMapInclusionExclusion(conditions));
    bullets.push(...toBulletLines(describeMapConditions(conditions)));
  } else if (node.type === NODE_TYPES.FILTER) {
    bullets.push(...toBulletLines(describeFilterNode(node.data as FilterNodeData)));
  } else if (node.type === NODE_TYPES.GIGASMART) {
    const gsData = node.data as GigaSmartNodeData;
    bullets.push(describeGigaSmartAction(gsData));
    bullets.push(describeGigaSmartFunction(gsData.actionType));
  } else if (node.type === NODE_TYPES.GIGASTREAM) {
    bullets.push(describeGigaStreamNode(node.data as GigaStreamNodeData));
  }

  const upstream = getUpstreamNodes(node.id, nodes, edges);
  if (upstream.length > 0) bullets.push(`Receives from: ${labelsOf(upstream)}`);

  const downstream = getDownstreamNodes(node.id, nodes, edges);
  if (downstream.length > 0) bullets.push(`Forwards to: ${labelsOf(downstream)}`);

  const metrics = nodeMetrics?.[node.id];
  if (metrics) {
    let line = `Observed: ${formatBandwidth(metrics.rxMbps)} in, ${formatBandwidth(metrics.txMbps)} out`;
    if (metrics.rxMbps > 0 && metrics.txMbps < metrics.rxMbps) {
      const reductionPct = Math.round((1 - metrics.txMbps / metrics.rxMbps) * 100);
      line += ` (${reductionPct}% reduction)`;
    }
    bullets.push(line);
    if (metrics.dedupDroppedMbps) bullets.push(`Deduplicated away: ${formatBandwidth(metrics.dedupDroppedMbps)}`);
    if (metrics.filterDroppedMbps) bullets.push(`Filtered out: ${formatBandwidth(metrics.filterDroppedMbps)}`);
  }

  return { headline: node.data.label || node.id, bullets };
}

export function describeToolNodeDetail(
  node: CustomNode,
  nodes: CustomNode[],
  edges: Edge[],
  nodeMetrics?: Record<string, NodeMetrics>,
): NodeDetail {
  const data = node.data as ToolNodeData;
  const bullets: string[] = [];

  bullets.push(describeToolPurpose(data.toolName));
  bullets.push(describeToolOverloadRisk(data.toolName, data.ingestLimitMbps));

  const origins = traceToTerminalInputs(node.id, nodes, edges);
  if (origins.length > 0) bullets.push(`Traffic originates from: ${labelsOf(origins)}`);

  const metrics = nodeMetrics?.[node.id];
  if (metrics) bullets.push(`Currently receiving: ${formatBandwidth(metrics.rxMbps)}`);

  return { headline: describeToolNode(data), bullets };
}
