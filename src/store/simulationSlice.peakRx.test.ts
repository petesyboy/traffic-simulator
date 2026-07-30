import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { type NodeMetrics } from './types';

const initialState = useStore.getState();

const metric = (rxMbps: number): NodeMetrics => ({
  rxMbps,
  txMbps: 0,
  rxPackets: 0,
  txPackets: 0,
  droppedPackets: 0,
});

// Ticks only carry the fields peakNodeRxMbps is derived from; the rest of
// updateSimulationTick's arguments are optional and irrelevant here.
const tick = (metrics: Record<string, NodeMetrics>) =>
  useStore.getState().updateSimulationTick(metrics, {}, [], []);

describe('peakNodeRxMbps (high-water mark for capacity-tiered licensing)', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
  });

  it('records each node peak and holds it when traffic later dips', () => {
    tick({ 'gsa-1': metric(120000) });
    expect(useStore.getState().peakNodeRxMbps['gsa-1']).toBe(120000);

    tick({ 'gsa-1': metric(350000) });
    expect(useStore.getState().peakNodeRxMbps['gsa-1']).toBe(350000);

    // The dip must not drag the peak down - a quote sized off this shouldn't
    // shrink just because the BOM happened to be opened during a lull.
    tick({ 'gsa-1': metric(40000) });
    expect(useStore.getState().peakNodeRxMbps['gsa-1']).toBe(350000);
    expect(useStore.getState().nodeMetrics['gsa-1'].rxMbps).toBe(40000);
  });

  it('tracks peaks per node independently', () => {
    tick({ 'gsa-1': metric(150000), 'gsa-2': metric(90000) });
    tick({ 'gsa-1': metric(50000), 'gsa-2': metric(220000) });

    const peaks = useStore.getState().peakNodeRxMbps;
    expect(peaks['gsa-1']).toBe(150000);
    expect(peaks['gsa-2']).toBe(220000);
  });

  it('keeps the same object identity when no node beats its peak', () => {
    tick({ 'gsa-1': metric(150000) });
    const peaksAfterFirst = useStore.getState().peakNodeRxMbps;

    tick({ 'gsa-1': metric(100000) });

    expect(useStore.getState().peakNodeRxMbps).toBe(peaksAfterFirst);
  });

  it('clears peaks on resetMetrics so a fresh run re-establishes them', () => {
    tick({ 'gsa-1': metric(350000) });
    useStore.getState().resetMetrics();

    expect(useStore.getState().peakNodeRxMbps).toEqual({});
  });

  it('clears peaks on loadDemo so a new topology does not inherit them', () => {
    tick({ 'gsa-1': metric(350000) });
    useStore.getState().loadDemo();

    expect(useStore.getState().peakNodeRxMbps).toEqual({});
  });
});
