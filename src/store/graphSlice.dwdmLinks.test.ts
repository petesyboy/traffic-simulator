import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from './store';
import type { CustomNode } from './types';
import { NODE_TYPES, CONFIG_TYPES } from '../constants/nodeTypes';

const initialState = useStore.getState();

const chassis = (id: string, site: string): CustomNode =>
  ({
    id,
    type: NODE_TYPES.HARDWARE,
    position: { x: 0, y: 0 },
    data: { label: id, model: 'GigaVUE-TA200E', sku: 'GVS-TAC21E-HW', optics: [], site },
  }) as unknown as CustomNode;

const ring = (id = 'dwdm-1'): CustomNode =>
  ({
    id,
    type: NODE_TYPES.DWDM_NETWORK,
    position: { x: 500, y: 0 },
    data: { label: 'Metro Ring', configType: CONFIG_TYPES.DWDM_NETWORK, wavelengthSpeed: '100G' },
  }) as unknown as CustomNode;

const linksBetween = (a: string, b: string) =>
  useStore.getState().edges.filter((e) => e.source === a && e.target === b).length;

describe('DWDM optical ring link capacity', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
    vi.stubGlobal('window', { alert: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a working and a protection link from the same chassis', () => {
    useStore.setState({ nodes: [chassis('dc1-ta', 'DC1'), ring()], edges: [] });

    useStore.getState().onConnect({ source: 'dc1-ta', target: 'dwdm-1', sourceHandle: 'out', targetHandle: 'in-left' });
    useStore.getState().onConnect({ source: 'dc1-ta', target: 'dwdm-1', sourceHandle: 'out', targetHandle: 'in-left' });

    // A 1+1 protected ring needs both paths between the same pair of endpoints;
    // treating the second as a duplicate is what used to drop it.
    expect(linksBetween('dc1-ta', 'dwdm-1')).toBe(2);
  });

  it('carries two redundant links for each of three sites, in both directions', () => {
    useStore.setState({
      nodes: [chassis('dc1-ta', 'DC1'), chassis('dc2-ta', 'DC2'), chassis('dc3-ta', 'DC3'), ring()],
      edges: [],
    });

    ['dc1-ta', 'dc2-ta', 'dc3-ta'].forEach((id) => {
      for (let i = 0; i < 2; i++) {
        useStore.getState().onConnect({ source: id, target: 'dwdm-1', sourceHandle: 'out', targetHandle: 'in-left' });
        useStore.getState().onConnect({ source: 'dwdm-1', target: id, sourceHandle: 'out-left', targetHandle: 'in' });
      }
    });

    expect(useStore.getState().edges).toHaveLength(12);
    ['dc1-ta', 'dc2-ta', 'dc3-ta'].forEach((id) => {
      expect(linksBetween(id, 'dwdm-1')).toBe(2);
      expect(linksBetween('dwdm-1', id)).toBe(2);
    });
  });

  it('keeps parallel links on distinct handles', () => {
    useStore.setState({ nodes: [chassis('dc1-ta', 'DC1'), ring()], edges: [] });

    useStore.getState().onConnect({ source: 'dc1-ta', target: 'dwdm-1', sourceHandle: 'out', targetHandle: 'in-top' });
    useStore.getState().onConnect({ source: 'dc1-ta', target: 'dwdm-1', sourceHandle: 'out', targetHandle: 'in-bottom' });

    expect(linksBetween('dc1-ta', 'dwdm-1')).toBe(2);
    expect(useStore.getState().edges.map((e) => e.targetHandle).sort()).toEqual(['in-bottom', 'in-top']);
  });

  it('each link is its own edge, so one can be removed without the other', () => {
    useStore.setState({ nodes: [chassis('dc1-ta', 'DC1'), ring()], edges: [] });
    useStore.getState().onConnect({ source: 'dc1-ta', target: 'dwdm-1', sourceHandle: 'out', targetHandle: 'in-left' });
    useStore.getState().onConnect({ source: 'dc1-ta', target: 'dwdm-1', sourceHandle: 'out', targetHandle: 'in-left' });

    const [first] = useStore.getState().edges;
    useStore.getState().setEdges(useStore.getState().edges.filter((e) => e.id !== first.id));

    expect(linksBetween('dc1-ta', 'dwdm-1')).toBe(1);
  });
});
