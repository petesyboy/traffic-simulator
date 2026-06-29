import { create } from 'zustand';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { NODE_TYPES } from '../constants/nodeTypes';
import { syncOpticsOnTapConnection } from '../utils/bomEngine';

export interface TrafficStream {
  id: string;
  name: string;
  sourceNodeId: string;
  vlan: string;
  ipSrc: string;
  ipDst: string;
  portSrc: string;
  portDst: string;
  protocol: string;
  bandwidth: number; // in Mbps
  active: boolean;
  drift?: number;
  lastDriftUpdate?: number;
}

export interface NodeMetrics {
  rxBps: number;
  txBps: number;
  rxPackets: number;
  txPackets: number;
  droppedPackets: number; // total drops (legacy/catch-all)
  dedupDroppedBps?: number;
  filterDroppedBps?: number;
}

export interface MapCondition {
  logic?: 'AND' | 'OR';
  field: string;
  value: string;
  action?: 'pass' | 'drop';
}

export type NodeType = 
  | 'inputNode' 
  | 'mapNode' 
  | 'filterNode' 
  | 'toolNode' 
  | 'gigaSmartNode' 
  | 'gigaStreamNode' 
  | 'groupNode';

export interface BaseNodeData {
  label: string;
  configType: string;
  status?: 'optimal' | 'warning' | 'error';
  statusMessage?: string;
  receivedFormat?: string;
  totalIngestedBytes?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Add index signature
}

export interface HardwareNodeData extends BaseNodeData {
  gigaSmartApps?: GigaSmartNodeData[];
}

export interface InputNodeData extends BaseNodeData {
  configType: 'SPAN Port' | 'Network Tap' | 'Virtual TAP' | 'GigaVUE-VM';
}

export interface MapNodeData extends BaseNodeData {
  configType: 'Traffic Map';
  conditions: MapCondition[];
}

export interface FilterNodeData extends BaseNodeData {
  configType: 'VLAN Filter' | 'IP Subnet Filter' | 'Port Filter';
  vlanIds?: string;
  ipSubnet?: string;
  ports?: string;
}

export interface GigaSmartNodeData extends BaseNodeData {
  actionType: string;
  dedupRate?: number;
  lastDedupUpdate?: number;
  metadataFormat?: 'CEF' | 'JSON';
}

export interface ToolNodeData extends BaseNodeData {
  expectedFormat?: string;
}

export type CustomNode = Node<BaseNodeData>;

