import { type Edge, type Node, type NodeChange, type OnEdgesChange, type OnConnect } from '@xyflow/react';

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
  /** When set, this optic occupies exactly this port id rather than being
   *  placed by getPortOpticMap's deterministic sequential fill. Always
   *  qty: 1 - pinning is a single-instance concept, unlike the aggregate
   *  (board, optic, qty) entries used for auto-assigned optics. */
  pinnedPortId?: string;
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

/** Fractional (0-1) rect of a cage's position on its board's own catalogue image. */
export interface PortBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PortInfo {
  type: string;
  count: number;
  speeds: string[];
  /** Optional per-cage pixel-calibrated positions on the board's catalogue image, one
   *  per physical cage in reading order (matches the port index expandPorts() assigns
   *  within this cage family). Only populated for boards that have been calibrated -
   *  absent elsewhere, in which case no occupancy overlay is drawn for that board. */
  boxes?: PortBox[];
}

/**
 * A single physical port (cage) on a chassis. Derived on demand from the
 * hardware catalogue plus the node's installedBoards/portCapacity - never
 * stored on the node, so saved projects need no migration and the port list
 * can't drift out of sync with the modules actually fitted.
 */
export interface ChassisPort {
  /** GigaVUE-OS style id, unique within the node - e.g. '1/1/x1', '1/2/c16'. */
  id: string;
  /** Matches InstalledOptic.board exactly, so optics can be tied to ports. */
  board: string;
  /** '1' for base ports, otherwise the module slot index. */
  slot: string;
  /** Catalogue port type, e.g. 'SFP28' | 'QSFP28' | 'QSFP-DD' | 'SFP+' | 'RJ45'. */
  type: string;
  /** Coarse cage family an optic must match to fit. 'MPO' is used only by a
   *  breakout panel's own 3 MPO connectors (see getPanelPorts in ports.ts). */
  cage: 'SFP' | 'QSFP' | 'RJ45' | 'MPO';
  /** 1-based position within this board's group of that cage family. */
  index: number;
  speeds: string[];
  /** False when the port is physically present but outside the licence tier. */
  licensed: boolean;
  /** Fractional position on the board's own catalogue image, if calibrated - see PortBox. */
  box?: PortBox;
}

/**
 * One physical port-to-port connection carried by an edge. A single edge holds
 * many of these - a 4-link TAP consumes 8 chassis ports over one edge.
 */
export interface PortLink {
  /** Port id at the edge's source. TAP ends use 'L<n>-N'/'L<n>-S'. */
  sourcePortId: string;
  targetPortId: string;
  opticSku?: string;
  /** Set once the user picks a port by hand; auto-allocation then leaves it be. */
  pinned?: boolean;
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
  module_slot_positions?: {
    number: number;
    label: string;
    box?: { x: number; y: number; width: number; height: number };
  }[];
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
  configType:
    | 'SPAN Port'
    | 'Network Tap'
    | 'Virtual TAP'
    | 'GigaVUE-VM'
    | 'ERSPAN Tunnel'
    | 'East/West Traffic'
    | 'VMWare Estate';
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
  /** GTP Flow Sampling only: percentage of GTP flows sampled (0-100). Per Gigamon's
   *  KB, 0% or 100% needs only the GTPMAX license; anything strictly in between also
   *  needs a FlowVUE entitlement on the same card. Unset is treated as 100%. */
  gtpSamplePercent?: number;
  gtpMode?: 'correlation' | 'whitelist' | 'sampling' | 'decap';
  gtpImsiFilter?: string;
  gtpApnFilter?: string;
  gtpWhitelistPassPercent?: number;
  // Header Stripping configuration
  headerStripProtocol?: 'VXLAN' | 'MPLS' | 'VLAN' | 'ERSPAN' | 'GTP-U' | 'Custom';
  headerStripRate?: number;
  // GSA-only: an AMI app can add the 5G mobile protocol decoding bundle
  // (SMT-GSA110-AMI-5G-100G-*) instead of the plain AMI license.
  gsa5gDecode?: boolean;
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
  psType?: string;
  advancedFeatures?: boolean;
  /** Rack Elevation View placement - which rack (by site) and which U position. */
  rackId?: string;
  rackU?: number;
  /** Set on a tap-module node nested inside a TAP-M100T/M200T tray's bay in the
   *  Rack View, in place of rackId/rackU (its position is implied by its parent). */
  trayId?: string;
  traySlot?: number;
}

export interface ToolNodeData extends BaseNodeData {
  expectedFormat?: string;
  expectedType?: 'packet' | 'metadata' | 'objects';
  ingestOptic?: string;
  ingestOpticQty?: string;
  toolName?: string;
  ingestLimitMbps?: number;
  // Only populated for the GigaSMART Appliance (GSA) tool - reuses the same shape
  // as HardwareNodeData.gigaSmartApps so GigaSmartAppsPanel works unchanged here.
  gigaSmartApps?: GigaSmartNodeData[];
  // GSA-only: optic fitted to the 4x 10/25GbE SFP28 metadata/NetFlow export
  // bank, kept separate from ingestOptic (the 400G/100G data ports) since
  // they're physically different cages - informational only, not in the BOM.
  metadataOptic?: string;
  metadataOpticQty?: string;
  // GSA-only: AC vs DC power supply, drives which GVS-GSA110-2xx chassis SKU
  // the BOM engine quotes. Defaults to AC.
  powerSupply?: 'AC' | 'DC';
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
  /** Ports just fitted with a new optic, briefly highlighted on the hardware node's port map. */
  flashPorts: { nodeId: string; portIds: string[] } | null;
  draggedNodeType: string | null;
  showGrid: boolean;
  snapToGrid: boolean;
  exportDiagramMode: boolean;
  fitViewTrigger: number;
  zoomToNodeId: string | null;
  zoomToNodeTrigger: number;

  // Simulation State
  isRunning: boolean;
  simulationSpeed: number;
  nodeMetrics: Record<string, NodeMetrics>;
  peakNodeRxMbps: Record<string, number>;
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
  isMissionDemoActive: boolean;
  missionDemoStep: number;
  missionDemoStatus: string;
  skuCatalogueVersion: number;

  // Actions
  setActiveView: (view: 'canvas' | 'rack') => void;
  setSidebarMessage: (msg: string | null) => void;
  setCurrentScenarioName: (name: string | null) => void;
  setTradeShowDemoActive: (active: boolean) => void;
  setTradeShowDemoStep: (step: number) => void;
  setTradeShowDemoStatus: (status: string) => void;
  setMissionDemoActive: (active: boolean) => void;
  setMissionDemoStep: (step: number) => void;
  setMissionDemoStatus: (status: string) => void;
  bumpSkuCatalogueVersion: () => void;
  onNodesChange: (changes: NodeChange<CustomNode>[]) => void;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setEdges: (edges: Edge[]) => void;
  setDraggedNodeType: (type: string | null) => void;
  addNode: (node: CustomNode) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setGlowingNodeId: (nodeId: string | null) => void;
  setFlashPorts: (flash: { nodeId: string; portIds: string[] } | null) => void;
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
    },
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
  tidyLayout: () => void;
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
    edgeEncryptedMbps?: Record<string, number>,
  ) => void;
  clearCanvas: () => void;
  loadDemo: () => void;
  groupSelectedNodes: () => void;
  ungroupGroup: (groupId: string) => void;
  duplicateSolution: (newSiteName: string) => void;
  autoScaleToolForFeed: (nodeId: string) => { ok: boolean; message: string };

  // History (Undo/Redo)
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}
