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
  [key: string]: any; // Add index signature
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
  trafficStreams: TrafficStream[];
  nodeMetrics: Record<string, NodeMetrics>;
  activeEdges: string[];
  blockedEdges: string[];
  deliveredStreams: string[];
  fitViewTrigger: number;
  onNodesChange: (changes: NodeChange<CustomNode>[]) => void;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: CustomNode) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => void;
  restoreState: (nodes: CustomNode[], edges: Edge[], trafficStreams?: TrafficStream[]) => void;
  toggleSimulation: () => void;
  setSimulationSpeed: (speed: number) => void;
  addTrafficStream: (stream: TrafficStream) => void;
  updateTrafficStream: (id: string, stream: Partial<TrafficStream>) => void;
  deleteTrafficStream: (id: string) => void;
  resetMetrics: () => void;
  updateSimulationTick: (
    metrics: Record<string, NodeMetrics>,
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
  ) => void;
  clearCanvas: () => void;
  loadDemo: () => void;
  groupSelectedNodes: () => void;
  ungroupGroup: (groupId: string) => void;
};

// Create a default topology
const defaultInputId = 'node-input-1';
const tapInputId2 = 'node-input-tap-2';
const tapInputId3 = 'node-input-tap-3';
const tapInputId4 = 'node-input-tap-4';
const tapInputId5 = 'node-input-tap-5';
const tapInputId6 = 'node-input-tap-6';

const defaultMapId = 'node-map-1';
const defaultVlanFilterId = 'node-filter-1';
const defaultPortFilterId = 'node-filter-2';
const defaultToolHopId = 'node-tool-1';
const defaultAmiId = 'node-gigasmart-ami-1';
const defaultToolSplunkId = 'node-tool-splunk-1';

