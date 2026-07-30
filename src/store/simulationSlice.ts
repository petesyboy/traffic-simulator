import { type StateCreator } from 'zustand';
import { type RFState, type NodeMetrics, type TrafficStream } from './types';
import { syncSplunkLabels, initialNodes, initialEdges, initialTraffic } from './storeHelpers';
import { syncOpticsOnTapConnection } from '../utils/bomEngine';
import { NODE_TYPES } from '../constants/nodeTypes';

export interface SimulationSlice {
  isRunning: boolean;
  simulationSpeed: number;
  nodeMetrics: Record<string, NodeMetrics>;
  // High-water mark of each node's rxMbps across the session. Capacity-tiered
  // licences (the GSA's 100G-per-unit app SKUs) are quoted off this rather
  // than the live figure, so a quote never shrinks just because traffic
  // happened to dip when the BOM was opened. Cleared by resetMetrics.
  peakNodeRxMbps: Record<string, number>;
  edgeMetrics: Record<string, number>;
  edgeEncryptedMbps: Record<string, number>;
  activeEdges: string[];
  blockedEdges: string[];
  encryptedEdges: string[];
  decryptedEdges: string[];
  deliveredStreams: string[];
  uniqueEgressMbps: number;

  toggleSimulation: () => void;
  setSimulationSpeed: (speed: number) => void;
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
  loadDemo: () => void;
}

export const createSimulationSlice: StateCreator<RFState, [], [], SimulationSlice> = (set, get) => ({
  isRunning: false,
  simulationSpeed: 1,
  nodeMetrics: {},
  peakNodeRxMbps: {},
  edgeMetrics: {},
  edgeEncryptedMbps: {},
  activeEdges: [],
  blockedEdges: [],
  encryptedEdges: [],
  decryptedEdges: [],
  deliveredStreams: [],
  uniqueEgressMbps: 0,

  toggleSimulation: () => {
    const nextRunning = !get().isRunning;
    if (!nextRunning) {
      const resetTraffic = get().trafficStreams.map((s) => ({
        ...s,
        drift: 1.0,
        lastDriftUpdate: 0,
      }));
      set({
        isRunning: false,
        activeEdges: [],
        blockedEdges: [],
        encryptedEdges: [],
        decryptedEdges: [],
        edgeEncryptedMbps: {},
        trafficStreams: resetTraffic
      });
    } else {
      set({ isRunning: true });
    }
  },

  setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),

  resetMetrics: () => {
    const resetNodes = get().nodes.map(n => ({ ...n, data: { ...n.data, totalIngestedBytes: 0 } }));
    set({
      nodeMetrics: {},
      peakNodeRxMbps: {},
      activeEdges: [],
      blockedEdges: [],
      encryptedEdges: [],
      decryptedEdges: [],
      edgeEncryptedMbps: {},
      deliveredStreams: [],
      uniqueEgressMbps: 0,
      nodes: syncSplunkLabels(resetNodes, get().edges)
    });
  },

  updateSimulationTick: (
    metrics,
    edgeMetrics,
    activeEdges,
    blockedEdges,
    deliveredStreams,
    nodeDataPatches,
    streamPatches,
    uniqueEgressMbps,
    encryptedEdges,
    decryptedEdges,
    edgeEncryptedMbps
  ) => {
    let nextNodes = get().nodes;
    
    // Update ingested bytes for tool nodes
    nextNodes = nextNodes.map((node) => {
      if (node.type === NODE_TYPES.TOOL) {
        const rxMbps = metrics[node.id]?.rxMbps || 0;
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

    let nextStreams = get().trafficStreams;
    if (streamPatches && Object.keys(streamPatches).length > 0) {
      nextStreams = nextStreams.map((s) =>
        streamPatches[s.id] ? { ...s, ...streamPatches[s.id] } : s
      );
    }

    const prevPeaks = get().peakNodeRxMbps;
    let peaksChanged = false;
    const nextPeaks = { ...prevPeaks };
    Object.entries(metrics).forEach(([nodeId, m]) => {
      if (m.rxMbps > (nextPeaks[nodeId] || 0)) {
        nextPeaks[nodeId] = m.rxMbps;
        peaksChanged = true;
      }
    });

    set({
      nodeMetrics: metrics,
      peakNodeRxMbps: peaksChanged ? nextPeaks : prevPeaks,
      edgeMetrics,
      edgeEncryptedMbps: edgeEncryptedMbps || {},
      activeEdges,
      blockedEdges,
      encryptedEdges: encryptedEdges || [],
      decryptedEdges: decryptedEdges || [],
      deliveredStreams: deliveredStreams || [],
      nodes: nextNodes,
      trafficStreams: nextStreams,
      uniqueEgressMbps: uniqueEgressMbps ?? 0,
    });
  },

  loadDemo: () => {
    let syncedNodes = syncSplunkLabels(initialNodes, initialEdges);
    syncedNodes = syncOpticsOnTapConnection(syncedNodes, initialEdges);
    set({
      nodes: syncedNodes,
      edges: initialEdges,
      selectedNodeId: null,
      isRunning: false,
      nodeMetrics: {},
      peakNodeRxMbps: {},
      activeEdges: [],
      blockedEdges: [],
      trafficStreams: initialTraffic,
      deliveredStreams: [],
      uniqueEgressMbps: 0,
      zoomToNodeId: 'node-tool-1',
      zoomToNodeTrigger: get().zoomToNodeTrigger + 1
    });
  },
});
