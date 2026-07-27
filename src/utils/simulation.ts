import { type Edge } from '@xyflow/react';
import { 
  type TrafficStream, 
  type NodeMetrics, 
  type CustomNode 
} from '../store/types';
import { 
  type TrajectoryStream, 
  type QueueItem, 
  type SimulationStepResult, 
  type NodeProcessor 
} from './simulation/types';
import { getHardwareOpticCapacity, isPacketToolConfig, isMetadataToolConfig, isStorageToolConfig } from './simulation/utils';
import { CONFIG_TYPES } from '../constants/nodeTypes';
import { processToolNode } from './simulation/processors/toolProcessor';
import { processFilterNode } from './simulation/processors/filterProcessor';
import { processMapNode } from './simulation/processors/mapProcessor';
import { processGigaSmartNode } from './simulation/processors/gigaSmartProcessor';
import { processGigaStreamNode } from './simulation/processors/gigaStreamProcessor';
import { processHardwareNode } from './simulation/processors/hardwareProcessor';

export { matchesIp, matchesVlan, matchesPort } from './simulation/matching';
export { evaluateMapConditions } from './simulation/conditions';

const processDefaultNode: NodeProcessor = (node, item, nodeMetric) => {
  const alreadyAddedAtTop = node.id === item.stream.sourceNodeId && item.edgePath.length === 0;
  if (!alreadyAddedAtTop) {
    nodeMetric.txMbps += item.stream.bandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
  }
  return { forwardStream: item.stream };
};

const PROCESSORS: Record<string, NodeProcessor> = {
  toolNode: processToolNode,
  filterNode: processFilterNode,
  mapNode: processMapNode,
  gigaSmartNode: processGigaSmartNode,
  gigaStreamNode: processGigaStreamNode,
  hardwareNode: processHardwareNode,
};

