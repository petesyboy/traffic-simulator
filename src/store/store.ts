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
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

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
  droppedPackets: number;
}

export interface MapCondition {
  logic?: 'AND' | 'OR';
  field: string;
  value: string;
  action?: 'pass' | 'drop';
}

export type RFState = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  isRunning: boolean;
  simulationSpeed: number; // multiplier, e.g. 1
  trafficStreams: TrafficStream[];
  nodeMetrics: Record<string, NodeMetrics>;
  activeEdges: string[];
  blockedEdges: string[];
  deliveredStreams: string[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  restoreState: (nodes: Node[], edges: Edge[], trafficStreams?: TrafficStream[]) => void;
  toggleSimulation: () => void;
  setSimulationSpeed: (speed: number) => void;
  addTrafficStream: (stream: TrafficStream) => void;
  updateTrafficStream: (id: string, stream: Partial<TrafficStream>) => void;
  deleteTrafficStream: (id: string) => void;
  resetMetrics: () => void;
  updateSimulationTick: (metrics: Record<string, NodeMetrics>, activeEdges: string[], blockedEdges: string[], deliveredStreams?: string[]) => void;
  clearCanvas: () => void;
  loadDemo: () => void;
  groupSelectedNodes: () => void;
  ungroupGroup: (groupId: string) => void;
};

// Create a default topology
const defaultInputId = 'node-input-1';
const defaultMapId = 'node-map-1';
const defaultVlanFilterId = 'node-filter-1';
const defaultPortFilterId = 'node-filter-2';
const defaultToolHopId = 'node-tool-1';
const defaultToolVectraId = 'node-tool-2';

const initialNodes: Node[] = [
  {
    id: defaultInputId,
    type: 'inputNode',
    position: { x: 80, y: 180 },
    data: { label: 'SPAN Port 1/1/x1', configType: 'SPAN Port' },
  },
  {
    id: defaultMapId,
    type: 'mapNode',
    position: { x: 300, y: 180 },
    data: { 
      label: 'Core Traffic Map', 
      configType: 'Traffic Map',
      conditions: [
        { logic: 'AND', field: 'protocol', value: 'tcp' }
      ]
    },
  },
  {
    id: defaultVlanFilterId,
    type: 'filterNode',
    position: { x: 550, y: 100 },
    data: { label: 'VLAN 100 Filter', configType: 'VLAN Filter', vlanIds: '100' },
  },
  {
    id: defaultPortFilterId,
    type: 'filterNode',
    position: { x: 550, y: 260 },
    data: { label: 'Port 80 Filter', configType: 'Port Filter', ports: '80' },
  },
  {
    id: defaultToolHopId,
    type: 'toolNode',
    position: { x: 800, y: 100 },
    data: { label: 'ExtraHop Tool', configType: 'ExtraHop' },
  },
  {
    id: defaultToolVectraId,
    type: 'toolNode',
    position: { x: 800, y: 260 },
    data: { label: 'Vectra AI Tool', configType: 'Vectra' },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: defaultInputId, target: defaultMapId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e2', source: defaultMapId, target: defaultVlanFilterId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e3', source: defaultMapId, target: defaultPortFilterId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e4', source: defaultVlanFilterId, target: defaultToolHopId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e5', source: defaultPortFilterId, target: defaultToolVectraId, sourceHandle: 'out', targetHandle: 'in' },
];

const initialTraffic: TrafficStream[] = [
  {
    id: 't-1',
    name: 'Web Prod Traffic (10 Gbps)',
    sourceNodeId: defaultInputId,
    vlan: '100',
    ipSrc: '192.168.1.0/24',
    ipDst: '10.0.0.5',
    portSrc: '49152',
    portDst: '80',
    protocol: 'tcp',
    bandwidth: 10000, // 10 Gbps
    active: true,
  },
  {
    id: 't-2',
    name: 'DB Sync Traffic (1 Gbps)',
    sourceNodeId: defaultInputId,
    vlan: '200',
    ipSrc: '192.168.2.11',
    ipDst: '10.0.0.10',
    portSrc: '5432',
    portDst: '5432',
    protocol: 'tcp',
    bandwidth: 1000, // 1 Gbps
    active: true,
  },
  {
    id: 't-3',
    name: 'DNS Query Flood (1 Gbps)',
    sourceNodeId: defaultInputId,
    vlan: '100',
    ipSrc: '192.168.1.15',
    ipDst: '8.8.8.8',
    portSrc: '60124',
    portDst: '53',
    protocol: 'udp',
    bandwidth: 1000, // 1 Gbps
    active: true,
  },
  {
    id: 't-4',
    name: 'IPv6 Sync Flow (10 Gbps)',
    sourceNodeId: defaultInputId,
    vlan: '300',
    ipSrc: '2001:db8::1',
    ipDst: '2001:db8::2',
    portSrc: '8080',
    portDst: '8080',
    protocol: 'tcp',
    bandwidth: 10000, // 10 Gbps
    active: true,
  }
];

