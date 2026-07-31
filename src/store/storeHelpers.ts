import { type Edge } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { type CustomNode, type TrafficStream } from './types';
import { syncOpticsOnTapConnection } from '../utils/bomEngine';
import { syncPortAssignments } from '../utils/portSync';
import { CONFIG_TYPES } from '../constants/nodeTypes';

export const initialNodes: CustomNode[] = [
  {
    id: "node-input-1",
    type: "inputNode",
    position: { x: 27.5, y: 61.5 },
    data: {
      label: "TAP Device 1/1/x1 - Main Hall",
      configType: CONFIG_TYPES.TAP,
      linkSpeed: 40000
    }
  },
  {
    id: "node-input-tap-2",
    type: "inputNode",
    position: { x: 26.5, y: 136.5 },
    data: {
      label: "TAP Device 1/1/x2 - Site Two",
      configType: CONFIG_TYPES.TAP,
      linkSpeed: 10000
    }
  },
  {
    id: "node-input-tap-3",
    type: "inputNode",
    position: { x: 50, y: 220 },
    data: {
      label: "TAP Device 1/1/x3 - Production Floor A",
      configType: CONFIG_TYPES.TAP,
      linkSpeed: 10000
    }
  },
  {
    id: "node-input-tap-4",
    type: "inputNode",
    position: { x: 49.5, y: 301.5 },
    data: {
      label: "TAP Device 1/1/x4 Production Floor B",
      configType: CONFIG_TYPES.TAP,
      linkSpeed: 1000
    }
  },
  {
    id: "node-input-tap-5",
    type: "inputNode",
    position: { x: 41, y: 376.5 },
    data: {
      label: "TAP Device 1/1/x5 - Comms Room",
      configType: CONFIG_TYPES.TAP,
      linkSpeed: 25000
    }
  },
  {
    id: "node-input-tap-6",
    type: "inputNode",
    position: { x: 23, y: 451.5 },
    data: {
      label: "Juniper SPAN Port 1/1/x6 ",
      configType: CONFIG_TYPES.SPAN,
      linkSpeed: 40000
    }
  },
  {
    id: "node-map-1",
    type: "mapNode",
    position: { x: 428, y: 217 },
    data: {
      label: "Core Traffic Map",
      configType: CONFIG_TYPES.TRAFFIC_MAP,
      conditions: [
        { logic: "AND", field: "protocol", value: "tcp" },
        { logic: "AND", field: "vlan", value: "100, 200, 999" }
      ]
    }
  },
  {
    id: "node-tool-1",
    type: "toolNode",
    position: { x: 758, y: 145.5 },
    data: {
      label: "ExtraHop Tool",
      configType: CONFIG_TYPES.PACKET_TOOL,
      toolName: "ExtraHop",
      totalIngestedBytes: 81632270614.26353,
      statusMessage: "",
      receivedFormat: ""
    }
  }
];

export const initialEdges: Edge[] = [
  { id: "e1", source: "node-input-1", target: "node-map-1", sourceHandle: "out", targetHandle: "in" },
  { id: "e-tap-2", source: "node-input-tap-2", target: "node-map-1", sourceHandle: "out", targetHandle: "in" },
  { id: "e-tap-3", source: "node-input-tap-3", target: "node-map-1", sourceHandle: "out", targetHandle: "in" },
  { id: "e-tap-4", source: "node-input-tap-4", target: "node-map-1", sourceHandle: "out", targetHandle: "in" },
  { id: "e-tap-5", source: "node-input-tap-5", target: "node-map-1", sourceHandle: "out", targetHandle: "in" },
  { id: "e-tap-6", source: "node-input-tap-6", target: "node-map-1", sourceHandle: "out", targetHandle: "in" },
  { id: "e2", source: "node-map-1", target: "node-tool-1", sourceHandle: "out", targetHandle: "in" }
];

