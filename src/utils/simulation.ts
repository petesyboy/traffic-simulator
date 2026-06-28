import { type Edge } from '@xyflow/react';
import { 
  type TrafficStream, 
  type NodeMetrics, 
  type MapCondition, 
  type CustomNode,
  type FilterNodeData,
  type MapNodeData,
  type GigaSmartNodeData,
  type ToolNodeData
} from '../store/store';

export interface TrajectoryStream extends TrafficStream {
  trafficType?: 'packet' | 'metadata';
  metadataFormat?: 'CEF' | 'JSON';
  firstEdgeId?: string;
}

const getHardwareOpticCapacity = (node: CustomNode): number => {
  if (node.type !== 'hardwareNode') return Infinity;
  const optics = (node.data?.optics as { optic: string, qty: number }[]) || [];
  if (optics.length === 0) return Infinity;
  
  let capacity = 0;
  for (const opt of optics) {
    if (!opt.optic) continue;
    const name = opt.optic.toUpperCase();
    let speed = 0;
    if (name.includes('400G') || name.startsWith('QDD-')) speed = 400000;
    else if (name.includes('100G') || name.startsWith('Q28-')) speed = 100000;
    else if (name.includes('40G') || name.startsWith('QSF-')) speed = 40000;
    else if (name.includes('25G') || name.startsWith('SFP-55')) speed = 25000;
    else if (name.includes('10G') || name.startsWith('SFP-53')) speed = 10000;
    else if (name.includes('1G') || name.startsWith('SFP-50')) speed = 1000;
    capacity += speed * opt.qty;
  }
  return capacity > 0 ? capacity : Infinity;
};

// ─── IP matching helpers ──────────────────────────────────────────────────────

/**
 * Convert a dotted-decimal IPv4 string to a 32-bit unsigned integer.
 */
const ipv4ToInt = (ip: string): number => {
  const parts = ip.split('.');
  if (parts.length !== 4) return NaN;
  let result = 0;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) return NaN;
    result = (result << 8) | num;
  }
  return result >>> 0;
};

const getGigaSmartAppOrder = (actionType: string): number => {
  const t = actionType.toLowerCase();
  if (t.includes('lb') && t.includes('stateful')) return 1;
  if (t.includes('afi')) return 2;
  if (t.includes('decap')) return 3;
  if (t.includes('dedup')) return 4;
  if (t.includes('ssl')) return 5;
  if (t.includes('sampling')) return 6;
  if (t.includes('strip')) return 7;
  if (t.includes('enhanced slicing')) return 9;
  if (t.includes('slice')) return 8;
  if (t.includes('masking')) return 10;
  if (t.includes('trailer')) return 11;
  if (t.includes('encap')) return 12;
  if (t.includes('add-header')) return 13;
  if (t.includes('netflow')) return 14;
  if (t.includes('lb')) return 15;
  if (t.includes('ami') || t.includes('amx') || t.includes('metadata')) return 16;
  return 99;
};

/**
 * CIDR-aware IP subnet matching (IPv4).
 */
export const matchesIp = (streamIp: string | undefined, filterIp: string | undefined): boolean => {
  if (!filterIp || !streamIp) return false;

  const cleanFilter = filterIp.trim().toLowerCase();
  const cleanStream = streamIp.trim().toLowerCase();

  if (!cleanFilter.includes('/')) {
    return cleanStream === cleanFilter;
  }

  const [networkStr, prefixStr] = cleanFilter.split('/');
  const prefixLen = parseInt(prefixStr, 10);

  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;

  if (networkStr.includes(':')) {
    return cleanStream.startsWith(networkStr.split(':').slice(0, 3).join(':'));
  }

  const networkInt = ipv4ToInt(networkStr);
  const streamInt  = ipv4ToInt(cleanStream.split('/')[0]);

  if (isNaN(networkInt) || isNaN(streamInt)) return false;

  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (networkInt & mask) === (streamInt & mask);
};

/** Match VLAN IDs: filter value is comma-separated, e.g. "100, 200, 300" */
export const matchesVlan = (streamVlan: string | undefined, filterVlan: string | undefined): boolean => {
  if (!filterVlan) return false;
  const allowed = filterVlan.split(',').map((s) => s.trim());
  return allowed.includes(String(streamVlan || '').trim());
};

