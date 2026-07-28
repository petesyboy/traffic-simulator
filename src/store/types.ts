import {
  type Edge,
  type Node,
  type NodeChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';

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
  isEncrypted?: boolean;
  drift?: number;
  lastDriftUpdate?: number;
}

export interface NodeMetrics {
  rxMbps: number;
  txMbps: number;
  rxPackets: number;
  txPackets: number;
  droppedPackets: number;
  dedupDroppedMbps?: number;
  filterDroppedMbps?: number;
}

export interface MapCondition {
  logic?: 'AND' | 'OR';
  field: string;
  value: string;
  action?: 'pass' | 'drop';
}

export interface CustomTool {
  id: string;
  label: string;
  inputFormat: 'packets' | 'AMI' | 'objects';
  description?: string;
  // Ingest-rate ceiling in Mbps, only meaningful for inputFormat === 'packets'.
  ingestLimitMbps?: number;
}

export interface GigaSmartApp {
  name: string;
  gsop?: string;
  enabled?: boolean;
}

export interface InstalledOptic {
  board: string;
  optic: string;
  qty: number;
  isAutoAdded?: boolean;
}

export interface TappedLinkAllocation {
  qty: number;
  optic: string;
  toolOptic?: string;
  linkIndex?: number;
  speed?: string;
  fiberType?: string;
  northOptic?: string;
  southOptic?: string;
}

export interface BreakoutPanel {
  type: string;
  tray: string;
  slot?: number;
}

export interface PortInfo {
  type: string;
  count: number;
  speeds: string[];
}

export interface LicensingInfo {
  ports: PortInfo[];
}

export interface HardwareModel {
  model: string;
  sku: string;
  power?: string;
  fans?: number;
  airflow?: string;
  ports?: (PortInfo | number)[];
  base_ports?: (PortInfo | number)[];
  licensing?: LicensingInfo;
  module_slots?: number;
  image?: string;
  isCustom?: boolean;
  tappedLinksCount?: number;
  tappedLinkAllocations?: TappedLinkAllocation[];
}

export interface Module {
  model: string;
  sku: string;
  ports: PortInfo[];
}

export interface HardwareCatalogue {
  taps: HardwareModel[];
  ta_series: HardwareModel[];
  hc_series: HardwareModel[];
  modules: Module[];
}

export interface HardwareCatalogueItem {
  sku: string;
  model: string;
  image?: string;
  isCustom?: boolean;
  tappedLinksCount?: number;
  tappedLinkAllocations?: TappedLinkAllocation[];
}

export type NodeType = 
  | 'inputNode' 
  | 'mapNode' 
  | 'filterNode' 
  | 'toolNode' 
  | 'gigaSmartNode' 
  | 'gigaStreamNode' 
  | 'groupNode'
  | 'hardwareNode';

export interface BaseNodeData {
  label: string;
  configType: string;
  status?: 'optimal' | 'warning' | 'error' | 'ok';
  statusMessage?: string;
  receivedFormat?: string;
  totalIngestedBytes?: number;
  site?: string;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- index signature for generic data access; use typed interfaces for safety
}

export interface InputNodeData extends BaseNodeData {
  configType: 'SPAN Port' | 'Network Tap' | 'Virtual TAP' | 'GigaVUE-VM' | 'ERSPAN Tunnel' | 'East/West Traffic' | 'VMWare Estate';
  linkSpeed?: number;
  portSpeed?: string;
  encryptedTrafficPercentage?: number;
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
  metadataRate?: number;
  decryptionRate?: number;
  sliceSize?: number;
}

export interface GigaStreamNodeData extends BaseNodeData {
  configType: 'GigaStream';
  algorithm?: string;
  linkCount?: number;
}

export interface HardwareNodeData extends BaseNodeData {
  model: string;
  sku?: string;
  image?: string;
  optics?: InstalledOptic[];
  gigaSmartApps?: GigaSmartNodeData[];
  installedBoards?: Record<string, string>;
  powerSupply?: 'AC' | 'DC';
  portCapacity?: 'Full' | 'Quarter' | 'Half' | 'Upgrade' | '100G';
  tapMode?: 'Passive' | 'Active';
  tapFiberMode?: 'Singlemode' | 'Multimode';
  tappedLinksCount?: number;
  tappedLinkOptic?: string;
  tappedLinkAllocations?: TappedLinkAllocation[];
  breakoutPanels?: BreakoutPanel[];
  psType?: string;
}

export interface ToolNodeData extends BaseNodeData {
  expectedFormat?: string;
  expectedType?: 'packet' | 'metadata' | 'objects';
  ingestOptic?: string;
  ingestOpticQty?: string;
  toolName?: string;
}

