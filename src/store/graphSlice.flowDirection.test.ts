import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import type { CustomNode } from './types';

const initialState = useStore.getState();

const makeNode = (id: string, overrides: Partial<CustomNode> = {}): CustomNode => ({
  id,
  type: 'hardwareNode',
  position: { x: 0, y: 0 },
  data: { label: id, configType: 'Hardware' },
  ...overrides,
});

describe('flow direction actions', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
    useStore.setState({ nodes: [], edges: [], selectedNodeId: null });
  });

  it('setNodeFlowDirection locks the choice so auto-layout leaves it alone', () => {
    useStore.setState({ nodes: [makeNode('a'), makeNode('b')] });

    useStore.getState().setNodeFlowDirection('a', 'rtl');

    const [a, b] = useStore.getState().nodes;
    expect(a.data.flowDirection).toBe('rtl');
    expect(a.data.flowDirectionLocked).toBe(true);
    // Untouched nodes stay untouched
    expect(b.data.flowDirection).toBeUndefined();
  });

  it("setNodeFlowDirection 'auto' hands the node back to the layout engine", () => {
    useStore.setState({ nodes: [makeNode('a', { data: { label: 'a', configType: 'Hardware', flowDirection: 'rtl', flowDirectionLocked: true } })] });

    useStore.getState().setNodeFlowDirection('a', 'auto');

    const [a] = useStore.getState().nodes;
    expect(a.data.flowDirection).toBeUndefined();
    expect(a.data.flowDirectionLocked).toBeUndefined();
  });

  it('mirrorSelectedNodes flips every selected node and is undoable', () => {
    useStore.setState({
      nodes: [
        makeNode('a', { selected: true }),
        makeNode('b', { selected: true }),
        makeNode('c'),
      ],
    });

    useStore.getState().mirrorSelectedNodes();

    const byId = new Map(useStore.getState().nodes.map((n) => [n.id, n]));
    expect(byId.get('a')!.data.flowDirection).toBe('rtl');
    expect(byId.get('b')!.data.flowDirection).toBe('rtl');
    expect(byId.get('c')!.data.flowDirection).toBeUndefined();

    useStore.getState().undo();
    expect(useStore.getState().nodes.every((n) => n.data.flowDirection === undefined)).toBe(true);
  });

  it('mirrorSelectedNodes toggles a mirrored node back', () => {
    useStore.setState({ nodes: [makeNode('a', { selected: true, data: { label: 'a', configType: 'Hardware', flowDirection: 'rtl' } })] });

    useStore.getState().mirrorSelectedNodes();

    expect(useStore.getState().nodes[0].data.flowDirection).toBe('ltr');
  });

  it('mirrorSelectedNodes falls back to the node open in the config panel', () => {
    useStore.setState({ nodes: [makeNode('a'), makeNode('b')], selectedNodeId: 'b' });

    useStore.getState().mirrorSelectedNodes();

    const byId = new Map(useStore.getState().nodes.map((n) => [n.id, n]));
    expect(byId.get('b')!.data.flowDirection).toBe('rtl');
    expect(byId.get('a')!.data.flowDirection).toBeUndefined();
  });

  it('mirrorSelectedNodes is a no-op with nothing selected', () => {
    const nodes = [makeNode('a')];
    useStore.setState({ nodes });

    useStore.getState().mirrorSelectedNodes();

    expect(useStore.getState().nodes).toBe(nodes);
  });

  it('setSelectionFlowDirection sets one direction across a mixed selection', () => {
    useStore.setState({
      nodes: [
        makeNode('a', { selected: true }),
        makeNode('b', { selected: true, data: { label: 'b', configType: 'Hardware', flowDirection: 'rtl', flowDirectionLocked: true } }),
        makeNode('c', { selected: true, data: { label: 'c', configType: 'Hardware', flowDirection: 'ltr', flowDirectionLocked: true } }),
        makeNode('d'),
      ],
    });

    useStore.getState().setSelectionFlowDirection('rtl');

    const byId = new Map(useStore.getState().nodes.map((n) => [n.id, n]));
    // Every selected node ends up the same way round - unlike mirroring, which
    // would have flipped each one and left the selection mixed.
    expect(byId.get('a')!.data.flowDirection).toBe('rtl');
    expect(byId.get('b')!.data.flowDirection).toBe('rtl');
    expect(byId.get('c')!.data.flowDirection).toBe('rtl');
    expect(byId.get('d')!.data.flowDirection).toBeUndefined();
  });

  it("setSelectionFlowDirection 'auto' clears the lock across the selection", () => {
    useStore.setState({
      nodes: [
        makeNode('a', { selected: true, data: { label: 'a', configType: 'Hardware', flowDirection: 'rtl', flowDirectionLocked: true } }),
        makeNode('b', { selected: true, data: { label: 'b', configType: 'Hardware', flowDirection: 'ltr', flowDirectionLocked: true } }),
      ],
    });

    useStore.getState().setSelectionFlowDirection('auto');

    useStore.getState().nodes.forEach((n) => {
      expect(n.data.flowDirection).toBeUndefined();
      expect(n.data.flowDirectionLocked).toBeUndefined();
    });
  });

  it('setSelectionFlowDirection falls back to the node open in the config panel', () => {
    useStore.setState({ nodes: [makeNode('a'), makeNode('b')], selectedNodeId: 'b' });

    useStore.getState().setSelectionFlowDirection('rtl');

    const byId = new Map(useStore.getState().nodes.map((n) => [n.id, n]));
    expect(byId.get('b')!.data.flowDirection).toBe('rtl');
    expect(byId.get('a')!.data.flowDirection).toBeUndefined();
  });

  it('setSelectionFlowDirection is undoable and a no-op with nothing selected', () => {
    const nodes = [makeNode('a')];
    useStore.setState({ nodes });
    useStore.getState().setSelectionFlowDirection('rtl');
    expect(useStore.getState().nodes).toBe(nodes);

    useStore.setState({ nodes: [makeNode('a', { selected: true })] });
    useStore.getState().setSelectionFlowDirection('rtl');
    expect(useStore.getState().nodes[0].data.flowDirection).toBe('rtl');
    useStore.getState().undo();
    expect(useStore.getState().nodes[0].data.flowDirection).toBeUndefined();
  });
});