/** Match destination/source ports: filter value is comma-separated, e.g. "80, 443" */
export const matchesPort = (streamPort: string | undefined, filterPort: string | undefined): boolean => {
  if (!filterPort) return false;
  const allowed = filterPort.split(',').map((s) => s.trim());
  return allowed.includes(String(streamPort || '').trim());
};

// Evaluate map conditions sequentially with logic rules (AND / OR)
export const evaluateConditionGroup = (stream: TrafficStream, conditions: MapCondition[]): boolean => {
  let result = false;
  
  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    const val = String(cond.value || '').toLowerCase().trim();
    const field = cond.field;
    
    let streamVal = '';
    if (field === 'vlan') streamVal = stream.vlan;
    else if (field === 'ipsrc') streamVal = stream.ipSrc;
    else if (field === 'ipdst') streamVal = stream.ipDst;
    else if (field === 'portsrc') streamVal = stream.portSrc;
    else if (field === 'portdst') streamVal = stream.portDst;
    else if (field === 'protocol') streamVal = stream.protocol;
    
    const cleanStreamVal = String(streamVal || '').toLowerCase().trim();
    
    let isMatch: boolean;
    if (val === '') {
      isMatch = true;
    } else if (field === 'ipver') {
      const isIPv6 = !!(stream.ipSrc?.includes(':') || stream.ipDst?.includes(':'));
      isMatch = (val === 'ipv6') ? isIPv6 : (val === 'ipv4') ? !isIPv6 : false;
    } else if (field === 'vlan') {
      isMatch = matchesVlan(cleanStreamVal, val);
    } else if (['ipsrc', 'ipdst', 'ip6src', 'ip6dst'].includes(field)) {
      isMatch = matchesIp(cleanStreamVal, val);
    } else if (['portsrc', 'portdst'].includes(field)) {
      isMatch = matchesPort(cleanStreamVal, val);
    } else {
      isMatch = cleanStreamVal === val;
    }
    
    if (i === 0) {
      result = isMatch;
    } else if (cond.logic === 'AND') {
      result = result && isMatch;
    } else {
      result = result || isMatch;
    }
  }
  
  return result;
};

export const evaluateMapConditions = (stream: TrafficStream, conditions: MapCondition[] | undefined): boolean => {
  if (!conditions || conditions.length === 0) return true;
  
  const passConditions = conditions.filter(c => !c.action || c.action === 'pass');
  const dropConditions = conditions.filter(c => c.action === 'drop');
  
  if (dropConditions.length > 0 && evaluateConditionGroup(stream, dropConditions)) {
    return false;
  }
  
  if (passConditions.length > 0) {
    return evaluateConditionGroup(stream, passConditions);
  }
  
  return true;
};

interface QueueItem {
  nodeId: string;
  stream: TrajectoryStream;
  edgePath: string[];
}

interface NodeProcessingResult {
  forwardStream: TrajectoryStream | null;
  dropBandwidth?: number;
  generatedMetadataStreams?: TrajectoryStream[];
  handledQueueExternally?: boolean;
}

const processToolNode = (
  node: CustomNode,
  item: QueueItem,
  nodeMetric: NodeMetrics,
  toolReceivedStreams: Record<string, TrajectoryStream[]>,
  deliveredStreamIds: Set<string>
): NodeProcessingResult => {
  const data = node.data as ToolNodeData;
  const configType = data.configType || '';
  const isPacketTool = configType === 'Packet Tool';
  const isMetadataTool = configType === 'Metadata Tool';
  const rType = item.stream.trafficType || 'packet';
  
  let isValidForTool = true;
  if (isPacketTool && rType !== 'packet') isValidForTool = false;
  if (isMetadataTool && rType !== 'metadata') isValidForTool = false;

  if (!toolReceivedStreams[node.id]) {
    toolReceivedStreams[node.id] = [];
  }
  
  if (isValidForTool) {
    toolReceivedStreams[node.id].push(item.stream);
    deliveredStreamIds.add(item.stream.id);
  } else {
    nodeMetric.rxBps -= item.stream.bandwidth;
    nodeMetric.rxPackets -= item.stream.bandwidth * 250;
  }
  return { forwardStream: null, handledQueueExternally: true };
};