export type AnyNodeData = 
  | InputNodeData 
  | MapNodeData 
  | FilterNodeData 
  | GigaSmartNodeData 
  | GigaStreamNodeData 
  | HardwareNodeData 
  | ToolNodeData
  | BaseNodeData;

export type CustomNode = Node<AnyNodeData>;

export interface HistorySnapshot {
  nodes: CustomNode[];
  edges: Edge[];
  trafficStreams: TrafficStream[];
}

export interface RFState {
  // Graph State
  nodes: CustomNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  glowingNodeId: string | null;
  draggedNodeType: string | null;
  showGrid: boolean;
  snapToGrid: boolean;
  exportDiagramMode: boolean;
  fitViewTrigger: number;
  
  // Simulation State
  isRunning: boolean;
  simulationSpeed: number;
  nodeMetrics: Record<string, NodeMetrics>;
  edgeMetrics: Record<string, number>;
  edgeEncryptedMbps: Record<string, number>;
  activeEdges: string[];
  blockedEdges: string[];
  encryptedEdges: string[];
  decryptedEdges: string[];
  deliveredStreams: string[];
  uniqueEgressMbps: number;

  // Domain State
  trafficStreams: TrafficStream[];
  customTools: CustomTool[];
  advancedMode: boolean;
  advancedModeUnlocked: boolean;
  projectLicenseMode: 'HTL' | 'Perpetual';
  defaultTermDuration: string;
  projectRegion: 'US' | 'EU' | 'UK';
  disableDcWarnings: boolean;
  panelTextScale: number;
  activeView: 'canvas' | 'rack';
  sidebarMessage: string | null;
  currentScenarioName: string | null;
  isTradeShowDemoActive: boolean;
  tradeShowDemoStep: number;
  tradeShowDemoStatus: string;

  // Actions
  setActiveView: (view: 'canvas' | 'rack') => void;
  setSidebarMessage: (msg: string | null) => void;
  setCurrentScenarioName: (name: string | null) => void;
  setTradeShowDemoActive: (active: boolean) => void;
  setTradeShowDemoStep: (step: number) => void;
  setTradeShowDemoStatus: (status: string) => void;
  onNodesChange: (changes: NodeChange<CustomNode>[]) => void;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setEdges: (edges: Edge[]) => void;
  setDraggedNodeType: (type: string | null) => void;
  addNode: (node: CustomNode) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setGlowingNodeId: (nodeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => void;
  restoreState: (
    nodes: CustomNode[],
    edges: Edge[],
    trafficStreams?: TrafficStream[],
    settings?: {
      advancedMode?: boolean;
      projectLicenseMode?: 'HTL' | 'Perpetual';
      defaultTermDuration?: string;
      projectRegion?: 'US' | 'EU' | 'UK';
      disableDcWarnings?: boolean;
      panelTextScale?: number;
      showGrid?: boolean;
      snapToGrid?: boolean;
    }
  ) => void;
  toggleSimulation: () => void;
  setSimulationSpeed: (speed: number) => void;
  setAdvancedMode: (mode: boolean) => void;
  setAdvancedModeUnlocked: (unlocked: boolean) => void;
  setProjectLicenseMode: (mode: 'HTL' | 'Perpetual') => void;
  setDefaultTermDuration: (duration: string) => void;
  setProjectRegion: (region: 'US' | 'EU' | 'UK') => void;
  setDisableDcWarnings: (disable: boolean) => void;
  setPanelTextScale: (scale: number) => void;
  setShowGrid: (show: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setExportDiagramMode: (val: boolean) => void;
  snapAllNodesToGrid: () => void;
  addTrafficStream: (stream: TrafficStream) => void;
  updateTrafficStream: (id: string, stream: Partial<TrafficStream>) => void;
  deleteTrafficStream: (id: string) => void;
  addCustomTool: (tool: Omit<CustomTool, 'id'>) => void;
  deleteCustomTool: (id: string) => void;
  resetMetrics: () => void;
  updateSimulationTick: (
    metrics: Record<string, NodeMetrics>,
    edgeMetrics: Record<string, number>,
    activeEdges: string[],
    blockedEdges: string[],
    deliveredStreams?: string[],
    nodeDataPatches?: Record<string, Record<string, unknown>>,
    streamPatches?: Record<string, Partial<TrafficStream>>,
    uniqueEgressMbps?: number,
    encryptedEdges?: string[],
    decryptedEdges?: string[],
    edgeEncryptedMbps?: Record<string, number>
  ) => void;
  clearCanvas: () => void;
  loadDemo: () => void;
  groupSelectedNodes: () => void;
  ungroupGroup: (groupId: string) => void;
  duplicateSolution: (newSiteName: string) => void;

  // History (Undo/Redo)
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}
