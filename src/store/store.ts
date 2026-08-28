import { create } from 'zustand';
import { type RFState } from './types';
import { createGraphSlice } from './graphSlice';
import { createSimulationSlice } from './simulationSlice';
import { createTrafficSlice } from './trafficSlice';
import { createSettingsSlice } from './settingsSlice';
import { createUISlice } from './uiSlice';
import { createHistorySlice } from './historySlice';

export * from './types';
export * from './storeHelpers';

export const useStore = create<RFState>()((...a) => ({
  ...createGraphSlice(...a),
  ...createSimulationSlice(...a),
  ...createTrafficSlice(...a),
  ...createSettingsSlice(...a),
  ...createUISlice(...a),
  ...createHistorySlice(...a),
}));

if (typeof window !== 'undefined') {
  (window as unknown as { __FM_STORE__: typeof useStore }).__FM_STORE__ = useStore;
}