const processFilterNode = (
  node: CustomNode,
  item: QueueItem,
  nodeMetric: NodeMetrics
): NodeProcessingResult => {
  const data = node.data as FilterNodeData;
  const configType = data.configType;
  let isMatch = false;

  if (configType === 'VLAN Filter') {
    isMatch = matchesVlan(item.stream.vlan, data.vlanIds);
  } else if (configType === 'IP Subnet Filter') {
    isMatch = matchesIp(item.stream.ipSrc, data.ipSubnet) || 
              matchesIp(item.stream.ipDst, data.ipSubnet);
  } else if (configType === 'Port Filter') {
    isMatch = matchesPort(item.stream.portSrc, data.ports) || 
              matchesPort(item.stream.portDst, data.ports);
  }

  if (isMatch) {
    nodeMetric.txBps += item.stream.bandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
    return { forwardStream: item.stream };
  } else {
    const dropBandwidth = item.stream.bandwidth;
    nodeMetric.droppedPackets += dropBandwidth * 250;
    nodeMetric.filterDroppedBps = (nodeMetric.filterDroppedBps || 0) + dropBandwidth;
    return { forwardStream: null, dropBandwidth };
  }
};

const processMapNode = (
  node: CustomNode,
  item: QueueItem,
  nodeMetric: NodeMetrics
): NodeProcessingResult => {
  const data = node.data as MapNodeData;
  const isMatch = evaluateMapConditions(item.stream, data.conditions);
  if (isMatch) {
    nodeMetric.txBps += item.stream.bandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
    return { forwardStream: item.stream };
  } else {
    const dropBandwidth = item.stream.bandwidth;
    nodeMetric.droppedPackets += dropBandwidth * 250;
    nodeMetric.filterDroppedBps = (nodeMetric.filterDroppedBps || 0) + dropBandwidth;
    return { forwardStream: null, dropBandwidth };
  }
};

const processGigaSmartNode = (
  node: CustomNode,
  item: QueueItem,
  nodeMetric: NodeMetrics
): NodeProcessingResult => {
  const data = node.data as GigaSmartNodeData;
  const actionType = data.actionType || 'Deduplication';
  let forwardStream: TrajectoryStream | null = item.stream;
  let dropBandwidth = 0;
  const generatedMetadataStreams: TrajectoryStream[] = [];
  
  if (actionType === 'Deduplication' || actionType === 'Dedup') {
    const dedupRate = data.dedupRate || 20;
    const dropFraction = dedupRate / 100;

    dropBandwidth = item.stream.bandwidth * dropFraction;
    const validBandwidth = item.stream.bandwidth * (1 - dropFraction);

    nodeMetric.droppedPackets += dropBandwidth * 250;
    nodeMetric.txBps += validBandwidth;
    nodeMetric.txPackets += validBandwidth * 250;
    forwardStream = { ...item.stream, bandwidth: validBandwidth };
  } 
  else if (actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') {
    const format = data.metadataFormat || 'CEF';
    const defaultScale = (actionType === 'AMX' || actionType === 'AMI') ? 0.015 : 0.03;
    const ratePercent = data.metadataRate !== undefined ? Number(data.metadataRate) : (defaultScale * 100);
    const scale = ratePercent / 100;
    const metadataBandwidth = item.stream.bandwidth * scale;

    dropBandwidth = item.stream.bandwidth * (1 - scale);
    nodeMetric.droppedPackets += dropBandwidth * 250;
    nodeMetric.txBps += metadataBandwidth;
    nodeMetric.txPackets += metadataBandwidth * 250;
    forwardStream = { 
      ...item.stream, 
      bandwidth: metadataBandwidth, 
      trafficType: 'metadata', 
      metadataFormat: format as 'CEF' | 'JSON'
    };
  }
  else if (actionType === 'Packet Slicing') {
    const sliceSize = Number(data.sliceSize) || 128;
    const ratio = Math.max(0.01, Math.min(1.0, sliceSize / 1518));
    const slicedBandwidth = item.stream.bandwidth * ratio;
    dropBandwidth = item.stream.bandwidth * (1 - ratio);
    
    nodeMetric.txBps += slicedBandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
    nodeMetric.droppedPackets += dropBandwidth * 250;
    
    forwardStream = { ...item.stream, bandwidth: slicedBandwidth };
  } 
  else if (actionType === 'Header Stripping') {
    const strippedBandwidth = item.stream.bandwidth * 0.95;
    nodeMetric.txBps += strippedBandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
    forwardStream = { ...item.stream, bandwidth: strippedBandwidth };
  }
  else {
    let scale = 1.0;
    if (actionType === 'SSL Decrypt' || actionType === 'Masking') {
      scale = 0.95;
    }
    const outputBandwidth = item.stream.bandwidth * scale;
    if (scale < 1.0) {
      dropBandwidth = item.stream.bandwidth * (1 - scale);
      nodeMetric.droppedPackets += dropBandwidth * 250;
    }
    nodeMetric.txBps += outputBandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
    forwardStream = { ...item.stream, bandwidth: outputBandwidth };
  }
  if (dropBandwidth > 0) {
    nodeMetric.dedupDroppedBps = (nodeMetric.dedupDroppedBps || 0) + dropBandwidth;
  }
  return { forwardStream, dropBandwidth, generatedMetadataStreams };
};

