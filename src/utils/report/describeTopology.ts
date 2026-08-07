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
  FilterNodeData,
  GigaSmartNodeData,
  InputNodeData,
  GigaStreamNodeData,
  ToolNodeData,
  HardwareNodeData,
} from '../../store/types';
import { CONFIG_TYPES, ACTION_TYPES, NODE_TYPES, isMetadataAction, isDedupAction } from '../../constants/nodeTypes';
import { formatBandwidth } from '../format';

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
