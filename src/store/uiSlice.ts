import { type StateCreator } from 'zustand';
import { type RFState } from './types';

export interface UISlice {
  activeView: 'canvas' | 'rack';
  sidebarMessage: string | null;
  currentScenarioName: string | null;
  isTradeShowDemoActive: boolean;
  tradeShowDemoStep: number;
  tradeShowDemoStatus: string;

  setActiveView: (view: 'canvas' | 'rack') => void;
  setSidebarMessage: (msg: string | null) => void;
  setCurrentScenarioName: (name: string | null) => void;
  setTradeShowDemoActive: (active: boolean) => void;
  setTradeShowDemoStep: (step: number) => void;
  setTradeShowDemoStatus: (status: string) => void;
}

export const createUISlice: StateCreator<RFState, [], [], UISlice> = (set) => ({
  activeView: 'canvas',
  sidebarMessage: null,
  currentScenarioName: null,
  isTradeShowDemoActive: false,
  tradeShowDemoStep: 0,
  tradeShowDemoStatus: '',

  setActiveView: (view) => set({ activeView: view }),
  setSidebarMessage: (msg) => set({ sidebarMessage: msg }),
  setCurrentScenarioName: (name) => set({ currentScenarioName: name }),
  setTradeShowDemoActive: (active) => set({ isTradeShowDemoActive: active }),
  setTradeShowDemoStep: (step) => set({ tradeShowDemoStep: step }),
  setTradeShowDemoStatus: (status) => set({ tradeShowDemoStatus: status }),
});