const processGigaStreamNode = (
  _node: CustomNode,
  item: QueueItem,
  nodeMetric: NodeMetrics,
  outboundEdges: Edge[],
  activeEdgeSet: Set<string>,
  edgeTraffic: Record<string, number>,
  queue: QueueItem[]
): NodeProcessingResult => {
  if (outboundEdges.length > 0) {
    nodeMetric.txBps += item.stream.bandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
    
    const splitBandwidth = item.stream.bandwidth / outboundEdges.length;
    
    outboundEdges.forEach((edge) => {
      activeEdgeSet.add(edge.id);
      edgeTraffic[edge.id] = (edgeTraffic[edge.id] || 0) + splitBandwidth;
      queue.push({
        nodeId: edge.target,
        stream: { ...item.stream, bandwidth: splitBandwidth, firstEdgeId: item.stream.firstEdgeId || edge.id },
        edgePath: [...item.edgePath, edge.id],
      });
    });
    return { forwardStream: null, handledQueueExternally: true };
  }
  return { forwardStream: null, dropBandwidth: item.stream.bandwidth };
};

const processHardwareNode = (
  node: CustomNode,
  item: QueueItem,
  nodeMetric: NodeMetrics
): NodeProcessingResult => {
  const isTap = String(node.data?.model || '').includes('TAP');
  const conditions = node.data?.conditions as MapCondition[] | undefined;
  
  const isMatch = isTap ? true : evaluateMapConditions(item.stream, conditions);
  let forwardStream: TrajectoryStream | null = item.stream;
  let dropBandwidth = 0;
  const generatedMetadataStreams: TrajectoryStream[] = [];
  
  if (isMatch) {
    if (node.data?.gigaSmartApps && Array.isArray(node.data.gigaSmartApps)) {
      const sortedApps = [...node.data.gigaSmartApps].sort((a, b) => 
        getGigaSmartAppOrder(a.actionType as string) - getGigaSmartAppOrder(b.actionType as string)
      );
      for (const app of sortedApps) {
        if (item.stream.bandwidth <= 0) break;
        const actionType = (app.actionType as string) || 'Deduplication';
        if (actionType === 'Deduplication' || actionType === 'Dedup') {
          const dropFraction = (app.dedupRate || 20) / 100;
          const drop = item.stream.bandwidth * dropFraction;
          nodeMetric.droppedPackets += drop * 250;
          nodeMetric.dedupDroppedBps = (nodeMetric.dedupDroppedBps || 0) + drop;
          item.stream.bandwidth -= drop;
        } else if (actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') {
          const defaultScale = (actionType === 'AMX' || actionType === 'AMI') ? 0.015 : 0.03;
          const ratePercent = app.metadataRate !== undefined ? Number(app.metadataRate) : (defaultScale * 100);
          const scale = ratePercent / 100;
          const metadataBandwidth = item.stream.bandwidth * scale;
          generatedMetadataStreams.push({
            ...item.stream,
            id: `${item.stream.id}-meta-${Math.random().toString(36).substring(7)}`,
            bandwidth: metadataBandwidth,
            trafficType: 'metadata',
            metadataFormat: (app.metadataFormat as 'CEF' | 'JSON') || 'CEF'
          });
        } else if (actionType === 'Packet Slicing') {
          const sliceSize = Number(app.sliceSize) || 128;
          const ratio = Math.max(0.01, Math.min(1.0, sliceSize / 1518));
          const drop = item.stream.bandwidth * (1 - ratio);
          nodeMetric.droppedPackets += drop * 250;
          item.stream.bandwidth *= ratio;
        } else if (actionType === 'Header Stripping') {
          item.stream.bandwidth *= 0.95;
        } else {
          let scale = 1.0;
          if (actionType === 'SSL Decrypt' || actionType === 'Masking') scale = 0.95;
          const outBandwidth = item.stream.bandwidth * scale;
          if (scale < 1.0) {
             nodeMetric.droppedPackets += item.stream.bandwidth * (1 - scale) * 250;
          }
          item.stream.bandwidth = outBandwidth;
        }
      }
      forwardStream = { ...item.stream };
    }

    const alreadyAddedAtTop = node.id === item.stream.sourceNodeId && item.edgePath.length === 0;
    if (!alreadyAddedAtTop) {
      nodeMetric.txBps += item.stream.bandwidth;
      nodeMetric.txPackets += item.stream.bandwidth * 250;
    }
  } else {
    dropBandwidth = item.stream.bandwidth;
    nodeMetric.droppedPackets += dropBandwidth * 250;
    nodeMetric.filterDroppedBps = (nodeMetric.filterDroppedBps || 0) + dropBandwidth;
    forwardStream = null;
  }

  return { forwardStream, dropBandwidth, generatedMetadataStreams };
};