const initialNodes: CustomNode[] = [
  {
    id: defaultInputId,
    type: 'inputNode',
    position: { x: 50, y: 60 },
    data: { label: 'SPAN Port 1/1/x1', configType: 'SPAN Port' },
  },
  {
    id: tapInputId2,
    type: 'inputNode',
    position: { x: 50, y: 140 },
    data: { label: 'TAP Device 1/1/x2', configType: 'TAP Device' },
  },
  {
    id: tapInputId3,
    type: 'inputNode',
    position: { x: 50, y: 220 },
    data: { label: 'TAP Device 1/1/x3', configType: 'TAP Device' },
  },
  {
    id: tapInputId4,
    type: 'inputNode',
    position: { x: 50, y: 300 },
    data: { label: 'TAP Device 1/1/x4', configType: 'TAP Device' },
  },
  {
    id: tapInputId5,
    type: 'inputNode',
    position: { x: 50, y: 380 },
    data: { label: 'TAP Device 1/1/x5', configType: 'TAP Device' },
  },
  {
    id: tapInputId6,
    type: 'inputNode',
    position: { x: 50, y: 460 },
    data: { label: 'TAP Device 1/1/x6', configType: 'TAP Device' },
  },
  {
    id: defaultMapId,
    type: 'mapNode',
    position: { x: 320, y: 260 },
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
    position: { x: 620, y: 180 },
    data: { label: 'VLAN 100 Filter', configType: 'VLAN Filter', vlanIds: '100' },
  },
  {
    id: defaultPortFilterId,
    type: 'filterNode',
    position: { x: 620, y: 340 },
    data: { label: 'Port 80 Filter', configType: 'Port Filter', ports: '80' },
  },
  {
    id: defaultToolHopId,
    type: 'toolNode',
    position: { x: 890, y: 180 },
    data: { label: 'ExtraHop Tool', configType: 'ExtraHop' },
  },
  {
    id: defaultAmiId,
    type: 'gigaSmartNode',
    position: { x: 890, y: 340 },
    data: { label: 'AMI Node', configType: 'AMI', actionType: 'AMI', metadataFormat: 'CEF' },
  },
  {
    id: defaultToolSplunkId,
    type: 'toolNode',
    position: { x: 1160, y: 340 },
    data: { label: 'Splunk Tool', configType: 'Metadata Tool', expectedFormat: 'CEF' },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: defaultInputId, target: defaultMapId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e-tap-2', source: tapInputId2, target: defaultMapId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e-tap-3', source: tapInputId3, target: defaultMapId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e-tap-4', source: tapInputId4, target: defaultMapId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e-tap-5', source: tapInputId5, target: defaultMapId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e-tap-6', source: tapInputId6, target: defaultMapId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e2', source: defaultMapId, target: defaultVlanFilterId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e3', source: defaultMapId, target: defaultPortFilterId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e4', source: defaultVlanFilterId, target: defaultToolHopId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e5', source: defaultPortFilterId, target: defaultAmiId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e6', source: defaultAmiId, target: defaultToolSplunkId, sourceHandle: 'out', targetHandle: 'in' },
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
  },
  {
    id: 't-tap-2',
    name: 'TAP 2 Flow (10 Gbps)',
    sourceNodeId: tapInputId2,
    vlan: '100',
    ipSrc: '192.168.10.2',
    ipDst: '10.0.0.20',
    portSrc: '50002',
    portDst: '80',
    protocol: 'tcp',
    bandwidth: 10000,
    active: true,
  },
  {
    id: 't-tap-3',
    name: 'TAP 3 Flow (10 Gbps)',
    sourceNodeId: tapInputId3,
    vlan: '200',
    ipSrc: '192.168.10.3',
    ipDst: '10.0.0.30',
    portSrc: '50003',
    portDst: '80',
    protocol: 'tcp',
    bandwidth: 10000,
    active: true,
  },
  {
    id: 't-tap-4',
    name: 'TAP 4 Flow (1 Gbps)',
    sourceNodeId: tapInputId4,
    vlan: '100',
    ipSrc: '192.168.10.4',
    ipDst: '10.0.0.40',
    portSrc: '50004',
    portDst: '80',
    protocol: 'tcp',
    bandwidth: 1000,
    active: true,
  },
  {
    id: 't-tap-5',
    name: 'TAP 5 Flow (25 Gbps)',
    sourceNodeId: tapInputId5,
    vlan: '100',
    ipSrc: '192.168.10.5',
    ipDst: '10.0.0.50',
    portSrc: '50005',
    portDst: '80',
    protocol: 'tcp',
    bandwidth: 25000,
    active: true,
  },
  {
    id: 't-tap-6',
    name: 'TAP 6 Flow (40 Gbps)',
    sourceNodeId: tapInputId6,
    vlan: '100',
    ipSrc: '192.168.10.6',
    ipDst: '10.0.0.60',
    portSrc: '50006',
    portDst: '80',
    protocol: 'tcp',
    bandwidth: 40000,
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
  fitViewTrigger: 0,
  
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
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  
  onConnect: (connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `e-${uuidv4()}`,
    };
    set({ edges: addEdge(newEdge, get().edges) });
  },
  
  addNode: (node: CustomNode) => {
    set({ nodes: get().nodes.concat(node) });
  },
  
  setSelectedNodeId: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId });
  },
  
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => {
    set({
      nodes: get().nodes.map((node) => 
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
  },
  
  restoreState: (nodes: CustomNode[], edges: Edge[], trafficStreams?: TrafficStream[]) => {
    set({
      nodes,
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

  updateSimulationTick: (
    metrics: Record<string, NodeMetrics>,
    activeEdges: string[],
    blockedEdges: string[],
    deliveredStreams?: string[],
    nodeDataPatches?: Record<string, Record<string, unknown>>,
    streamPatches?: Record<string, Partial<TrafficStream>>,
  ) => {
    // Apply node-data patches (e.g. dedupRate drift, tool status)
    let nextNodes = get().nodes;
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
      activeEdges,
      blockedEdges,
      deliveredStreams: deliveredStreams || [],
      nodes: nextNodes,
      trafficStreams: nextStreams,
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
      nodes: updatedNodes,
      edges: updatedEdges,
      selectedNodeId: get().selectedNodeId === groupId ? null : get().selectedNodeId,
    });
  },
}));