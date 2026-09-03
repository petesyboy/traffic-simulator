import { type StateCreator } from 'zustand';
import { type RFState } from './types';

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem('fm-simulator-theme');
      if (saved === 'light' || saved === 'dark') {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', saved);
        }
        return saved;
      }
    } catch {
      // ignore
    }
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  return 'dark';
};

export type ColourVisionMode = 'off' | 'red-green';

/**
 * A personal accessibility preference, so it is stored per person like the theme
 * rather than in the project file - opening someone else's topology must not
 * silently turn it off.
 */
const getInitialColourVision = (): ColourVisionMode => {
  let mode: ColourVisionMode = 'off';
  if (typeof localStorage !== 'undefined') {
    try {
      if (localStorage.getItem('fm-simulator-colour-vision') === 'red-green') mode = 'red-green';
    } catch {
      // ignore
    }
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-colour-vision', mode);
  }
  return mode;
};

export interface UISlice {
  activeView: 'canvas' | 'rack';
  theme: 'dark' | 'light';
  colourVisionMode: ColourVisionMode;
  sidebarMessage: string | null;
  currentScenarioName: string | null;
  isTradeShowDemoActive: boolean;
  tradeShowDemoStep: number;
  tradeShowDemoStatus: string;
  isMissionDemoActive: boolean;
  missionDemoStep: number;
  missionDemoStatus: string;
  /** Bumped to tell the Live Traffic Generator drawer to collapse itself,
   *  regardless of its own locally-held open/closed state. */
  trafficGenCollapseTrigger: number;
  /** Bumped whenever the uploaded SKU price list override changes, so mounted
   *  components re-read getSkus()/getSkusMetadata() without a page reload. */
  skuCatalogueVersion: number;

  setActiveView: (view: 'canvas' | 'rack') => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setColourVisionMode: (mode: ColourVisionMode) => void;
  toggleTheme: () => void;
  setSidebarMessage: (msg: string | null) => void;
  setCurrentScenarioName: (name: string | null) => void;
  setTradeShowDemoActive: (active: boolean) => void;
  setTradeShowDemoStep: (step: number) => void;
  setTradeShowDemoStatus: (status: string) => void;
  setMissionDemoActive: (active: boolean) => void;
  setMissionDemoStep: (step: number) => void;
  setMissionDemoStatus: (status: string) => void;
  collapseTrafficGenerator: () => void;
  bumpSkuCatalogueVersion: () => void;
}

export const createUISlice: StateCreator<RFState, [], [], UISlice> = (set, get) => {
  const initialTheme = getInitialTheme();

  return {
    activeView: 'canvas',
    theme: initialTheme,
    colourVisionMode: getInitialColourVision(),
    sidebarMessage: null,
    currentScenarioName: null,
    isTradeShowDemoActive: false,
    tradeShowDemoStep: 0,
    tradeShowDemoStatus: '',
    isMissionDemoActive: false,
    missionDemoStep: 0,
    missionDemoStatus: '',
    trafficGenCollapseTrigger: 0,
    skuCatalogueVersion: 0,

    setActiveView: (view) => set({ activeView: view }),
    setTheme: (theme) => {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('fm-simulator-theme', theme);
        } catch {
          // ignore
        }
      }
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }
      set({ theme });
    },
    setColourVisionMode: (mode) => {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('fm-simulator-colour-vision', mode);
        } catch {
          // ignore
        }
      }
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-colour-vision', mode);
      }
      set({ colourVisionMode: mode });
    },
    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      get().setTheme(next);
    },
    setSidebarMessage: (msg) => set({ sidebarMessage: msg }),
    setCurrentScenarioName: (name) => set({ currentScenarioName: name }),
    setTradeShowDemoActive: (active) => set({ isTradeShowDemoActive: active }),
    setTradeShowDemoStep: (step) => set({ tradeShowDemoStep: step }),
    setTradeShowDemoStatus: (status) => set({ tradeShowDemoStatus: status }),
    setMissionDemoActive: (active) => set({ isMissionDemoActive: active }),
    setMissionDemoStep: (step) => set({ missionDemoStep: step }),
    setMissionDemoStatus: (status) => set({ missionDemoStatus: status }),
    collapseTrafficGenerator: () => set({ trafficGenCollapseTrigger: get().trafficGenCollapseTrigger + 1 }),
    bumpSkuCatalogueVersion: () => set({ skuCatalogueVersion: get().skuCatalogueVersion + 1 }),
  };
};