const processDefaultNode = (
  node: CustomNode,
  item: QueueItem,
  nodeMetric: NodeMetrics
): NodeProcessingResult => {
  const alreadyAddedAtTop = node.id === item.stream.sourceNodeId && item.edgePath.length === 0;
  if (!alreadyAddedAtTop) {
    nodeMetric.txBps += item.stream.bandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
  }
  return { forwardStream: item.stream };
};

type NodeProcessor = (
  node: CustomNode,
  item: QueueItem,
  nodeMetric: NodeMetrics,
  toolReceivedStreams: Record<string, TrajectoryStream[]>,
  deliveredStreamIds: Set<string>,
  outboundEdges: Edge[],
  activeEdgeSet: Set<string>,
  edgeTraffic: Record<string, number>,
  queue: QueueItem[]
) => NodeProcessingResult;

const PROCESSORS: Record<string, NodeProcessor> = {
  toolNode: (node, item, nodeMetric, toolReceivedStreams, deliveredStreamIds) => 
    processToolNode(node, item, nodeMetric, toolReceivedStreams, deliveredStreamIds),
    
  filterNode: (node, item, nodeMetric) => 
    processFilterNode(node, item, nodeMetric),
    
  mapNode: (node, item, nodeMetric) => 
    processMapNode(node, item, nodeMetric),
    
  gigaSmartNode: (node, item, nodeMetric) => 
    processGigaSmartNode(node, item, nodeMetric),
    
  gigaStreamNode: (node, item, nodeMetric, _, __, outboundEdges, activeEdgeSet, edgeTraffic, queue) => 
    processGigaStreamNode(node, item, nodeMetric, outboundEdges, activeEdgeSet, edgeTraffic, queue),
    
  hardwareNode: (node, item, nodeMetric) => 
    processHardwareNode(node, item, nodeMetric),
};

