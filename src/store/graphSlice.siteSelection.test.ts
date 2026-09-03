import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import type { CustomNode } from './types';

const initialState = useStore.getState();

const makeNode = (id: string, site?: string, overrides: Partial<CustomNode> = {}): CustomNode =>
  ({
    id,
    type: 'hardwareNode',
    position: { x: 0, y: 0 },
    data: { label: id, configType: 'Hardware', site },
    ...overrides,
  }) as CustomNode;

describe('site selection and bulk move', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
    useStore.setState({ nodes: [], edges: [], selectedNodeId: null });
  });

  it('selectNodesBySite selects every device in that data centre and nothing else', () => {
    useStore.setState({
      nodes: [makeNode('a', 'DC1'), makeNode('b', 'DC1'), makeNode('c', 'DC2'), makeNode('d')],
    });

    useStore.getState().selectNodesBySite('DC1');

    const byId = new Map(useStore.getState().nodes.map((n) => [n.id, n]));
    expect(byId.get('a')!.selected).toBe(true);
    expect(byId.get('b')!.selected).toBe(true);
    expect(byId.get('c')!.selected).toBe(false);
    expect(byId.get('d')!.selected).toBe(false);
    // Cleared so the panel shows the multi-selection rather than one node.
    expect(useStore.getState().selectedNodeId).toBeNull();
  });

  it('selectNodesBySite ignores surrounding whitespace on the site tag', () => {
    useStore.setState({ nodes: [makeNode('a', ' DC1 ')] });
    useStore.getState().selectNodesBySite('DC1');
    expect(useStore.getState().nodes[0].selected).toBe(true);
  });

  it('selectNodesBySite replaces an existing selection', () => {
    useStore.setState({
      nodes: [makeNode('a', 'DC1', { selected: true }), makeNode('c', 'DC2')],
    });

    useStore.getState().selectNodesBySite('DC2');

    const byId = new Map(useStore.getState().nodes.map((n) => [n.id, n]));
    expect(byId.get('a')!.selected).toBe(false);
    expect(byId.get('c')!.selected).toBe(true);
  });

  it('moveNodesTo writes only the positions it is given', () => {
    useStore.setState({
      nodes: [
        makeNode('a', 'DC1', { position: { x: 10, y: 20 } }),
        makeNode('b', 'DC2', { position: { x: 50, y: 60 } }),
      ],
    });

    useStore.getState().moveNodesTo([{ id: 'a', position: { x: 110, y: 120 } }]);

    const byId = new Map(useStore.getState().nodes.map((n) => [n.id, n]));
    expect(byId.get('a')!.position).toEqual({ x: 110, y: 120 });
    expect(byId.get('b')!.position).toEqual({ x: 50, y: 60 });
  });

  it('moveNodesTo with nothing to move leaves the nodes untouched', () => {
    const nodes = [makeNode('a', 'DC1')];
    useStore.setState({ nodes });
    useStore.getState().moveNodesTo([]);
    expect(useStore.getState().nodes).toBe(nodes);
  });
});
