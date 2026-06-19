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
}

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

export interface SimulationStepResult {
  metrics: Record<string, NodeMetrics>;
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

  // 1. Initialize metrics for all nodes
  const metrics: Record<string, NodeMetrics> = {};
  nodes.forEach((node) => {
    metrics[node.id] = { rxBps: 0, txBps: 0, rxPackets: 0, txPackets: 0, droppedPackets: 0 };
  });

  const activeEdgeSet = new Set<string>();
  const blockedEdgeSet = new Set<string>();

  // Traversal queue
  interface QueueItem {
    nodeId: string;
    stream: TrajectoryStream;
    edgePath: string[];
  }

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
      nodeMetric.rxBps += item.stream.bandwidth;
      nodeMetric.rxPackets += packetsPerSecond;
    }

    let outboundEdges = edges.filter((e) => e.source === node.id);
    if (node.parentId) {
      const parentEdges = edges.filter((e) => e.source === node.parentId);
      outboundEdges = [...outboundEdges, ...parentEdges];
    }
    const seenTargets = new Set<string>();
    outboundEdges = outboundEdges.filter((edge) => {
      if (seenTargets.has(edge.target)) return false;
      seenTargets.add(edge.target);
      return true;
    });

    if (node.type === 'toolNode') {
      if (!toolReceivedStreams[node.id]) {
        toolReceivedStreams[node.id] = [];
      }
      toolReceivedStreams[node.id].push(item.stream);
      deliveredStreamIds.add(item.stream.id);
      continue;
    }

    let forwardStream: TrajectoryStream | null = { ...item.stream };
    let dropBandwidth = 0;

    if (node.type === 'filterNode') {
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
        nodeMetric.txPackets += packetsPerSecond;
      } else {
        dropBandwidth = item.stream.bandwidth;
        nodeMetric.droppedPackets += dropBandwidth;
        forwardStream = null;
      }
    } 
    else if (node.type === 'mapNode') {
      const data = node.data as MapNodeData;
      const isMatch = evaluateMapConditions(item.stream, data.conditions);
      if (isMatch) {
        nodeMetric.txBps += item.stream.bandwidth;
        nodeMetric.txPackets += packetsPerSecond;
      } else {
        dropBandwidth = item.stream.bandwidth;
        nodeMetric.droppedPackets += dropBandwidth;
        forwardStream = null;
      }
    }
    else if (node.type === 'gigaSmartNode') {
      const data = node.data as GigaSmartNodeData;
      const actionType = data.actionType || 'Deduplication';
      
      if (actionType === 'Deduplication' || actionType === 'Dedup') {
        const dedupRate = data.dedupRate || 20;
        const dropFraction = dedupRate / 100;

        dropBandwidth = item.stream.bandwidth * dropFraction;
        const validBandwidth = item.stream.bandwidth * (1 - dropFraction);

        nodeMetric.droppedPackets += dropBandwidth;
        nodeMetric.txBps += validBandwidth;
        nodeMetric.txPackets += validBandwidth * 250;
        forwardStream = { ...item.stream, bandwidth: validBandwidth };
      } 
      else if (actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') {
        const format = data.metadataFormat || 'CEF';
        const scale = (actionType === 'AMX' || actionType === 'AMI') ? 0.015 : 0.03; // Output is 3% of traffic for Application Metadata (between 1% and 5%)
        const metadataBandwidth = item.stream.bandwidth * scale;

        dropBandwidth = item.stream.bandwidth * (1 - scale);
        nodeMetric.droppedPackets += dropBandwidth;
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
        const slicedBandwidth = item.stream.bandwidth * 0.6;
        nodeMetric.txBps += slicedBandwidth;
        nodeMetric.txPackets += packetsPerSecond;
        forwardStream = { ...item.stream, bandwidth: slicedBandwidth };
      } 
      else if (actionType === 'Header Stripping') {
        const strippedBandwidth = item.stream.bandwidth * 0.95;
        nodeMetric.txBps += strippedBandwidth;
        nodeMetric.txPackets += packetsPerSecond;
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
          nodeMetric.droppedPackets += dropBandwidth;
        }
        nodeMetric.txBps += outputBandwidth;
        nodeMetric.txPackets += packetsPerSecond;
        forwardStream = { ...item.stream, bandwidth: outputBandwidth };
      }
    }
    else if (node.type === 'gigaStreamNode') {
      if (outboundEdges.length > 0) {
        nodeMetric.txBps += item.stream.bandwidth;
        nodeMetric.txPackets += packetsPerSecond;
        
        const splitBandwidth = item.stream.bandwidth / outboundEdges.length;
        
        outboundEdges.forEach((edge) => {
          activeEdgeSet.add(edge.id);
          queue.push({
            nodeId: edge.target,
            stream: { ...item.stream, bandwidth: splitBandwidth },
            edgePath: [...item.edgePath, edge.id],
          });
        });
        continue;
      }
    }
    else if (node.type === 'inputNode') {
      // Done at top
    }
    else {
      nodeMetric.txBps += item.stream.bandwidth;
      nodeMetric.txPackets += packetsPerSecond;
    }

    if (forwardStream && forwardStream.bandwidth > 0 && outboundEdges.length > 0) {
      outboundEdges.forEach((edge) => {
        activeEdgeSet.add(edge.id);
        queue.push({
          nodeId: edge.target,
          stream: { ...forwardStream! },
          edgePath: [...item.edgePath, edge.id],
        });
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
        for (const rStream of received) {
          const rType = rStream.trafficType || 'packet';
          const rFormat = rStream.metadataFormat;

          if (isPacketTool) {
            if (rType !== 'packet') {
              nextStatus = 'warning';
              nextStatusMessage = 'Expected packets, got metadata';
              break;
            }
          } else if (isMetadataTool) {
            if (rType !== 'metadata') {
              nextStatus = 'warning';
              nextStatusMessage = 'Expected metadata, got packets';
              break;
            } else if (expectedFormat !== 'Any' && rFormat !== expectedFormat) {
              nextStatus = 'warning';
              nextStatusMessage = `Format mismatch: got ${rFormat}, expected ${expectedFormat}`;
              break;
            }
            receivedFormat = rFormat || 'Metadata';
          }
        }
        
        if (!nextStatus) {
          nextStatus = 'optimal';
          nextStatusMessage = isPacketTool ? 'Receiving packet traffic' : `Receiving ${receivedFormat} metadata`;
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
      maxStreamBandwidth[s.id] = Math.max(maxStreamBandwidth[s.id] || 0, s.bandwidth);
    });
  });
  const uniqueEgressBps = Object.values(maxStreamBandwidth).reduce((sum, bw) => sum + bw, 0);

  return {
    metrics,
    activeEdges: Array.from(activeEdgeSet),
    blockedEdges: Array.from(blockedEdgeSet),
    deliveredStreamIds: Array.from(deliveredStreamIds),
    nodeDataPatches,
    uniqueEgressBps
  };
};