export const useStore = create<RFState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,
  isRunning: false,
  simulationSpeed: 1,
  trafficStreams: initialTraffic,
  nodeMetrics: {},
  activeEdges: [],
  blockedEdges: [],
  deliveredStreams: [],
  
  onNodesChange: (changes: NodeChange[]) => {
    let nextNodes = applyNodeChanges(changes, get().nodes);
    const deletedNodeIds = changes
      .filter((c) => c.type === 'remove')
      .map((c) => (c as { id: string }).id);
      
    const deletedGroupNodeIds = deletedNodeIds.filter((id) => id.includes('group'));
    
    if (deletedGroupNodeIds.length > 0) {
      // Un-nest child nodes: remove parentId, restore absolute position
      nextNodes = nextNodes.map((node) => {
        if (node.parentId && deletedGroupNodeIds.includes(node.parentId)) {
          const parentNode = get().nodes.find((n) => n.id === node.parentId);
          const parentX = parentNode?.position.x || 0;
          const parentY = parentNode?.position.y || 0;
          return {
            ...node,
            parentId: undefined,
            position: {
              x: node.position.x + parentX,
              y: node.position.y + parentY,
            },
            extent: undefined,
          };
        }
        return node;
      });
    }

    if (deletedNodeIds.length > 0) {
      const nextTraffic = get().trafficStreams.filter(
        (s) => !deletedNodeIds.includes(s.sourceNodeId)
      );
      set({ nodes: nextNodes, trafficStreams: nextTraffic });
    } else {
      set({ nodes: nextNodes });
    }
  },
  
  onEdgesChange: (changes: EdgeChange[]) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  
  onConnect: (connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `e-${uuidv4()}`,
    };
    set({ edges: addEdge(newEdge, get().edges) });
  },
  
  addNode: (node: Node) => {
    set({ nodes: get().nodes.concat(node) });
  },
  
  setSelectedNodeId: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId });
  },
  
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => {
    set({
      nodes: get().nodes.map((node) => 
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
  },
  
  restoreState: (nodes: Node[], edges: Edge[], trafficStreams?: TrafficStream[]) => {
    set({
      nodes,
      edges,
      trafficStreams: trafficStreams || get().trafficStreams
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
    set({ nodeMetrics: {}, activeEdges: [], blockedEdges: [], deliveredStreams: [] });
  },

  updateSimulationTick: (metrics: Record<string, NodeMetrics>, activeEdges: string[], blockedEdges: string[], deliveredStreams?: string[]) => {
    set({
      nodeMetrics: metrics,
      activeEdges,
      blockedEdges,
      deliveredStreams: deliveredStreams || [],
    });
  },

  clearCanvas: () => {
    set({ nodes: [], edges: [], selectedNodeId: null, isRunning: false, activeEdges: [], blockedEdges: [], trafficStreams: [], deliveredStreams: [] });
  },

  loadDemo: () => {
    set({
      nodes: initialNodes,
      edges: initialEdges,
      selectedNodeId: null,
      isRunning: false,
      activeEdges: [],
      blockedEdges: [],
      trafficStreams: initialTraffic,
      deliveredStreams: [],
    });
  },

  groupSelectedNodes: () => {
    const selectedNodes = get().nodes.filter(
      (n) => n.selected && n.type === 'inputNode'
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
    const groupNode: Node = {
      id: groupId,
      type: 'groupNode',
      position: { x: parentX, y: parentY },
      style: { width: parentWidth, height: parentHeight },
      data: { label: 'Port Group', configType: 'Port Group' },
    };

    // 3. Update child nodes to be nested
    const updatedNodes = get().nodes.map((node) => {
      if (node.selected && node.type === 'inputNode') {
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

    // 1. Un-nest child nodes: remove parentId, restore absolute position
    let updatedNodes = get().nodes.map((node) => {
      if (node.parentId === groupId) {
        return {
          ...node,
          parentId: undefined,
          position: {
            x: node.position.x + parentX,
            y: node.position.y + parentY,
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
      nodes: updatedNodes,
      edges: updatedEdges,
      selectedNodeId: get().selectedNodeId === groupId ? null : get().selectedNodeId,
    });
  },
}));