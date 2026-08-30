import { type StateCreator } from 'zustand';
import { type RFState, type TrafficStream, type CustomTool } from './types';
import { initialTraffic } from './storeHelpers';

export interface TrafficSlice {
  trafficStreams: TrafficStream[];
  trafficProfileBias: 'mixed' | 'telco' | 'enterprise';
  trafficUtilisationLevel: 'low' | 'medium' | 'high' | 'max' | 'full' | '10' | '20' | '25' | '30' | '40' | '50' | '60' | '70' | '75' | '80' | '90' | '95' | '100';
  customTools: CustomTool[];
  setTrafficProfileBias: (bias: 'mixed' | 'telco' | 'enterprise') => void;
  setTrafficUtilisationLevel: (level: 'low' | 'medium' | 'high' | 'max' | 'full' | '10' | '20' | '25' | '30' | '40' | '50' | '60' | '70' | '75' | '80' | '90' | '95' | '100') => void;
  setTrafficStreams: (streams: TrafficStream[]) => void;
  clearTrafficStreams: () => void;
  addTrafficStream: (stream: TrafficStream) => void;
  updateTrafficStream: (id: string, stream: Partial<TrafficStream>) => void;
  deleteTrafficStream: (id: string) => void;
  addCustomTool: (tool: Omit<CustomTool, 'id'>) => void;
  deleteCustomTool: (id: string) => void;
}

export const createTrafficSlice: StateCreator<RFState, [], [], TrafficSlice> = (set, get) => ({
  trafficStreams: initialTraffic,
  trafficProfileBias: 'mixed',
  trafficUtilisationLevel: 'medium',
  customTools: (() => {
    try {
      const saved = localStorage.getItem('fm_simulator_custom_tools');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),

  setTrafficProfileBias: (bias) => set({ trafficProfileBias: bias }),
  setTrafficUtilisationLevel: (level) => set({ trafficUtilisationLevel: level }),

  setTrafficStreams: (streams) => {
    get().pushHistory();
    set({ trafficStreams: streams });
  },

  clearTrafficStreams: () => {
    get().pushHistory();
    set({ trafficStreams: [] });
  },

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
