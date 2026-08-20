import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from './store';
import type { CustomNode } from './types';
import { NODE_TYPES } from '../constants/nodeTypes';

const initialState = useStore.getState();

const makeTaNode = (id: string): CustomNode => ({
  id,
  type: NODE_TYPES.HARDWARE,
  position: { x: 300, y: 0 },
  data: { label: 'TA200E', model: 'GigaVUE-TA200E', sku: 'GVS-TAC21E-HW', optics: [] } as unknown as CustomNode['data'],
});

describe('onConnect TAP -> TA200E QSFP-cage check', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows a passive TAP whose allocations use a 100G QSFP tool optic', () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('window', { alert: alertSpy });
    const tapNode: CustomNode = {
      id: 'tap-1',
      type: NODE_TYPES.HARDWARE,
      position: { x: 0, y: 0 },
      data: {
        label: 'TAP-M251T', model: 'TAP-M251T', sku: 'TAP-M251T',
        tappedLinkAllocations: [{ qty: 2, optic: 'Passive Optical Splitter (Multimode)', toolOptic: 'Q28-508 (100G QSFP28 SWDM4)' }],
      } as unknown as CustomNode['data'],
    };
    const taNode = makeTaNode('ta-1');
    useStore.setState({ nodes: [tapNode, taNode], edges: [] });

    useStore.getState().onConnect({ source: 'tap-1', target: 'ta-1', sourceHandle: 'out', targetHandle: 'in' });

    const refusal = alertSpy.mock.calls.find(c => String(c[0]).includes('CONNECTION REFUSED') && String(c[0]).includes('QSFP+/QSFP28'));
    expect(refusal).toBeUndefined();
  });

  it('refuses a TAP whose allocations use an SFP tool optic', () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('window', { alert: alertSpy });
    const tapNode: CustomNode = {
      id: 'tap-2',
      type: NODE_TYPES.HARDWARE,
      position: { x: 0, y: 0 },
      data: {
        label: 'TAP-M251T', model: 'TAP-M251T', sku: 'TAP-M251T',
        tappedLinkAllocations: [{ qty: 1, optic: 'Passive Optical Splitter (Multimode)', toolOptic: 'SFP-502 (1G SFP SX)' }],
      } as unknown as CustomNode['data'],
    };
    const taNode = makeTaNode('ta-2');
    useStore.setState({ nodes: [tapNode, taNode], edges: [] });

    useStore.getState().onConnect({ source: 'tap-2', target: 'ta-2', sourceHandle: 'out', targetHandle: 'in' });

    const refusal = alertSpy.mock.calls.find(c => String(c[0]).includes('CONNECTION REFUSED') && String(c[0]).includes('QSFP+/QSFP28'));
    expect(refusal).toBeDefined();
  });

  it('allows multiple parallel links between two TA25 chassis and allocates distinct ports', () => {
    const taNodeA: CustomNode = {
      id: 'ta-a',
      type: NODE_TYPES.HARDWARE,
      position: { x: 0, y: 0 },
      data: { label: 'TA25-A', model: 'GigaVUE-TA25E', sku: 'TA25E-BASE', optics: [] } as unknown as CustomNode['data'],
    };
    const taNodeB: CustomNode = {
      id: 'ta-b',
      type: NODE_TYPES.HARDWARE,
      position: { x: 300, y: 0 },
      data: { label: 'TA25-B', model: 'GigaVUE-TA25E', sku: 'TA25E-BASE', optics: [] } as unknown as CustomNode['data'],
    };
    useStore.setState({ nodes: [taNodeA, taNodeB], edges: [] });

    // Connect first link
    useStore.getState().onConnect({ source: 'ta-a', target: 'ta-b', sourceHandle: 'out', targetHandle: 'in' });
    expect(useStore.getState().edges).toHaveLength(1);

    // Connect second parallel link
    useStore.getState().onConnect({ source: 'ta-a', target: 'ta-b', sourceHandle: 'out', targetHandle: 'in' });
    const edges = useStore.getState().edges;
    expect(edges).toHaveLength(2);

    // Both edges should have distinct port assignments on the source and target
    const edge1Links = edges[0].data?.portLinks as { sourcePortId: string; targetPortId: string }[];
    const edge2Links = edges[1].data?.portLinks as { sourcePortId: string; targetPortId: string }[];

    expect(edge1Links).toHaveLength(1);
    expect(edge2Links).toHaveLength(1);
    expect(edge1Links[0].sourcePortId).not.toEqual(edge2Links[0].sourcePortId);
    expect(edge1Links[0].targetPortId).not.toEqual(edge2Links[0].targetPortId);
  });
});