export interface SimulationStepResult {
  metrics: Record<string, NodeMetrics>;
  edgeMetrics: Record<string, number>;
  activeEdges: string[];
  blockedEdges: string[];
  deliveredStreamIds: string[];
  nodeDataPatches: Record<string, Record<string, unknown>>;
  uniqueEgressBps: number;
}

export const calculateSimulationStep = (
  nodes: CustomNode[],
  edges: Edge[],
  trafficStreams: TrafficStream[]
): SimulationStepResult => {
  const nodeDataPatches: Record<string, Record<string, unknown>> = {};

  // Ensure that any TAP Device node that has a VLAN 999 stream is set to 40 Gbps (40000 Mbps)
  nodes.forEach((node) => {
    if (node.type === 'inputNode' && String(node.data?.configType || '').startsWith('TAP')) {
      const hasVlan999 = trafficStreams.some(
        (stream) => stream.active && stream.sourceNodeId === node.id && stream.vlan === '999'
      );
      if (hasVlan999 && node.data?.linkSpeed !== 40000) {
        nodeDataPatches[node.id] = {
          ...nodeDataPatches[node.id],
          linkSpeed: 40000
        };
        // Update the local node object linkSpeed so the rest of the calculation uses the new speed immediately
        node.data = {
          ...node.data,
          linkSpeed: 40000
        };
      }
    }
  });

  // 1. Initialize metrics for all nodes
  const metrics: Record<string, NodeMetrics> = {};
  nodes.forEach((node) => {
    metrics[node.id] = { rxBps: 0, txBps: 0, rxPackets: 0, txPackets: 0, droppedPackets: 0, dedupDroppedBps: 0, filterDroppedBps: 0 };
  });

  const activeEdgeSet = new Set<string>();
  const blockedEdgeSet = new Set<string>();
  const edgeTraffic: Record<string, number> = {};

  const queue: QueueItem[] = [];
  const toolReceivedStreams: Record<string, TrajectoryStream[]> = {};
  const deliveredStreamIds = new Set<string>();

  // Group by source node first to enforce physical link speeds (if configured).
  const streamsBySource: Record<string, TrajectoryStream[]> = {};

  trafficStreams.forEach((stream) => {
    if (!stream.active) return;
    
    const sourceNode = nodes.find((n) => n.id === stream.sourceNodeId);
    if (!sourceNode) return;

    if (!streamsBySource[sourceNode.id]) streamsBySource[sourceNode.id] = [];
    streamsBySource[sourceNode.id].push({ 
      ...stream, 
      trafficType: 'packet' 
    });
  });

  Object.entries(streamsBySource).forEach(([nodeId, nodeStreams]) => {
    const sourceNode = nodes.find(n => n.id === nodeId);
    const linkSpeed = (sourceNode?.data?.linkSpeed as number) || Infinity;
    
    const totalRequested = nodeStreams.reduce((sum, s) => sum + s.bandwidth, 0);
    
    if (totalRequested > linkSpeed) {
      // Traffic exceeds physical port capacity. Cap it and record ingress drops.
      const droppedBps = totalRequested - linkSpeed;
      if (metrics[nodeId]) {
        metrics[nodeId].droppedPackets += droppedBps * 250; // Approximated packet rate
      }

      // Scale down each stream proportionally so the sum equals linkSpeed
      nodeStreams.forEach(stream => {
        const scale = linkSpeed / totalRequested;
        stream.bandwidth *= scale;
        queue.push({ nodeId, stream, edgePath: [] });
      });
    } else {
      // Link capacity is sufficient; enqueue streams unmodified
      nodeStreams.forEach(stream => {
        queue.push({ nodeId, stream, edgePath: [] });
      });
    }
  });

  let iterations = 0;
  const maxIterations = 500;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const item = queue.shift()!;
    const node = nodes.find((n) => n.id === item.nodeId);
    if (!node) continue;

    const nodeMetric = metrics[node.id];
    if (!nodeMetric) continue;

    const packetsPerSecond = item.stream.bandwidth * 250;

    if (node.id === item.stream.sourceNodeId && item.edgePath.length === 0) {
      nodeMetric.txBps += item.stream.bandwidth;
      nodeMetric.txPackets += packetsPerSecond;
    } else {
      let allowedBandwidth = item.stream.bandwidth;
      if (node.type === 'hardwareNode') {
        const capacity = getHardwareOpticCapacity(node);
        if (nodeMetric.rxBps + allowedBandwidth > capacity) {
          const excess = (nodeMetric.rxBps + allowedBandwidth) - capacity;
          // Trim the bandwidth, but leave at least 5% of original stream bandwidth or 1 Mbps
          const minPreserved = Math.max(1, item.stream.bandwidth * 0.05);
          const maxDrop = Math.max(0, allowedBandwidth - minPreserved);
          const drop = Math.min(excess, maxDrop);
          
          nodeMetric.droppedPackets += drop * 250;
          allowedBandwidth -= drop;
        }
      }

      nodeMetric.rxBps += allowedBandwidth;
      nodeMetric.rxPackets += allowedBandwidth * 250;
      item.stream.bandwidth = allowedBandwidth;

      if (allowedBandwidth <= 0) {
        continue;
      }
    }

    let outboundEdges = edges.filter((e) => e.source === node.id);
    if (node.parentId) {
      const parentEdges = edges.filter((e) => e.source === node.parentId);
      outboundEdges = [...outboundEdges, ...parentEdges];
    }
    const seenTargets = new Set<string>();
    outboundEdges = outboundEdges.filter((edge) => {
      if (node.type === 'gigaStreamNode') return true;
      if (seenTargets.has(edge.target)) return false;
      seenTargets.add(edge.target);
      return true;
    });

    let forwardStream: TrajectoryStream | null = item.stream;
    let dropBandwidth = 0;
    let generatedMetadataStreams: TrajectoryStream[] = [];

    const processor = (node.type && PROCESSORS[node.type]) || processDefaultNode;
    const result = processor(
      node,
      item,
      nodeMetric,
      toolReceivedStreams,
      deliveredStreamIds,
      outboundEdges,
      activeEdgeSet,
      edgeTraffic,
      queue
    );

    if (result.handledQueueExternally) {
      continue;
    }

    forwardStream = result.forwardStream;
    dropBandwidth = result.dropBandwidth || 0;
    generatedMetadataStreams = result.generatedMetadataStreams || [];

    const hasForwardStream = forwardStream && forwardStream.bandwidth > 0;
    const hasMetadataStreams = generatedMetadataStreams.length > 0;

    if ((hasForwardStream || hasMetadataStreams) && outboundEdges.length > 0) {
      outboundEdges.forEach((edge) => {
        const targetNode = nodes.find(n => n.id === edge.target);
        const isTargetPacketTool = targetNode?.type === 'toolNode' && 
          (targetNode.data?.configType === 'Packet Tool' || 
           (targetNode.data?.configType === 'Storage Tool' && !hasMetadataStreams));
        const isTargetMetadataTool = targetNode?.type === 'toolNode' && 
          (targetNode.data?.configType === 'Metadata Tool' || 
           (targetNode.data?.configType === 'Storage Tool' && hasMetadataStreams));

        activeEdgeSet.add(edge.id);
        
        // Forward the main packet stream if the target is NOT a metadata-only tool
        if (hasForwardStream && !isTargetMetadataTool) {
          edgeTraffic[edge.id] = (edgeTraffic[edge.id] || 0) + forwardStream!.bandwidth;
          queue.push({
            nodeId: edge.target,
            stream: { ...forwardStream!, firstEdgeId: item.stream.firstEdgeId || edge.id },
            edgePath: [...item.edgePath, edge.id],
          });
        }
        
        // Forward any generated metadata streams if the target is NOT a packet-only tool
        if (hasMetadataStreams && !isTargetPacketTool) {
          generatedMetadataStreams.forEach((ms) => {
            edgeTraffic[edge.id] = (edgeTraffic[edge.id] || 0) + ms.bandwidth;
            queue.push({
              nodeId: edge.target,
              stream: { ...ms, firstEdgeId: item.stream.firstEdgeId || edge.id },
              edgePath: [...item.edgePath, edge.id],
            });
          });
        }
      });
      
      // Accumulate transmission stats for the metadata streams
      generatedMetadataStreams.forEach((ms) => {
        nodeMetric.txBps += ms.bandwidth;
        nodeMetric.txPackets += ms.bandwidth * 250;
      });
    } else if (dropBandwidth > 0 && outboundEdges.length > 0) {
      outboundEdges.forEach((edge) => {
        blockedEdgeSet.add(edge.id);
      });
    }
  }

  // Post-traversal: Mark edges active based on connected RX/TX
  edges.forEach((edge) => {
    const sourceMetric = metrics[edge.source];
    if (sourceMetric && sourceMetric.txBps > 0 && !activeEdgeSet.has(edge.id)) {
      const targetMetric = metrics[edge.target];
      if (targetMetric && targetMetric.rxBps > 0) {
        activeEdgeSet.add(edge.id);
      }
    }
  });

  // Tool status calculation
  nodes.forEach((node) => {
    if (node.type === 'toolNode') {
      const data = node.data as ToolNodeData;
      const configType = data.configType || '';
      const expectedFormat = data.expectedFormat || 'CEF';
      
      const isPacketTool = configType === 'Packet Tool';
      const isMetadataTool = configType === 'Metadata Tool';
      
      const received = toolReceivedStreams[node.id] || [];
      
      let nextStatus: 'warning' | 'optimal' | undefined = undefined;
      let nextStatusMessage = '';
      let receivedFormat = '';

      if (received.length > 0) {
        let hasValid = false;
        let hasMismatch = false;
        let mismatchMsg = '';

        for (const rStream of received) {
          const rType = rStream.trafficType || 'packet';
          const rFormat = rStream.metadataFormat;

          if (isPacketTool) {
            if (rType === 'packet') {
              hasValid = true;
            } else {
              hasMismatch = true;
              if (!mismatchMsg) mismatchMsg = 'Expected packets, got metadata';
            }
          } else if (isMetadataTool) {
            if (rType === 'metadata') {
              if (expectedFormat !== 'Any' && rFormat !== expectedFormat) {
                hasMismatch = true;
                if (!mismatchMsg) mismatchMsg = `Format mismatch: got ${rFormat}, expected ${expectedFormat}`;
              } else {
                hasValid = true;
                receivedFormat = rFormat || 'Metadata';
              }
            } else {
              hasMismatch = true;
              if (!mismatchMsg) mismatchMsg = 'Expected metadata, got packets';
            }
          }
        }

        if (hasValid) {
          nextStatus = 'optimal';
          nextStatusMessage = isPacketTool ? 'Receiving packet traffic' : `Receiving ${receivedFormat} metadata`;
        } else if (hasMismatch) {
          nextStatus = 'warning';
          nextStatusMessage = mismatchMsg;
        }
      } else {
        nextStatus = undefined;
        nextStatusMessage = 'No active traffic streams';
      }

      if (
        data.status !== nextStatus || 
        data.statusMessage !== nextStatusMessage ||
        data.receivedFormat !== receivedFormat
      ) {
        nodeDataPatches[node.id] = {
          ...nodeDataPatches[node.id],
          status: nextStatus, 
          statusMessage: nextStatusMessage,
          receivedFormat: receivedFormat 
        };
      }
    }
  });

  // Calculate unique egress metrics across duplicate paths
  const maxStreamBandwidth: Record<string, number> = {};
  Object.values(toolReceivedStreams).forEach((received) => {
    received.forEach((s) => {
      const key = s.firstEdgeId ? `${s.id}-${s.firstEdgeId}` : s.id;
      maxStreamBandwidth[key] = Math.max(maxStreamBandwidth[key] || 0, s.bandwidth);
    });
  });
  const uniqueEgressBps = Object.values(maxStreamBandwidth).reduce((sum, bw) => sum + bw, 0);

  return {
    metrics,
    edgeMetrics: edgeTraffic,
    activeEdges: Array.from(activeEdgeSet),
    blockedEdges: Array.from(blockedEdgeSet),
    deliveredStreamIds: Array.from(deliveredStreamIds),
    nodeDataPatches,
    uniqueEgressBps
  };
};
