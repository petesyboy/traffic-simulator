import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import type { CustomNode } from './types';

const initialState = useStore.getState();

describe('history slice (undo/redo)', () => {
  beforeEach(() => {
    // Zustand's setState replace flag resets to a clean slate between tests,
    // since useStore is a module-level singleton shared across the test file.
    useStore.setState(initialState, true);
  });

  const makeNode = (id: string): CustomNode => ({
    id,
    type: 'inputNode',
    position: { x: 0, y: 0 },
    data: { label: id, configType: 'TAP' },
  });

  it('undoes and redoes addNode', () => {
    const nodesBefore = useStore.getState().nodes;
    useStore.getState().addNode(makeNode('n-test-1'));
    expect(useStore.getState().nodes).toHaveLength(nodesBefore.length + 1);

    useStore.getState().undo();
    expect(useStore.getState().nodes).toEqual(nodesBefore);

    useStore.getState().redo();
    expect(useStore.getState().nodes.map(n => n.id)).toContain('n-test-1');
  });

  it('undoes a node deletion via onNodesChange', () => {
    useStore.getState().addNode(makeNode('n-test-2'));
    const nodesWithNew = useStore.getState().nodes;

    useStore.getState().onNodesChange([{ type: 'remove', id: 'n-test-2' }]);
    expect(useStore.getState().nodes.find(n => n.id === 'n-test-2')).toBeUndefined();

    useStore.getState().undo();
    expect(useStore.getState().nodes).toEqual(nodesWithNew);
  });

  it('clears the redo stack once a new action is taken after an undo', () => {
    useStore.getState().addNode(makeNode('n-a'));
    useStore.getState().addNode(makeNode('n-b'));
    useStore.getState().undo();
    expect(useStore.getState().historyFuture.length).toBeGreaterThan(0);

    useStore.getState().addNode(makeNode('n-c'));
    expect(useStore.getState().historyFuture).toHaveLength(0);
  });

  it('is a no-op when there is nothing to undo or redo', () => {
    const before = useStore.getState().nodes;
    useStore.getState().undo();
    expect(useStore.getState().nodes).toEqual(before);
    useStore.getState().redo();
    expect(useStore.getState().nodes).toEqual(before);
  });

  it('clears history on restoreState (loading a different topology)', () => {
    useStore.getState().addNode(makeNode('n-test-3'));
    expect(useStore.getState().historyPast.length).toBeGreaterThan(0);

    useStore.getState().restoreState([makeNode('fresh')], []);
    expect(useStore.getState().historyPast).toHaveLength(0);
    expect(useStore.getState().historyFuture).toHaveLength(0);
  });
});
