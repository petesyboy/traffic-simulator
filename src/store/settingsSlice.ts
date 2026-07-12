import { type StateCreator } from 'zustand';
import { type RFState, type CustomNode, type TrafficStream } from './types';
import { syncSplunkLabels } from './storeHelpers';
import { syncOpticsOnTapConnection } from '../utils/bomEngine';

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
    edges: any[],
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
    let syncedNodes = syncSplunkLabels(nodes, edges);
    syncedNodes = syncOpticsOnTapConnection(syncedNodes, edges);
    
    const updateObj: any = {
      nodes: syncedNodes,
      edges,
      trafficStreams: trafficStreams || get().trafficStreams,
      fitViewTrigger: get().fitViewTrigger + 1
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
