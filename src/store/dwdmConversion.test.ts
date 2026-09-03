import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import type { CustomNode } from './types';
import type { Edge } from '@xyflow/react';
import { NODE_TYPES, CONFIG_TYPES } from '../constants/nodeTypes';

const chassis = (id: string, site: string, x = 0, y = 0): CustomNode =>
  ({
    id,
    type: NODE_TYPES.HARDWARE,
    position: { x, y },
    data: { label: id, model: 'GigaVUE-TA200E', sku: 'GVS-TAC21E-HW', optics: [], site },
  }) as unknown as CustomNode;

const hub = (id = 'dwdm-hub'): CustomNode =>
  ({
    id,
    type: NODE_TYPES.DWDM_NETWORK,
    position: { x: 500, y: 300 },
    data: {
      label: 'DWDM Optical Ring',
      configType: CONFIG_TYPES.DWDM_NETWORK,
      wavelengthSpeed: '100G',
      protectionMode: 'Protected Ring (1+1)',
      carrierName: 'Dark Fiber Transport',
      spanDistanceKm: 40,
      latencyMs: 2.0,
    },
  }) as unknown as CustomNode;

describe('convertHubToPerSiteDwdm', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
  });

  it('converts a central DWDM hub into site-local gateways with ring interconnects and 2D triangular layout', () => {
    const nodes: CustomNode[] = [
      chassis('dc3-ta', 'DC3', 300, 50),
      chassis('dc1-ta', 'DC1', 100, 400),
      chassis('dc2-ta', 'DC2', 500, 400),
      hub('dwdm-hub'),
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'dc1-ta', target: 'dwdm-hub' },
      { id: 'e2', source: 'dc2-ta', target: 'dwdm-hub' },
      { id: 'e3', source: 'dc3-ta', target: 'dwdm-hub' },
    ];

    useStore.setState({ nodes, edges });

    // Execute conversion
    useStore.getState().convertHubToPerSiteDwdm('dwdm-hub');

    const state = useStore.getState();

    // Central hub must be removed
    expect(state.nodes.find((n) => n.id === 'dwdm-hub')).toBeUndefined();

    // Exactly 3 new DWDM nodes must be present
    const dwdmNodes = state.nodes.filter(
      (n) => n.type === NODE_TYPES.DWDM_NETWORK || n.data?.configType === 'DWDM Network',
    );
    expect(dwdmNodes).toHaveLength(3);

    const dwdmBySite = new Map<string, CustomNode>();
    dwdmNodes.forEach((n) => dwdmBySite.set(n.data?.site as string, n));

    expect(dwdmBySite.has('DC1')).toBe(true);
    expect(dwdmBySite.has('DC2')).toBe(true);
    expect(dwdmBySite.has('DC3')).toBe(true);

    const dc1Dwdm = dwdmBySite.get('DC1')!;
    const dc2Dwdm = dwdmBySite.get('DC2')!;
    const dc3Dwdm = dwdmBySite.get('DC3')!;

    // Verify intra-site links are rewired to the respective local gateway
    const dc1Edge = state.edges.find((e) => e.source === 'dc1-ta');
    expect(dc1Edge?.target).toBe(dc1Dwdm.id);

    const dc2Edge = state.edges.find((e) => e.source === 'dc2-ta');
    expect(dc2Edge?.target).toBe(dc2Dwdm.id);

    const dc3Edge = state.edges.find((e) => e.source === 'dc3-ta');
    expect(dc3Edge?.target).toBe(dc3Dwdm.id);

    // Verify inter-site ring links exist between the 3 DWDM nodes
    const dwdmIds = new Set([dc1Dwdm.id, dc2Dwdm.id, dc3Dwdm.id]);
    const interDwdmEdges = state.edges.filter((e) => dwdmIds.has(e.source) && dwdmIds.has(e.target));
    expect(interDwdmEdges).toHaveLength(3);

    // Verify 2D triangular auto-layout positioning:
    // DC3 is North (top): lowest Y coordinate
    expect(dc3Dwdm.position.y).toBeLessThan(dc1Dwdm.position.y);
    expect(dc3Dwdm.position.y).toBeLessThan(dc2Dwdm.position.y);

    // DC1 is South-West (left) and DC2 is South-East (right)
    expect(dc1Dwdm.position.x).toBeLessThan(dc2Dwdm.position.x);

    // DC1 and DC2 sit on the same bottom row Y
    expect(dc1Dwdm.position.y).toBe(dc2Dwdm.position.y);
  });
});
