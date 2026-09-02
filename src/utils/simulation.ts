import { type Edge } from '@xyflow/react';
import { 
  type TrafficStream, 
  type NodeMetrics, 
  type CustomNode,
  type ClusterNodeData 
} from '../store/types';
import { 
  type TrajectoryStream, 
  type QueueItem, 
  type SimulationStepResult, 
  type NodeProcessor 
} from './simulation/types';
import { getHardwareOpticCapacity, isPacketToolConfig, isMetadataToolConfig, isStorageToolConfig } from './simulation/utils';
import { CONFIG_TYPES } from '../constants/nodeTypes';
import { getDefaultIngestLimitMbps } from '../constants/toolIngestLimits';
import { formatBandwidth } from './format';
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

const processClusterNode: NodeProcessor = (node, item, _nodeMetric, toolReceivedStreams, deliveredStreamIds) => {
  const isTool = (node.data as any)?.clusterType === 'tool';
  if (isTool) {
    if (!toolReceivedStreams[node.id]) {
      toolReceivedStreams[node.id] = [];
    }
    toolReceivedStreams[node.id].push(item.stream);
    deliveredStreamIds.add(item.stream.id);
    return { forwardStream: null, handledQueueExternally: true };
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
  missionPipelineNode: processHardwareNode,
  clusterNode: processClusterNode,
  dwdmNetworkNode: processDefaultNode,
};

// The GigaSMART Appliance (GSA) only returns processed packets to a GigaVUE
// TA/HC chassis over one of its 400G data ports - it has no valid path to
// hand packets directly to a leaf tool (S3, Splunk, an NDR, etc.). Metadata
// (AMI/AMX) is the only output meant for those destinations, via the
// appliance's separate "metadata-out" handle.
const isValidGsaPacketTarget = (targetNode: CustomNode | undefined): boolean => {
  if (!targetNode || targetNode.type !== 'hardwareNode') return false;
  const model = String(targetNode.data?.model || '');
  return (model.includes('TA') || model.includes('HC')) && !model.includes('TAP');
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
    metrics[node.id] = { rxMbps: 0, txMbps: 0, rxPackets: 0, txPackets: 0, droppedPackets: 0, dedupDroppedMbps: 0, filterDroppedMbps: 0, gigaSmartDroppedMbps: 0 };
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
  const maxIterations = 5000;

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
    if (outboundEdges.length === 0) {
      if (node.parentId) {
        outboundEdges = edges.filter((e) => e.source === node.parentId);
      } else {
        // Check if node is a member of a collapsed cluster
        const clusterNode = nodes.find(
          (n) => n.type === 'clusterNode' &&
          ((n.data as ClusterNodeData)?.memberNodeIds?.includes(node.id) || (node.data as any)?.clusterId === n.id) &&
          (n.data as ClusterNodeData)?.isCollapsed !== false
        );
        if (clusterNode) {
          // If edges retain originalSource matching this member node, prefer them
          const specificEdges = edges.filter(
            (e) => e.source === clusterNode.id && (e.data as Record<string, unknown>)?.originalSource === node.id
          );
          if (specificEdges.length > 0) {
            outboundEdges = specificEdges;
          } else {
            outboundEdges = edges.filter((e) => e.source === clusterNode.id);
          }
          if (metrics[clusterNode.id] && node.id === item.stream.sourceNodeId && item.edgePath.length === 0) {
            metrics[clusterNode.id].txMbps += item.stream.bandwidth;
            metrics[clusterNode.id].txPackets += item.stream.bandwidth * 250;
          }
        } else if (node.type === 'clusterNode' && (node.data as ClusterNodeData)?.isCollapsed === false) {
          // An expanded cluster node: if traffic was targeted directly to clusterNode.id,
          // find outgoing edges from its member nodes
          const memberIds = (node.data as ClusterNodeData)?.memberNodeIds || [];
          outboundEdges = edges.filter((e) => memberIds.includes(e.source));
        }
      }
    }

    // A GSA hands processed packets back to a TA/HC over the same kind of edge
    // used for onward distribution to a tool - a genuine round trip through
    // the same chassis. Without special-casing this, the chassis would treat
    // both directions as ordinary fan-out: the raw, unprocessed stream would
    // reach the tool directly on the way in (bypassing the GSA entirely) and
    // the GSA's processed return would reach it a second time, double-
    // counting the traffic; the return would also loop straight back into
    // the GSA it just came from, re-running dedup on it forever. Once a
    // chassis has a paired round-trip GSA, its other ports are treated as
    // that GSA's distribution ports for this flow: the raw pass goes only to
    // the GSA, and only the GSA's return is fanned out everywhere else.
    const incomingEdge = item.edgePath.length > 0 ? edges.find((e) => e.id === item.edgePath[item.edgePath.length - 1]) : undefined;
    const incomingNode = incomingEdge ? nodes.find((n) => n.id === incomingEdge.source) : undefined;
    const incomingIsGsa = incomingNode?.type === 'toolNode' && incomingNode.data?.toolName === 'GigaSMART Appliance';

    const pairedGsaTargetIds = new Set(
      node.type === 'hardwareNode'
        ? outboundEdges
            .filter((edge) => {
              const targetNode = nodes.find((n) => n.id === edge.target);
              if (targetNode?.type !== 'toolNode' || targetNode.data?.toolName !== 'GigaSMART Appliance') return false;
              return edges.some((re) => re.source === edge.target && re.target === node.id);
            })
            .map((edge) => edge.target)
        : []
    );

    const seenTargets = new Set<string>();
    outboundEdges = outboundEdges.filter((edge) => {
      if (node.type === 'hardwareNode' && pairedGsaTargetIds.size > 0) {
        if (incomingIsGsa && pairedGsaTargetIds.has(incomingNode!.id)) {
          if (edge.target === incomingNode!.id) return false;
        } else if (!pairedGsaTargetIds.has(edge.target)) {
          return false;
        }
      }
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
      // A tool node (e.g. the GSA) wired with two edges to the same downstream
      // tool is user-intent load balancing, not an accidental duplicate link -
      // keep both and let the split-bandwidth logic below share the load.
      if (node.type === 'toolNode') {
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
      const isGigaSmartApplianceSource = node.type === 'toolNode' && node.data?.toolName === 'GigaSMART Appliance';

      // Nodes with a dedicated metadata-egress handle (currently only the
      // GigaSMART Appliance's "metadata-out") must not have their generated
      // metadata streams leak down the same edges as the main forward stream
      // (e.g. the packet-return edge to a TA/HC). For every other node type,
      // no outbound edge ever has this sourceHandle, so these two sets both
      // just equal the full outboundEdges list - identical to prior behavior.
      const metadataOutboundEdges = outboundEdges.filter((e) => e.sourceHandle === 'metadata-out');
      const hasMetadataOutboundEdges = metadataOutboundEdges.length > 0;
      const packetOutboundEdges = hasMetadataOutboundEdges
        ? outboundEdges.filter((e) => e.sourceHandle !== 'metadata-out')
        : outboundEdges;
      const metadataTargetEdges = hasMetadataOutboundEdges ? metadataOutboundEdges : outboundEdges;
      const packetEdgeIdSet = new Set(packetOutboundEdges.map((e) => e.id));
      const metadataEdgeIdSet = new Set(metadataTargetEdges.map((e) => e.id));

      if (isChassisLoadBalancing && hasForwardStream) {
        const splitBandwidth = packetOutboundEdges.length > 0 ? forwardStream!.bandwidth / packetOutboundEdges.length : 0;

        packetOutboundEdges.forEach((edge) => {
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
          metadataTargetEdges.forEach((edge) => {
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
        // Resolve cluster / group pool ID for tool cluster members so traffic is
        // load-balanced across member tools rather than multicasting full rate to all.
        const getTargetClusterId = (targetId: string): string | null => {
          const tn = nodes.find(n => n.id === targetId);
          if (!tn) return null;
          if (tn.type === 'clusterNode' && (tn.data as any)?.clusterType === 'tool') return tn.id;
          if (tn.data && (tn.data as any).clusterId) {
            const cNode = nodes.find(n => n.id === (tn.data as any).clusterId);
            if (cNode && (cNode.data as any)?.clusterType === 'tool') return cNode.id;
          }
          return null;
        };

        // Tracked separately so a node fanning out on both handles (e.g. the
        // GSA's packet "out" and metadata "metadata-out") doesn't let one
        // handle's link count affect the other's split when load-balanced.
        const clusterEdgesCount: Record<string, number> = {};
        const edgesPerTarget: Record<string, number> = {};
        packetOutboundEdges.forEach(e => {
          edgesPerTarget[e.target] = (edgesPerTarget[e.target] || 0) + 1;
          const cId = getTargetClusterId(e.target);
          if (cId) {
            clusterEdgesCount[cId] = (clusterEdgesCount[cId] || 0) + 1;
          }
        });

        const metadataClusterEdgesCount: Record<string, number> = {};
        const metadataEdgesPerTarget: Record<string, number> = {};
        metadataTargetEdges.forEach(e => {
          metadataEdgesPerTarget[e.target] = (metadataEdgesPerTarget[e.target] || 0) + 1;
          const cId = getTargetClusterId(e.target);
          if (cId) {
            metadataClusterEdgesCount[cId] = (metadataClusterEdgesCount[cId] || 0) + 1;
          }
        });

        outboundEdges.forEach((edge) => {
          const targetNode = nodes.find(n => n.id === edge.target);

          // The GSA's processed-packet edge only goes to a TA/HC chassis -
          // any other target (a leaf tool, a TAP, etc.) gets no packets at
          // all and shows as a blocked link rather than silently "working".
          if (isGigaSmartApplianceSource && packetEdgeIdSet.has(edge.id) && !isValidGsaPacketTarget(targetNode)) {
            blockedEdgeSet.add(edge.id);
            return;
          }

          activeEdgeSet.add(edge.id);

          const cId = getTargetClusterId(edge.target);
          const numLinks = (cId && clusterEdgesCount[cId] > 0) ? clusterEdgesCount[cId] : (edgesPerTarget[edge.target] || 1);
          const metadataNumLinks = (cId && metadataClusterEdgesCount[cId] > 0) ? metadataClusterEdgesCount[cId] : (metadataEdgesPerTarget[edge.target] || 1);
          const edgeForwardStream = (hasForwardStream && packetEdgeIdSet.has(edge.id)) ? { ...forwardStream!, bandwidth: forwardStream!.bandwidth / numLinks } : null;
          const edgeMetadataStreams = metadataEdgeIdSet.has(edge.id) ? generatedMetadataStreams.map(ms => ({ ...ms, bandwidth: ms.bandwidth / metadataNumLinks })) : [];

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
            // A storage tool fed packets *and* metadata down the same edge is
            // ambiguous, so packets lose out to metadata in that case - but a
            // node with a dedicated metadata-egress handle (the GSA's
            // "metadata-out") already routes metadata to its own edges, so an
            // S3 target on a separate packet-out edge should still get its packets.
            if (isStorageToolConfig(toolConfig) && hasMetadataStreams && !isMetadata && !hasMetadataOutboundEdges) canAccept = false;

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
        // Flag when the tool's configured (or vendor-default) ingest ceiling is exceeded —
        // takes priority over the blind-spot note below since a dropped/overloaded ingest
        // engine is the more actionable problem. Excluded for Mission Demo presentation nodes.
        const isMissionNode = node.id.startsWith('mission-') || Boolean(node.className?.includes('mission-demo-node'));
        if (isPacketTool && packetBandwidth > 0 && !mismatchMsg && !isMissionNode) {
          const rawLimit = data.ingestLimitMbps as number | undefined;
          const ingestLimit = (typeof rawLimit === 'number' && rawLimit > 0) ? rawLimit : getDefaultIngestLimitMbps(data.toolName as string | undefined);
          if (packetBandwidth > ingestLimit) {
            hasMismatch = true;
            mismatchMsg = `⚠️ Ingest Overloaded: ${formatBandwidth(packetBandwidth)} exceeds ${formatBandwidth(ingestLimit)} limit`;
          }
        }
        // Quantify the post-decryption blind spot: not all encrypted traffic reaching a
        // packet tool has necessarily skipped SSL Decrypt (some streams may bypass it),
        // so report what fraction of what actually arrived is still opaque.
        if (encryptedPacketBandwidth > 0 && !mismatchMsg && !isMissionNode) {
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
