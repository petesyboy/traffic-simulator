import { type StateCreator } from 'zustand';
import { type RFState, type HistorySnapshot } from './types';

// Bounds memory use; snapshots are cheap (array references, not deep clones —
// every mutation elsewhere in the store already replaces arrays/objects rather
// than mutating in place, so nothing here needs to be copied deeply).
const MAX_HISTORY = 50;

export interface HistorySlice {
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}

export const createHistorySlice: StateCreator<RFState, [], [], HistorySlice> = (set, get) => ({
  historyPast: [],
  historyFuture: [],

  // Call BEFORE a structural mutation (add/delete/connect/move-start) to snapshot
  // the state as it was right before that action, and drop any redo stack —
  // taking a new action after an undo invalidates whatever was "future".
  pushHistory: () => {
    const { nodes, edges, trafficStreams, historyPast } = get();
    const snapshot: HistorySnapshot = { nodes, edges, trafficStreams };
    set({ historyPast: [...historyPast, snapshot].slice(-MAX_HISTORY), historyFuture: [] });
  },

  undo: () => {
    const { historyPast, historyFuture, nodes, edges, trafficStreams } = get();
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    const current: HistorySnapshot = { nodes, edges, trafficStreams };
    set({
      nodes: previous.nodes,
      edges: previous.edges,
      trafficStreams: previous.trafficStreams,
      historyPast: historyPast.slice(0, -1),
      historyFuture: [...historyFuture, current].slice(-MAX_HISTORY),
      selectedNodeId: null,
    });
  },

  redo: () => {
    const { historyPast, historyFuture, nodes, edges, trafficStreams } = get();
    if (historyFuture.length === 0) return;
    const next = historyFuture[historyFuture.length - 1];
    const current: HistorySnapshot = { nodes, edges, trafficStreams };
    set({
      nodes: next.nodes,
      edges: next.edges,
      trafficStreams: next.trafficStreams,
      historyFuture: historyFuture.slice(0, -1),
      historyPast: [...historyPast, current].slice(-MAX_HISTORY),
      selectedNodeId: null,
    });
  },

  // Used when the canvas is wholesale replaced (loading a slot/preset/file) —
  // undoing "into" an unrelated previously-loaded topology isn't meaningful.
  clearHistory: () => set({ historyPast: [], historyFuture: [] }),
});
