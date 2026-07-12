import { create } from 'zustand';
import { type RFState } from './types';
import { createGraphSlice } from './graphSlice';
import { createSimulationSlice } from './simulationSlice';
import { createTrafficSlice } from './trafficSlice';
import { createSettingsSlice } from './settingsSlice';
import { createUISlice } from './uiSlice';

export * from './types';
export * from './storeHelpers';

export const useStore = create<RFState>()((...a) => ({
  ...createGraphSlice(...a),
  ...createSimulationSlice(...a),
  ...createTrafficSlice(...a),
  ...createSettingsSlice(...a),
  ...createUISlice(...a),
}));
