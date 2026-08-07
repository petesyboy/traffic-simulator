import { type StateCreator } from 'zustand';
import { type Edge } from '@xyflow/react';
import { type RFState, type CustomNode, type TrafficStream } from './types';
import { syncSplunkLabels } from './storeHelpers';
import { syncOpticsOnTapConnection } from '../utils/bomEngine';
import { syncPortAssignments } from '../utils/portSync';
import { syncTapTrays } from '../utils/traySync';

export interface SettingsSlice {
  advancedMode: boolean;
  advancedModeUnlocked: boolean;
  projectLicenseMode: 'HTL' | 'Perpetual';
  defaultTermDuration: string;
  projectRegion: 'US' | 'EU' | 'UK';
  disableDcWarnings: boolean;
  panelTextScale: number;

  setAdvancedMode: (mode: boolean) => void;
  setAdvancedModeUnlocked: (unlocked: boolean) => void;
  setProjectLicenseMode: (mode: 'HTL' | 'Perpetual') => void;
  setDefaultTermDuration: (duration: string) => void;
  setProjectRegion: (region: 'US' | 'EU' | 'UK') => void;
  setDisableDcWarnings: (disable: boolean) => void;
  setPanelTextScale: (scale: number) => void;
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
}

export const createSettingsSlice: StateCreator<RFState, [], [], SettingsSlice> = (set, get) => ({
  advancedMode: false,
  advancedModeUnlocked: false,
  projectLicenseMode: 'HTL',
  defaultTermDuration: '36',
  projectRegion: 'US',
  disableDcWarnings: false,
  panelTextScale: 1.0,

  setAdvancedMode: (mode) => set({ advancedMode: mode }),
  setAdvancedModeUnlocked: (unlocked) => set({ advancedModeUnlocked: unlocked }),
  setProjectLicenseMode: (mode) => set({ projectLicenseMode: mode }),
  setDefaultTermDuration: (duration) => set({ defaultTermDuration: duration }),
  setProjectRegion: (region) => set({ projectRegion: region }),
  setDisableDcWarnings: (disable) => set({ disableDcWarnings: disable }),
  setPanelTextScale: (scale) => set({ panelTextScale: scale }),

  restoreState: (nodes, edges, trafficStreams, settings) => {
    // Filter out duplicate edges that connect the exact same source/target handles
    const uniqueEdges: Edge[] = [];
    const seen = new Set<string>();
    edges.forEach((edge) => {
      const key = `${edge.source}_${edge.sourceHandle || ''}_${edge.target}_${edge.targetHandle || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEdges.push(edge);
      }
    });

    let syncedNodes = syncSplunkLabels(nodes, uniqueEdges);
    syncedNodes = syncOpticsOnTapConnection(syncedNodes, uniqueEdges);
    // Saves predating auto-generated trays have none stored either - backfill
    // them on load the same way port assignments are, below.
    syncedNodes = syncTapTrays(syncedNodes);

    const updateObj: Partial<RFState> = {
      nodes: syncedNodes,
      // Saves predating port assignments have none stored; re-deriving on load
      // backfills them rather than leaving old projects with blank faceplates.
      edges: syncPortAssignments(syncedNodes, uniqueEdges),
      trafficStreams: trafficStreams || get().trafficStreams,
      fitViewTrigger: get().fitViewTrigger + 1,
      // Undoing "into" a previously-loaded, unrelated topology isn't meaningful.
      historyPast: [],
      historyFuture: [],
    };

    if (settings) {
      if (settings.advancedMode !== undefined) updateObj.advancedMode = settings.advancedMode;
      if (settings.projectLicenseMode !== undefined) updateObj.projectLicenseMode = settings.projectLicenseMode;
      if (settings.defaultTermDuration !== undefined) updateObj.defaultTermDuration = settings.defaultTermDuration;
      if (settings.projectRegion !== undefined) updateObj.projectRegion = settings.projectRegion;
      if (settings.disableDcWarnings !== undefined) updateObj.disableDcWarnings = settings.disableDcWarnings;
      if (settings.panelTextScale !== undefined) updateObj.panelTextScale = settings.panelTextScale;
      if (settings.showGrid !== undefined) updateObj.showGrid = settings.showGrid;
      if (settings.snapToGrid !== undefined) updateObj.snapToGrid = settings.snapToGrid;
    }

    set(updateObj);
  },
});