export const calculateSimulationStep = (
  nodes: CustomNode[],
  edges: Edge[],
  trafficStreams: TrafficStream[]
): SimulationStepResult => {
  const nodeDataPatches: Record<string, Record<string, unknown>> = {};

  nodes.forEach((node) => {
    if (node.type === 'inputNode' && String(node.data?.configType || '').startsWith('TAP')) {
      const hasVlan999 = trafficStreams.some(
        (stream) => stream.active && stream.sourceNodeId === node.id && stream.vlan === '999'
      );
      if (hasVlan999 && node.data?.linkSpeed !== 40000) {
        nodeDataPatches[node.id] = { ...nodeDataPatches[node.id], linkSpeed: 40000 };
      }
    }

    if (node.type === 'gigaStreamNode') {
      const linkCount = (node.data?.linkCount as number) || 2;
      const actualLinks = edges.filter((e) => e.source === node.id).length;
      if (actualLinks !== linkCount) {
        nodeDataPatches[node.id] = {
          ...nodeDataPatches[node.id],
          status: 'warning',
          statusMessage: `Port mismatch: expected ${linkCount}, connected ${actualLinks}`
        };
      } else {
        nodeDataPatches[node.id] = { ...nodeDataPatches[node.id], status: 'ok', statusMessage: '' };
      }
    }
  });

  const metrics: Record<string, NodeMetrics> = {};
  nodes.forEach((node) => {
    metrics[node.id] = { rxMbps: 0, txMbps: 0, rxPackets: 0, txPackets: 0, droppedPackets: 0, dedupDroppedMbps: 0, filterDroppedMbps: 0 };
  });

  const activeEdgeSet = new Set<string>();
  const blockedEdgeSet = new Set<string>();
  const encryptedEdgeSet = new Set<string>();
  const decryptedEdgeSet = new Set<string>();
  const edgeTraffic: Record<string, number> = {};
  const edgeEncryptedTraffic: Record<string, number> = {};

  const queue: QueueItem[] = [];
  const toolReceivedStreams: Record<string, TrajectoryStream[]> = {};
  const deliveredStreamIds = new Set<string>();

  const streamsBySource: Record<string, TrajectoryStream[]> = {};
  trafficStreams.forEach((stream) => {
    if (!stream.active) return;
    const sourceNode = nodes.find((n) => n.id === stream.sourceNodeId);
    if (!sourceNode) return;
    if (!streamsBySource[sourceNode.id]) streamsBySource[sourceNode.id] = [];
    streamsBySource[sourceNode.id].push({ ...stream, trafficType: 'packet' });
  });

  Object.entries(streamsBySource).forEach(([nodeId, nodeStreams]) => {
    const sourceNode = nodes.find(n => n.id === nodeId);
    const sourceConfigType = String(sourceNode?.data?.configType || '');
    // Only SPAN and ERSPAN sources are subject to link-speed oversubscription drops.
    // A TAP is a passive fail-safe device that copies wire traffic at line rate and never drops.
    const canDropAtSource = sourceNode?.type === 'inputNode' &&
      (sourceConfigType.startsWith(CONFIG_TYPES.SPAN) || sourceConfigType.startsWith(CONFIG_TYPES.ERSPAN));
    const linkSpeed = canDropAtSource ? ((sourceNode?.data?.linkSpeed as number) || Infinity) : Infinity;
    const totalRequested = nodeStreams.reduce((sum, s) => sum + s.bandwidth, 0);

    let streamsToProcess: TrajectoryStream[] = [];
    if (totalRequested > linkSpeed) {
      const droppedBps = totalRequested - linkSpeed;
      if (metrics[nodeId]) metrics[nodeId].droppedPackets += droppedBps * 250;
      nodeStreams.forEach(stream => {
        const scale = linkSpeed / totalRequested;
        stream.bandwidth *= scale;
        streamsToProcess.push(stream);
      });
    } else {
      streamsToProcess = nodeStreams;
    }

    streamsToProcess.forEach(stream => {
      const encryptedTrafficPercentage = (sourceNode?.data as { encryptedTrafficPercentage?: number })?.encryptedTrafficPercentage;
      const encryptionRatio = encryptedTrafficPercentage !== undefined 
        ? encryptedTrafficPercentage / 100 
        : (stream.isEncrypted ? 1 : 0);

      if (encryptionRatio > 0) {
        if (encryptionRatio < 1) {
          queue.push({ 
            nodeId, 
            stream: { ...stream, id: `${stream.id}-clear`, bandwidth: stream.bandwidth * (1 - encryptionRatio), isEncrypted: false }, 
            edgePath: [] 
          });
        }
        queue.push({ 
          nodeId, 
          stream: { ...stream, id: `${stream.id}-enc`, bandwidth: stream.bandwidth * encryptionRatio, isEncrypted: true }, 
          edgePath: [] 
        });
      } else {
        queue.push({ nodeId, stream, edgePath: [] });
      }
    });
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

    if (node.id === item.stream.sourceNodeId && item.edgePath.length === 0) {
      nodeMetric.txMbps += item.stream.bandwidth;
      nodeMetric.txPackets += item.stream.bandwidth * 250;
    } else {
      let allowedBandwidth = item.stream.bandwidth;
      if (node.type === 'hardwareNode') {
        const capacity = getHardwareOpticCapacity(node);
        if (nodeMetric.rxMbps + allowedBandwidth > capacity) {
          const excess = (nodeMetric.rxMbps + allowedBandwidth) - capacity;
          const minPreserved = Math.max(1, item.stream.bandwidth * 0.05);
          const maxDrop = Math.max(0, allowedBandwidth - minPreserved);
          const drop = Math.min(excess, maxDrop);
          nodeMetric.droppedPackets += drop * 250;
          allowedBandwidth -= drop;
        }
      }
      nodeMetric.rxMbps += allowedBandwidth;
      nodeMetric.rxPackets += allowedBandwidth * 250;
      item.stream.bandwidth = allowedBandwidth;
      if (allowedBandwidth <= 0) continue;
    }

    let outboundEdges = edges.filter((e) => e.source === node.id);
    if (outboundEdges.length === 0 && node.parentId) {
      outboundEdges = edges.filter((e) => e.source === node.parentId);
    }
    const seenTargets = new Set<string>();
    outboundEdges = outboundEdges.filter((edge) => {
      if (node.type === 'gigaStreamNode') return true;
      if (node.type === 'gigaSmartNode') {
        const actionType = String(node.data?.actionType || '');
        if (actionType.startsWith('Load Balancing')) return true;
      }
      if (node.type === 'hardwareNode') {
        const hasGigaStreamChild = nodes.some(n => n.parentId === node.id && n.type === 'gigaStreamNode');
        if (hasGigaStreamChild) return true;
        const parallelEdges = outboundEdges.filter(e => e.target === edge.target);
        if (parallelEdges.length > 1) return true;
      }
      if (seenTargets.has(edge.target)) return false;
      seenTargets.add(edge.target);
      return true;
    });

    const processor = (node.type && PROCESSORS[node.type]) || processDefaultNode;
    const result = processor(node, item, nodeMetric, toolReceivedStreams, deliveredStreamIds, outboundEdges, activeEdgeSet, edgeTraffic, queue, nodes, edgeEncryptedTraffic);

    if (result.handledQueueExternally) continue;

    const forwardStream = result.forwardStream;
    const dropBandwidth = result.dropBandwidth || 0;
    const generatedMetadataStreams = result.generatedMetadataStreams || [];
    const hasForwardStream = forwardStream && forwardStream.bandwidth > 0;
    const hasMetadataStreams = generatedMetadataStreams.length > 0;

    if ((hasForwardStream || hasMetadataStreams) && outboundEdges.length > 0) {
      const gigaStreamChild = nodes.find(n => n.parentId === node.id && n.type === 'gigaStreamNode');
      const isChassisLoadBalancing = !!gigaStreamChild;

      if (isChassisLoadBalancing && hasForwardStream) {
        const splitBandwidth = forwardStream!.bandwidth / outboundEdges.length;

        outboundEdges.forEach((edge) => {
          const targetNode = nodes.find(n => n.id === edge.target);
          activeEdgeSet.add(edge.id);
          
          if (forwardStream!.isEncrypted) { encryptedEdgeSet.add(edge.id); edgeEncryptedTraffic[edge.id] = (edgeEncryptedTraffic[edge.id] || 0) + splitBandwidth; }
          else decryptedEdgeSet.add(edge.id);

          edgeTraffic[edge.id] = (edgeTraffic[edge.id] || 0) + splitBandwidth;
          
          let canAccept = true;
          if (targetNode && targetNode.type === 'toolNode') {
            const toolConfig = targetNode.data?.configType || '';
            const supportsPackets = isPacketToolConfig(toolConfig) || isStorageToolConfig(toolConfig);
            canAccept = supportsPackets;
          }
          
          if (canAccept) {
            queue.push({
              nodeId: edge.target,
              stream: { ...forwardStream!, bandwidth: splitBandwidth, firstEdgeId: edge.id },
              edgePath: [...item.edgePath, edge.id]
            });
          }
        });

        if (hasMetadataStreams) {
          outboundEdges.forEach((edge) => {
            const targetNode = nodes.find(n => n.id === edge.target);
            const toolConfig = targetNode?.data?.configType || '';
            const supportsMetadata = isMetadataToolConfig(toolConfig) || isStorageToolConfig(toolConfig);
            if (!targetNode || targetNode.type !== 'toolNode' || supportsMetadata) {
              generatedMetadataStreams.forEach((ms) => {
                edgeTraffic[edge.id] = (edgeTraffic[edge.id] || 0) + ms.bandwidth;
                queue.push({ nodeId: edge.target, stream: { ...ms, firstEdgeId: edge.id }, edgePath: [...item.edgePath, edge.id] });
              });
            }
          });
        }

        generatedMetadataStreams.forEach((ms) => {
          nodeMetric.txMbps += ms.bandwidth;
          nodeMetric.txPackets += ms.bandwidth * 250;
        });
      } else {
        const edgesPerTarget: Record<string, number> = {};
        outboundEdges.forEach(e => {
          edgesPerTarget[e.target] = (edgesPerTarget[e.target] || 0) + 1;
        });

        outboundEdges.forEach((edge) => {
          const targetNode = nodes.find(n => n.id === edge.target);
          activeEdgeSet.add(edge.id);
          
          const numLinks = edgesPerTarget[edge.target] || 1;
          const edgeForwardStream = hasForwardStream ? { ...forwardStream!, bandwidth: forwardStream!.bandwidth / numLinks } : null;
          const edgeMetadataStreams = generatedMetadataStreams.map(ms => ({ ...ms, bandwidth: ms.bandwidth / numLinks }));

          if (!targetNode || targetNode.type !== 'toolNode') {
            if (edgeForwardStream) {
              if (edgeForwardStream.isEncrypted) { encryptedEdgeSet.add(edge.id); edgeEncryptedTraffic[edge.id] = (edgeEncryptedTraffic[edge.id] || 0) + edgeForwardStream.bandwidth; }
              else decryptedEdgeSet.add(edge.id);
              edgeTraffic[edge.id] = (edgeTraffic[edge.id] || 0) + edgeForwardStream.bandwidth;
              queue.push({ nodeId: edge.target, stream: { ...edgeForwardStream, firstEdgeId: edge.id }, edgePath: [...item.edgePath, edge.id] });
            }
            if (hasMetadataStreams) {
              edgeMetadataStreams.forEach((ms) => {
                edgeTraffic[edge.id] = (edgeTraffic[edge.id] || 0) + ms.bandwidth;
                queue.push({ nodeId: edge.target, stream: { ...ms, firstEdgeId: edge.id }, edgePath: [...item.edgePath, edge.id] });
              });
            }
            return;
          }

          const toolConfig = targetNode.data?.configType || '';
          const supportsPackets = isPacketToolConfig(toolConfig) || isStorageToolConfig(toolConfig);
          const supportsMetadata = isMetadataToolConfig(toolConfig) || isStorageToolConfig(toolConfig);

          if (edgeForwardStream) {
            const isMetadata = edgeForwardStream.trafficType === 'metadata';
            let canAccept = isMetadata ? supportsMetadata : supportsPackets;
            if (isStorageToolConfig(toolConfig) && hasMetadataStreams && !isMetadata) canAccept = false;

            if (canAccept) {
              if (edgeForwardStream.isEncrypted) { encryptedEdgeSet.add(edge.id); edgeEncryptedTraffic[edge.id] = (edgeEncryptedTraffic[edge.id] || 0) + edgeForwardStream.bandwidth; }
              else decryptedEdgeSet.add(edge.id);
              edgeTraffic[edge.id] = (edgeTraffic[edge.id] || 0) + edgeForwardStream.bandwidth;
              queue.push({ nodeId: edge.target, stream: { ...edgeForwardStream, firstEdgeId: edge.id }, edgePath: [...item.edgePath, edge.id] });
            }
          }
          
          if (hasMetadataStreams && supportsMetadata) {
            edgeMetadataStreams.forEach((ms) => {
              edgeTraffic[edge.id] = (edgeTraffic[edge.id] || 0) + ms.bandwidth;
              queue.push({ nodeId: edge.target, stream: { ...ms, firstEdgeId: edge.id }, edgePath: [...item.edgePath, edge.id] });
            });
          }
        });
        
        generatedMetadataStreams.forEach((ms) => {
          nodeMetric.txMbps += ms.bandwidth;
          nodeMetric.txPackets += ms.bandwidth * 250;
        });
      }
    } else if (dropBandwidth > 0 && outboundEdges.length > 0) {
      outboundEdges.forEach((edge) => blockedEdgeSet.add(edge.id));
    }
  }

  edges.forEach((edge) => {
    const sourceMetric = metrics[edge.source];
    if (sourceMetric && sourceMetric.txMbps > 0 && !activeEdgeSet.has(edge.id)) {
      const targetMetric = metrics[edge.target];
      if (targetMetric && targetMetric.rxMbps > 0) activeEdgeSet.add(edge.id);
    }
  });

  nodes.forEach((node) => {
    if (node.type === 'toolNode') {
      const data = node.data;
      const configType = data.configType || '';
      const expectedFormat = data.expectedFormat || 'CEF';
      const isPacketTool = isPacketToolConfig(configType) || data.expectedType === 'packet';
      const isMetadataTool = isMetadataToolConfig(configType) || data.expectedType === 'metadata';
      const received = toolReceivedStreams[node.id] || [];
      
      let nextStatus: 'warning' | 'optimal' | undefined = undefined;
      let nextStatusMessage = 'No active traffic streams';
      let receivedFormat = '';

      if (received.length > 0) {
        let hasValid = false, hasMismatch = false, mismatchMsg = '';
        let packetBandwidth = 0, encryptedPacketBandwidth = 0;
        for (const rStream of received) {
          const rType = rStream.trafficType || 'packet';
          const rFormat = rStream.metadataFormat;
          if (isPacketTool) {
            if (rType === 'packet') {
              packetBandwidth += rStream.bandwidth;
              if (rStream.isEncrypted) { hasMismatch = true; encryptedPacketBandwidth += rStream.bandwidth; }
              else hasValid = true;
            } else { hasMismatch = true; if (!mismatchMsg) mismatchMsg = 'Expected packets, got metadata'; }
          } else if (isMetadataTool) {
            if (rType === 'metadata') {
              if (expectedFormat !== 'Any' && rFormat !== expectedFormat) { hasMismatch = true; if (!mismatchMsg) mismatchMsg = `Format mismatch: got ${rFormat}, expected ${expectedFormat}`; }
              else { hasValid = true; receivedFormat = rFormat || 'Metadata'; }
            } else { hasMismatch = true; if (!mismatchMsg) mismatchMsg = 'Expected metadata, got packets'; }
          }
        }
        // Quantify the post-decryption blind spot: not all encrypted traffic reaching a
        // packet tool has necessarily skipped SSL Decrypt (some streams may bypass it),
        // so report what fraction of what actually arrived is still opaque.
        if (encryptedPacketBandwidth > 0 && !mismatchMsg) {
          const blindSpotPercent = packetBandwidth > 0 ? Math.round((encryptedPacketBandwidth / packetBandwidth) * 100) : 100;
          mismatchMsg = `⚠️ Blind Spot: ${blindSpotPercent}% of Traffic Still Encrypted`;
        }
        if (hasMismatch) { nextStatus = 'warning'; nextStatusMessage = mismatchMsg; }
        else if (hasValid) { nextStatus = 'optimal'; nextStatusMessage = isPacketTool ? 'Receiving packet traffic' : `Receiving ${receivedFormat} metadata`; }
      }
      if (data.status !== nextStatus || data.statusMessage !== nextStatusMessage || data.receivedFormat !== receivedFormat) {
        nodeDataPatches[node.id] = { ...nodeDataPatches[node.id], status: nextStatus, statusMessage: nextStatusMessage, receivedFormat: receivedFormat };
      }
    }
  });

  const maxStreamBandwidth: Record<string, number> = {};
  Object.values(toolReceivedStreams).forEach((received) => {
    received.forEach((s) => {
      const key = s.firstEdgeId ? `${s.id}-${s.firstEdgeId}` : s.id;
      maxStreamBandwidth[key] = Math.max(maxStreamBandwidth[key] || 0, s.bandwidth);
    });
  });
  const uniqueEgressMbps = Object.values(maxStreamBandwidth).reduce((sum, bw) => sum + bw, 0);

  return { metrics, edgeMetrics: edgeTraffic, edgeEncryptedMbps: edgeEncryptedTraffic, activeEdges: Array.from(activeEdgeSet), blockedEdges: Array.from(blockedEdgeSet), encryptedEdges: Array.from(encryptedEdgeSet), decryptedEdges: Array.from(decryptedEdgeSet), deliveredStreamIds: Array.from(deliveredStreamIds), nodeDataPatches, uniqueEgressMbps };
};