export const initialTraffic: TrafficStream[] = [
  {
    id: "t-1",
    name: "Web Prod Traffic (2 Gbps)",
    sourceNodeId: "node-input-1",
    vlan: "100",
    ipSrc: "192.168.1.0/24",
    ipDst: "10.0.0.5",
    portSrc: "49152",
    portDst: "80",
    protocol: "tcp",
    bandwidth: 2000,
    active: true,
    drift: 1,
    lastDriftUpdate: 0
  },
  {
    id: "t-2",
    name: "DB Sync Traffic (1 Gbps)",
    sourceNodeId: "node-input-1",
    vlan: "200",
    ipSrc: "192.168.2.11",
    ipDst: "10.0.0.10",
    portSrc: "5432",
    portDst: "5432",
    protocol: "tcp",
    bandwidth: 1000,
    active: true,
    drift: 1,
    lastDriftUpdate: 0
  },
  {
    id: "t-3",
    name: "DNS Query Flood (1.5 Gbps)",
    sourceNodeId: "node-input-1",
    vlan: "100",
    ipSrc: "192.168.1.15",
    ipDst: "8.8.8.8",
    portSrc: "60124",
    portDst: "53",
    protocol: "udp",
    bandwidth: 1500,
    active: true,
    drift: 1,
    lastDriftUpdate: 0
  },
  {
    id: "t-4",
    name: "IPv6 Sync Flow (35 Gbps)",
    sourceNodeId: "node-input-1",
    vlan: "999",
    ipSrc: "2001:db8::1",
    ipDst: "2001:db8::2",
    portSrc: "8080",
    portDst: "8080",
    protocol: "tcp",
    bandwidth: 35000,
    active: true,
    drift: 1,
    lastDriftUpdate: 0
  },
  {
    id: "t-tap-2",
    name: "TAP 2 Flow (10 Gbps)",
    sourceNodeId: "node-input-tap-2",
    vlan: "100",
    ipSrc: "192.168.10.2",
    ipDst: "10.0.0.20",
    portSrc: "50002",
    portDst: "80",
    protocol: "tcp",
    bandwidth: 10000,
    active: true,
    drift: 1,
    lastDriftUpdate: 0
  },
  {
    id: "t-tap-3",
    name: "TAP 3 Flow (5 Gbps)",
    sourceNodeId: "node-input-tap-3",
    vlan: "200",
    ipSrc: "192.168.10.3",
    ipDst: "10.0.0.30",
    portSrc: "50003",
    portDst: "80",
    protocol: "tcp",
    bandwidth: 5000,
    active: true,
    drift: 1,
    lastDriftUpdate: 0
  },
  {
    id: "t-tap-4",
    name: "TAP 4 Flow (10 Mbps)",
    sourceNodeId: "node-input-tap-4",
    vlan: "100",
    ipSrc: "192.168.10.4",
    ipDst: "10.0.0.40",
    portSrc: "50004",
    portDst: "80",
    protocol: "tcp",
    bandwidth: 10,
    active: true,
    drift: 1,
    lastDriftUpdate: 0
  },
  {
    id: "t-tap-5",
    name: "TAP 5 Flow (15 Gbps)",
    sourceNodeId: "node-input-tap-5",
    vlan: "100",
    ipSrc: "192.168.10.5",
    ipDst: "10.0.0.50",
    portSrc: "50005",
    portDst: "80",
    protocol: "tcp",
    bandwidth: 15000,
    active: true,
    drift: 1,
    lastDriftUpdate: 0
  },
  {
    id: "t-tap-6",
    name: "SPAN 6 Flow (42 Gbps)",
    sourceNodeId: "node-input-tap-6",
    vlan: "100",
    ipSrc: "192.168.10.6",
    ipDst: "10.0.0.60",
    portSrc: "50006",
    portDst: "80",
    protocol: "tcp",
    bandwidth: 42000,
    active: true,
    drift: 1,
    lastDriftUpdate: 0
  }
];

export function syncSplunkLabels(nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  return nodes.map(node => {
    const toolName = (node.data?.toolName as string) || '';
    if (toolName === 'Splunk') {
      const currentLabel = (node.data?.label as string) || '';
      if (
        currentLabel === 'Splunk Collector' || 
        currentLabel === 'Splunk Tool' || 
        currentLabel === 'Splunk Federated Search'
      ) {
        const isLinkedToS3 = edges.some(edge => {
          if (edge.source === node.id || edge.target === node.id) {
            const otherNodeId = edge.source === node.id ? edge.target : edge.source;
            const otherNode = nodes.find(n => n.id === otherNodeId);
            return otherNode?.data?.configType === 'Objects' || otherNode?.data?.configType === 'Storage Tool';
          }
          return false;
        });

        const targetLabel = isLinkedToS3 ? 'Splunk Federated Search' : 'Splunk Collector';
        if (currentLabel !== targetLabel) {
          return {
            ...node,
            data: {
              ...node.data,
              label: targetLabel
            }
          };
        }
      }
    }
    return node;
  });
}