export type RFState = {
  nodes: CustomNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  isRunning: boolean;
  simulationSpeed: number; // multiplier, e.g. 1
  advancedMode: boolean;
  advancedModeUnlocked: boolean;
  projectLicenseMode: 'HTL' | 'Perpetual';
  defaultTermDuration: string;
  disableDcWarnings: boolean;
  trafficStreams: TrafficStream[];
  nodeMetrics: Record<string, NodeMetrics>;
  edgeMetrics: Record<string, number>;
  activeEdges: string[];
  blockedEdges: string[];
  deliveredStreams: string[];
  uniqueEgressBps: number;
  fitViewTrigger: number;
  sidebarMessage: string | null;
  setSidebarMessage: (msg: string | null) => void;
  onNodesChange: (changes: NodeChange<CustomNode>[]) => void;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setEdges: (edges: Edge[]) => void;
  draggedNodeType: string | null;
  setDraggedNodeType: (type: string | null) => void;
  addNode: (node: CustomNode) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => void;
  restoreState: (nodes: CustomNode[], edges: Edge[], trafficStreams?: TrafficStream[]) => void;
  toggleSimulation: () => void;
  setSimulationSpeed: (speed: number) => void;
  setAdvancedMode: (mode: boolean) => void;
  setAdvancedModeUnlocked: (unlocked: boolean) => void;
  setProjectLicenseMode: (mode: 'HTL' | 'Perpetual') => void;
  setDefaultTermDuration: (duration: string) => void;
  setDisableDcWarnings: (disable: boolean) => void;
  showGrid: boolean;
  snapToGrid: boolean;
  setShowGrid: (show: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  snapAllNodesToGrid: () => void;
  addTrafficStream: (stream: TrafficStream) => void;
  updateTrafficStream: (id: string, stream: Partial<TrafficStream>) => void;
  deleteTrafficStream: (id: string) => void;
  resetMetrics: () => void;
  updateSimulationTick: (
    metrics: Record<string, NodeMetrics>,
    edgeMetrics: Record<string, number>,
    activeEdges: string[],
    blockedEdges: string[],
    deliveredStreams?: string[],
    /**
     * Per-node data patches: merged into each node's `data` object.
     * Replaces individual updateNodeData() calls from SimulationEngine,
     * which each triggered a separate Zustand set() and React re-render.
     */
    nodeDataPatches?: Record<string, Record<string, unknown>>,
    /**
     * Per-stream patches: merged into each TrafficStream.
     * Replaces individual updateTrafficStream() calls from SimulationEngine.
     */
    streamPatches?: Record<string, Partial<TrafficStream>>,
    uniqueEgressBps?: number,
  ) => void;
  clearCanvas: () => void;
  loadDemo: () => void;
  groupSelectedNodes: () => void;
  ungroupGroup: (groupId: string) => void;
};

/**
 * Toggles a Splunk node's label between 'Splunk Federated Search' and 'Splunk Collector' 
 * based on whether it is connected/linked to an S3/Object Storage node.
 */
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
            return otherNode?.data?.configType === 'Storage Tool'; // Storage Tool is CONFIG_TYPES.STORAGE_TOOL
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



// Create a default topology

const initialNodes: CustomNode[] = [
  {
    id: "node-input-1",
    type: "inputNode",
    position: {
      x: 27.5,
      y: 61.5
    },
    data: {
      label: "TAP Device 1/1/x1 - Main Hall",
      configType: "TAP Device",
      linkSpeed: 40000
    }
  },
  {
    id: "node-input-tap-2",
    type: "inputNode",
    position: {
      x: 26.5,
      y: 136.5
    },
    data: {
      label: "TAP Device 1/1/x2 - Site Two",
      configType: "TAP Device",
      linkSpeed: 10000
    }
  },
  {
    id: "node-input-tap-3",
    type: "inputNode",
    position: {
      x: 50,
      y: 220
    },
    data: {
      label: "TAP Device 1/1/x3 - Production Floor A",
      configType: "TAP Device",
      linkSpeed: 10000
    }
  },
  {
    id: "node-input-tap-4",
    type: "inputNode",
    position: {
      x: 49.5,
      y: 301.5
    },
    data: {
      label: "TAP Device 1/1/x4 Production Floor B",
      configType: "TAP Device",
      linkSpeed: 1000
    }
  },
  {
    id: "node-input-tap-5",
    type: "inputNode",
    position: {
      x: 41,
      y: 376.5
    },
    data: {
      label: "TAP Device 1/1/x5 - Comms Room",
      configType: "TAP Device",
      linkSpeed: 25000
    }
  },
  {
    id: "node-input-tap-6",
    type: "inputNode",
    position: {
      x: 23,
      y: 451.5
    },
    data: {
      label: "Juniper SPAN Port 1/1/x6 ",
      configType: "SPAN Port",
      linkSpeed: 40000
    }
  },
  {
    id: "node-map-1",
    type: "mapNode",
    position: {
      x: 428,
      y: 217
    },
    data: {
      label: "Core Traffic Map",
      configType: "Traffic Map",
      conditions: [
        {
          logic: "AND",
          field: "protocol",
          value: "tcp"
        },
        {
          logic: "AND",
          field: "vlan",
          value: "100, 200, 999"
        }
      ]
    }
  },
  {
    id: "node-tool-1",
    type: "toolNode",
    position: {
      x: 758,
      y: 145.5
    },
    data: {
      label: "ExtraHop Tool",
      configType: "ExtraHop",
      totalIngestedBytes: 81632270614.26353,
      statusMessage: "",
      receivedFormat: ""
    }
  }
];

const initialEdges: Edge[] = [
  {
    id: "e1",
    source: "node-input-1",
    target: "node-map-1",
    sourceHandle: "out",
    targetHandle: "in"
  },
  {
    id: "e-tap-2",
    source: "node-input-tap-2",
    target: "node-map-1",
    sourceHandle: "out",
    targetHandle: "in"
  },
  {
    id: "e-tap-3",
    source: "node-input-tap-3",
    target: "node-map-1",
    sourceHandle: "out",
    targetHandle: "in"
  },
  {
    id: "e-tap-4",
    source: "node-input-tap-4",
    target: "node-map-1",
    sourceHandle: "out",
    targetHandle: "in"
  },
  {
    id: "e-tap-5",
    source: "node-input-tap-5",
    target: "node-map-1",
    sourceHandle: "out",
    targetHandle: "in"
  },
  {
    id: "e-tap-6",
    source: "node-input-tap-6",
    target: "node-map-1",
    sourceHandle: "out",
    targetHandle: "in"
  },
  {
    id: "e2",
    source: "node-map-1",
    target: "node-tool-1",
    sourceHandle: "out",
    targetHandle: "in"
  }
];

const initialTraffic: TrafficStream[] = [
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

export const useStore = create<RFState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,
  isRunning: false,
  simulationSpeed: 1,
  advancedMode: false,
  advancedModeUnlocked: false,
  projectLicenseMode: 'HTL',
  defaultTermDuration: '36',
  disableDcWarnings: false,
  draggedNodeType: null,
  showGrid: true,
  snapToGrid: false,
  trafficStreams: initialTraffic,
  nodeMetrics: {},
  edgeMetrics: {},
  activeEdges: [],
  blockedEdges: [],
  deliveredStreams: [],
  uniqueEgressBps: 0,
  fitViewTrigger: 0,
  sidebarMessage: null,
  setSidebarMessage: (msg) => set({ sidebarMessage: msg }),
  
  onNodesChange: (changes: NodeChange<CustomNode>[]) => {
    let nextNodes = applyNodeChanges<CustomNode>(changes, get().nodes);
    const deletedNodeIds = changes
      .filter((c) => c.type === 'remove')
      .map((c) => (c as { id: string }).id);

    const deletedGroupNodeIds = deletedNodeIds.filter((id) => id.includes('group'));

    if (deletedGroupNodeIds.length > 0) {
      // When a group node is deleted, un-nest its children:
      // remove their parentId and convert their relative position back to absolute.
      nextNodes = nextNodes.map((node) => {
        if (node.parentId && deletedGroupNodeIds.includes(node.parentId)) {
          const parentNode = get().nodes.find((n) => n.id === node.parentId);
          const parentX = parentNode?.position.x || 0;
          const parentY = parentNode?.position.y || 0;
          const parentWidth = (parentNode?.width as number) || (parentNode?.style?.width as number) || 0;
          const parentHeight = (parentNode?.height as number) || (parentNode?.style?.height as number) || 0;
          
          const parentTopLeftX = parentX - parentWidth / 2;
          const parentTopLeftY = parentY - parentHeight / 2;

          return {
            ...node,
            parentId: undefined,
            position: {
              x: node.position.x + parentTopLeftX,
              y: node.position.y + parentTopLeftY,
            },
            extent: undefined,
          };
        }
        return node;
      });
    }

    if (deletedNodeIds.length > 0) {
      // Also remove any traffic streams whose source node was just deleted
      const nextTraffic = get().trafficStreams.filter(
        (s) => !deletedNodeIds.includes(s.sourceNodeId)
      );
      set({ nodes: nextNodes, trafficStreams: nextTraffic });
    } else {
      set({ nodes: nextNodes });
    }
  },
  
  onEdgesChange: (changes: EdgeChange[]) => {
    const nextEdges = applyEdgeChanges(changes, get().edges);
    let syncedNodes = syncSplunkLabels(get().nodes, nextEdges);
    syncedNodes = syncOpticsOnTapConnection(syncedNodes, nextEdges);
    set({ edges: nextEdges, nodes: syncedNodes });
  },
  
  onConnect: (connection: Connection) => {
    const nodeA = get().nodes.find(n => n.id === connection.source);
    const nodeB = get().nodes.find(n => n.id === connection.target);
    if (!nodeA || !nodeB) return;

    const sourceNode = (nodeA.type === 'hardwareNode' && String(nodeA.data?.model || '').includes('TAP')) || (nodeA.type === 'inputNode' && nodeA.data?.configType === 'TAP') ? nodeA : ((nodeB.type === 'hardwareNode' && String(nodeB.data?.model || '').includes('TAP')) || (nodeB.type === 'inputNode' && nodeB.data?.configType === 'TAP') ? nodeB : null);
    const targetNode = sourceNode === nodeA ? nodeB : (sourceNode === nodeB ? nodeA : null);

    if (sourceNode && targetNode && targetNode.type === 'hardwareNode' && (String(targetNode.data?.model || '').includes('HC') || String(targetNode.data?.model || '').includes('TA'))) {
      const tapSku = String(sourceNode.data?.sku || '');
      const tapModel = String(sourceNode.data?.model || '');
      
      const isSMTap = tapSku.includes('253') || tapSku.includes('273') || tapSku.includes('453') || tapModel.toLowerCase().includes('single-mode') || tapModel.toLowerCase().includes('sm') || tapModel.includes('253T') || tapModel.includes('273T') || tapModel.includes('453T');
      
      const tapFiber = isSMTap ? 'Singlemode' : 'Multimode';

      const installedOptics = (targetNode.data?.optics as { board: string, optic: string, qty: number }[]) || [];
      let mmCount = 0;
      let smCount = 0;
      installedOptics.forEach(opt => {
        const name = opt.optic.toUpperCase();
        const isOpticMM = name.includes('SR') || name.includes('SX') || name.includes('SWDM') || name.includes('FX');
        const isOpticSM = name.includes('LR') || name.includes('LX') || name.includes('ER') || name.includes('PLR') || name.includes('DR1') || name.includes('CWDM') || name.includes('FR');
        if (isOpticMM) mmCount += opt.qty;
        else if (isOpticSM) smCount += opt.qty;
      });

      const tappedLinks = (sourceNode.data?.tappedLinksCount as number) ?? 1;
      const requiredOptics = tappedLinks * 2;

      const defaultOptic = isSMTap ? 'SFP-533 (10G SFP+ LR)' : 'SFP-532 (10G SFP+ SR)';
      const selectedOpticVal = (sourceNode.data?.tappedLinkOptic as string) || defaultOptic;

      let addedOpticsMsg = '';
      let updatedOptics = [...installedOptics];

      if (tapFiber === 'Multimode') {
        if (mmCount < requiredOptics) {
          const needed = requiredOptics - mmCount;
          const idx = updatedOptics.findIndex(opt => opt.optic === selectedOpticVal);
          if (idx >= 0) {
            updatedOptics[idx] = { ...updatedOptics[idx], qty: updatedOptics[idx].qty + needed };
          } else {
            updatedOptics.push({ board: 'Base Ports', optic: selectedOpticVal, qty: needed });
          }
          addedOpticsMsg = `Suggested and installed ${needed} x ${selectedOpticVal} multi-mode optics in ${targetNode.data.model} to support the connection from ${sourceNode.data.label || 'TAP'}.`;
        }
      } else if (tapFiber === 'Singlemode') {
        if (smCount < requiredOptics) {
          const needed = requiredOptics - smCount;
          const idx = updatedOptics.findIndex(opt => opt.optic === selectedOpticVal);
          if (idx >= 0) {
            updatedOptics[idx] = { ...updatedOptics[idx], qty: updatedOptics[idx].qty + needed };
          } else {
            updatedOptics.push({ board: 'Base Ports', optic: selectedOpticVal, qty: needed });
          }
          addedOpticsMsg = `Suggested and installed ${needed} x ${selectedOpticVal} single-mode optics in ${targetNode.data.model} to support the connection from ${sourceNode.data.label || 'TAP'}.`;
        }
      }

      if (addedOpticsMsg) {
        set({
          nodes: get().nodes.map(n => n.id === targetNode.id ? { ...n, data: { ...n.data, optics: updatedOptics } } : n),
          sidebarMessage: addedOpticsMsg
        });
      }
    }

    const newEdge: Edge = {
      ...connection,
      id: `e-${uuidv4()}`,
    };
    const nextEdges = addEdge(newEdge, get().edges);
    let syncedNodes = syncSplunkLabels(get().nodes, nextEdges);
    syncedNodes = syncOpticsOnTapConnection(syncedNodes, nextEdges);
    set({ edges: nextEdges, nodes: syncedNodes });
  },

  setEdges: (edges: Edge[]) => {
    let syncedNodes = syncSplunkLabels(get().nodes, edges);
    syncedNodes = syncOpticsOnTapConnection(syncedNodes, edges);
    set({ edges, nodes: syncedNodes });
  },

  setDraggedNodeType: (type: string | null) => {
    set({ draggedNodeType: type });
  },
  
  addNode: (node: CustomNode) => {
    set({ nodes: get().nodes.concat(node) });
  },
  
  setSelectedNodeId: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId });
  },
  
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => {
    const updatedNodes = get().nodes.map((node) => 
      node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
    );
    let syncedNodes = syncSplunkLabels(updatedNodes, get().edges);
    if (data.optics === undefined) {
      syncedNodes = syncOpticsOnTapConnection(syncedNodes, get().edges);
    }
    set({
      nodes: syncedNodes,
    });
  },
  
  restoreState: (nodes: CustomNode[], edges: Edge[], trafficStreams?: TrafficStream[]) => {
    let syncedNodes = syncSplunkLabels(nodes, edges);
    syncedNodes = syncOpticsOnTapConnection(syncedNodes, edges);
    set({
      nodes: syncedNodes,
      edges,
      trafficStreams: trafficStreams || get().trafficStreams,
      fitViewTrigger: get().fitViewTrigger + 1
    });
  },
  
  toggleSimulation: () => {
    const nextRunning = !get().isRunning;
    if (!nextRunning) {
      // If stopping, reset active/blocked edge styles and traffic stream drifts
      const resetTraffic = get().trafficStreams.map((s) => ({
        ...s,
        drift: 1.0,
        lastDriftUpdate: 0,
      }));
      set({ 
        isRunning: false, 
        activeEdges: [], 
        blockedEdges: [], 
        trafficStreams: resetTraffic 
      });
    } else {
      set({ isRunning: true });
    }
  },

  setSimulationSpeed: (speed: number) => {
    set({ simulationSpeed: speed });
  },

  setAdvancedMode: (mode: boolean) => {
    set({ advancedMode: mode });
  },
  
  setAdvancedModeUnlocked: (unlocked: boolean) => {
    set({ advancedModeUnlocked: unlocked });
  },

  setProjectLicenseMode: (mode) => set({ projectLicenseMode: mode }),
  setDefaultTermDuration: (duration) => set({ defaultTermDuration: duration }),
  setDisableDcWarnings: (disable) => set({ disableDcWarnings: disable }),
  setShowGrid: (show) => set({ showGrid: show }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),

  snapAllNodesToGrid: () => {
    const snapped = get().nodes.map((node) => {
      const snapX = Math.round(node.position.x / 15) * 15;
      const snapY = Math.round(node.position.y / 15) * 15;
      return {
        ...node,
        position: { x: snapX, y: snapY }
      };
    });
    set({ nodes: snapped });
  },

  addTrafficStream: (stream: TrafficStream) => {
    set({ trafficStreams: [...get().trafficStreams, stream] });
  },

  updateTrafficStream: (id: string, stream: Partial<TrafficStream>) => {
    set({
      trafficStreams: get().trafficStreams.map((s) =>
        s.id === id ? { ...s, ...stream } : s
      ),
    });
  },

  deleteTrafficStream: (id: string) => {
    set({
      trafficStreams: get().trafficStreams.filter((s) => s.id !== id),
    });
  },

  resetMetrics: () => {
    const resetNodes = get().nodes.map(n => ({ ...n, data: { ...n.data, totalIngestedBytes: 0 } }));
    set({ 
      nodeMetrics: {}, 
      activeEdges: [], 
      blockedEdges: [], 
      deliveredStreams: [],
      uniqueEgressBps: 0,
      nodes: syncSplunkLabels(resetNodes, get().edges)
    });
  },

  updateSimulationTick: (
    metrics: Record<string, NodeMetrics>,
    edgeMetrics: Record<string, number>,
    activeEdges: string[],
    blockedEdges: string[],
    deliveredStreams?: string[],
    nodeDataPatches?: Record<string, Record<string, unknown>>,
    streamPatches?: Record<string, Partial<TrafficStream>>,
    uniqueEgressBps?: number,
  ) => {
    // Apply node-data patches (e.g. dedupRate drift, tool status)
    let nextNodes = get().nodes;
    
    // Accumulate total ingested bytes for tool nodes before applying other patches
    nextNodes = nextNodes.map((node) => {
      if (node.type === NODE_TYPES.TOOL) {
        const rxMbps = metrics[node.id]?.rxBps || 0;
        // Each tick represents 0.8 seconds of traffic
        const deltaBytes = (rxMbps * 1000000 / 8) * 0.8;
        const currentTotal = (node.data.totalIngestedBytes as number) || 0;
        return {
          ...node,
          data: {
            ...node.data,
            totalIngestedBytes: currentTotal + deltaBytes,
          },
        };
      }
      return node;
    });

    if (nodeDataPatches && Object.keys(nodeDataPatches).length > 0) {
      nextNodes = nextNodes.map((node) =>
        nodeDataPatches[node.id]
          ? { ...node, data: { ...node.data, ...nodeDataPatches[node.id] } }
          : node
      );
    }

    // Apply traffic stream patches (e.g. bandwidth drift)
    let nextStreams = get().trafficStreams;
    if (streamPatches && Object.keys(streamPatches).length > 0) {
      nextStreams = nextStreams.map((s) =>
        streamPatches[s.id] ? { ...s, ...streamPatches[s.id] } : s
      );
    }

    // ONE Zustand set() call → ONE React re-render per tick
    set({
      nodeMetrics: metrics,
      edgeMetrics,
      activeEdges,
      blockedEdges,
      deliveredStreams: deliveredStreams || [],
      nodes: nextNodes,
      trafficStreams: nextStreams,
      uniqueEgressBps: uniqueEgressBps ?? 0,
    });
  },

  clearCanvas: () => {
    set({ nodes: [], edges: [], selectedNodeId: null, isRunning: false, activeEdges: [], blockedEdges: [], trafficStreams: [], deliveredStreams: [], uniqueEgressBps: 0 });
  },

  loadDemo: () => {
    let syncedNodes = syncSplunkLabels(initialNodes, initialEdges);
    syncedNodes = syncOpticsOnTapConnection(syncedNodes, initialEdges);
    set({
      nodes: syncedNodes,
      edges: initialEdges,
      selectedNodeId: null,
      isRunning: false,
      activeEdges: [],
      blockedEdges: [],
      trafficStreams: initialTraffic,
      deliveredStreams: [],
      uniqueEgressBps: 0,
      fitViewTrigger: get().fitViewTrigger + 1
    });
  },

  groupSelectedNodes: () => {
    // Only input port nodes can be grouped — they represent physical switch/tap ports
    const selectedNodes = get().nodes.filter(
      (n) => n.selected && n.type === NODE_TYPES.INPUT
    );
    if (selectedNodes.length < 2) return;

    // 1. Calculate bounding box
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    selectedNodes.forEach((node) => {
      const { x, y } = node.position;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const parentX = minX - 25;
    const parentY = minY - 45;
    const parentWidth = (maxX - minX) + 170 + 50;
    const parentHeight = (maxY - minY) + 75 + 70;

    const groupId = `group-${uuidv4()}`;

    // 2. Create the group node
    const groupNode: CustomNode = {
      id: groupId,
      type: 'groupNode',
      position: { x: parentX, y: parentY },
      style: { width: parentWidth, height: parentHeight },
      data: { label: 'Port Group', configType: 'Port Group' },
    };

    // Update child nodes to be nested inside the group
    const updatedNodes = get().nodes.map((node) => {
      if (node.selected && node.type === NODE_TYPES.INPUT) {
        return {
          ...node,
          parentId: groupId,
          position: {
            x: node.position.x - parentX,
            y: node.position.y - parentY,
          },
          extent: 'parent' as const,
          selected: false, // deselect child node
        };
      }
      return node;
    });

    set({
      nodes: [groupNode, ...updatedNodes],
    });
  },

  ungroupGroup: (groupId: string) => {
    const parentNode = get().nodes.find((n) => n.id === groupId);
    if (!parentNode) return;

    const parentX = parentNode.position.x;
    const parentY = parentNode.position.y;
    const parentWidth = (parentNode.width as number) || (parentNode.style?.width as number) || 0;
    const parentHeight = (parentNode.height as number) || (parentNode.style?.height as number) || 0;
    
    const parentTopLeftX = parentX - parentWidth / 2;
    const parentTopLeftY = parentY - parentHeight / 2;

    // 1. Un-nest child nodes: remove parentId, restore absolute position
    let updatedNodes = get().nodes.map((node) => {
      if (node.parentId === groupId) {
        return {
          ...node,
          parentId: undefined,
          position: {
            x: node.position.x + parentTopLeftX,
            y: node.position.y + parentTopLeftY,
          },
          extent: undefined,
        };
      }
      return node;
    });

    // 2. Remove the group node
    updatedNodes = updatedNodes.filter((n) => n.id !== groupId);

    // 3. Remove any edges connected to the group node
    const updatedEdges = get().edges.filter(
      (edge) => edge.source !== groupId && edge.target !== groupId
    );

    set({
      nodes: syncSplunkLabels(updatedNodes, updatedEdges),
      edges: updatedEdges,
      selectedNodeId: get().selectedNodeId === groupId ? null : get().selectedNodeId,
    });
  },
}));