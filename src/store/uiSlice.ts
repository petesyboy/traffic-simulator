import { type StateCreator } from 'zustand';
import { type RFState } from './types';

export interface UISlice {
  activeView: 'canvas' | 'rack';
  sidebarMessage: string | null;
  currentScenarioName: string | null;

  setActiveView: (view: 'canvas' | 'rack') => void;
  setSidebarMessage: (msg: string | null) => void;
  setCurrentScenarioName: (name: string | null) => void;
}

export const createUISlice: StateCreator<RFState, [], [], UISlice> = (set) => ({
  activeView: 'canvas',
  sidebarMessage: null,
  currentScenarioName: null,

  setActiveView: (view) => set({ activeView: view }),
  setSidebarMessage: (msg) => set({ sidebarMessage: msg }),
  setCurrentScenarioName: (name) => set({ currentScenarioName: name }),
});