export function performDuplicateSolution(
  newSiteName: string,
  allNodes: CustomNode[],
  allEdges: Edge[],
  allStreams: TrafficStream[]
) {
  const selectedNodes = allNodes.filter(n => n.selected);
  
  let nodesToDuplicate = [...selectedNodes];
  if (selectedNodes.length > 0) {
    const selectedGroupIds = new Set(selectedNodes.filter(n => n.type === 'groupNode').map(n => n.id));
    if (selectedGroupIds.size > 0) {
      allNodes.forEach(node => {
        if (node.parentId && selectedGroupIds.has(node.parentId) && !nodesToDuplicate.some(n => n.id === node.id)) {
          nodesToDuplicate.push(node);
        }
      });
    }
  } else {
    nodesToDuplicate = allNodes;
  }

  if (nodesToDuplicate.length === 0) return null;

  const duplicatedNodeIds = new Set(nodesToDuplicate.map(n => n.id));
  const edgesToDuplicate = allEdges.filter(
    edge => duplicatedNodeIds.has(edge.source) && duplicatedNodeIds.has(edge.target)
  );

  const streamsToDuplicate = allStreams.filter(
    stream => duplicatedNodeIds.has(stream.sourceNodeId)
  );

  let minX = Infinity;
  let maxX = -Infinity;
  nodesToDuplicate.forEach((node) => {
    let absX = node.position.x;
    if (node.parentId) {
      const parentNode = allNodes.find((n) => n.id === node.parentId);
      if (parentNode) {
        absX += parentNode.position.x;
      }
    }
    if (absX < minX) minX = absX;
    if (absX > maxX) maxX = absX;
  });

  const width = maxX - minX;
  const shiftX = Math.max(600, width + 200);

  const idMap: Record<string, string> = {};
  nodesToDuplicate.forEach((node) => {
    idMap[node.id] = `${node.type}-${uuidv4()}`;
  });

  const newNodes = nodesToDuplicate.map((node) => {
    const newId = idMap[node.id];
    const newParentId = node.parentId ? idMap[node.parentId] : undefined;
    
    const dataCopy = { ...node.data };
    dataCopy.site = newSiteName;
    if (dataCopy.gigaSmartApps && Array.isArray(dataCopy.gigaSmartApps)) {
      dataCopy.gigaSmartApps = dataCopy.gigaSmartApps.map((app) => ({
        ...app,
        id: `gs-${uuidv4()}`,
      }));
    }

    return {
      ...node,
      id: newId,
      parentId: newParentId,
      position: {
        x: node.position.x + (node.parentId ? 0 : shiftX),
        y: node.position.y,
      },
      data: dataCopy,
      selected: false,
    };
  });

  const newEdges = edgesToDuplicate
    .map((edge) => {
      const newSource = idMap[edge.source];
      const newTarget = idMap[edge.target];
      if (!newSource || !newTarget) return null;
      return {
        ...edge,
        id: `e-${uuidv4()}`,
        source: newSource,
        target: newTarget,
      };
    })
    .filter((e): e is Edge => e !== null);

  const newStreams = streamsToDuplicate
    .map((stream) => {
      const newSourceNodeId = idMap[stream.sourceNodeId];
      if (!newSourceNodeId) return null;
      return {
        ...stream,
        id: `t-${uuidv4()}`,
        sourceNodeId: newSourceNodeId,
      };
    })
    .filter((s): s is TrafficStream => s !== null);

  const resetCurrentNodes = allNodes.map(n => ({ ...n, selected: false }));
  const combinedNodes = [...resetCurrentNodes, ...newNodes];
  const combinedEdges = [...allEdges.map(e => ({ ...e, selected: false })), ...newEdges];
  
  let syncedNodes = syncSplunkLabels(combinedNodes, combinedEdges);
  syncedNodes = syncOpticsOnTapConnection(syncedNodes, combinedEdges);

  return {
    nodes: syncedNodes,
    edges: syncPortAssignments(syncedNodes, combinedEdges),
    trafficStreams: [...allStreams, ...newStreams]
  };
}
