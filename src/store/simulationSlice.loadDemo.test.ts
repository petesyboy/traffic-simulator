import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';

const initialState = useStore.getState();

describe('loadDemo (reset to default demo layout)', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
  });

  it('targets the ExtraHop tool node for zoom and bumps the trigger', () => {
    const triggerBefore = useStore.getState().zoomToNodeTrigger;

    useStore.getState().loadDemo();

    const state = useStore.getState();
    expect(state.zoomToNodeId).toBe('node-tool-1');
    expect(state.nodes.find((n) => n.id === 'node-tool-1')?.data.toolName).toBe('ExtraHop');
    expect(state.zoomToNodeTrigger).toBe(triggerBefore + 1);
  });

  it('bumps the trigger again on a subsequent reset so the effect re-fires', () => {
    useStore.getState().loadDemo();
    const triggerAfterFirst = useStore.getState().zoomToNodeTrigger;

    useStore.getState().loadDemo();

    expect(useStore.getState().zoomToNodeTrigger).toBe(triggerAfterFirst + 1);
  });
});
