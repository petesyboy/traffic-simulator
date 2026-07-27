import { type StateCreator } from 'zustand';
import { type RFState, type TrafficStream, type CustomTool } from './types';
import { initialTraffic } from './storeHelpers';

export interface TrafficSlice {
  trafficStreams: TrafficStream[];
  customTools: CustomTool[];
  addTrafficStream: (stream: TrafficStream) => void;
  updateTrafficStream: (id: string, stream: Partial<TrafficStream>) => void;
  deleteTrafficStream: (id: string) => void;
  addCustomTool: (tool: Omit<CustomTool, 'id'>) => void;
  deleteCustomTool: (id: string) => void;
}

export const createTrafficSlice: StateCreator<RFState, [], [], TrafficSlice> = (set, get) => ({
  trafficStreams: initialTraffic,
  customTools: (() => {
    try {
      const saved = localStorage.getItem('fm_simulator_custom_tools');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),

  addTrafficStream: (stream) => { get().pushHistory(); set({ trafficStreams: [...get().trafficStreams, stream] }); },

  updateTrafficStream: (id, stream) => {
    set({
      trafficStreams: get().trafficStreams.map((s) =>
        s.id === id ? { ...s, ...stream } : s
      ),
    });
  },

  deleteTrafficStream: (id) => {
    get().pushHistory();
    set({
      trafficStreams: get().trafficStreams.filter((s) => s.id !== id),
    });
  },

  addCustomTool: (tool) => {
    const newTool = { ...tool, id: `custom-tool-${Date.now()}` };
    const nextTools = [...get().customTools, newTool];
    set({ customTools: nextTools });
    localStorage.setItem('fm_simulator_custom_tools', JSON.stringify(nextTools));
  },

  deleteCustomTool: (id) => {
    const nextTools = get().customTools.filter((t) => t.id !== id);
    set({ customTools: nextTools });
    localStorage.setItem('fm_simulator_custom_tools', JSON.stringify(nextTools));
  },
});
