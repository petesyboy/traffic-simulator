import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from './store';

const initialState = useStore.getState();

/**
 * The suite runs in a node environment, so document and localStorage are
 * stubbed here rather than assumed - which also proves the slice guards both
 * before touching them.
 */
function stubBrowser() {
  const attrs = new Map<string, string>();
  const store = new Map<string, string>();
  vi.stubGlobal('document', {
    documentElement: {
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      getAttribute: (k: string) => attrs.get(k) ?? null,
    },
  });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  return { attrs, store };
}

describe('colour vision setting', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to the standard palette', () => {
    expect(useStore.getState().colourVisionMode).toBe('off');
  });

  it('stamps the mode on the document so the palette can swap in CSS', () => {
    const { attrs } = stubBrowser();

    useStore.getState().setColourVisionMode('red-green');
    expect(attrs.get('data-colour-vision')).toBe('red-green');

    useStore.getState().setColourVisionMode('off');
    expect(attrs.get('data-colour-vision')).toBe('off');
  });

  it('remembers the choice for the person, not the project', () => {
    const { store } = stubBrowser();

    useStore.getState().setColourVisionMode('red-green');

    // Its own key rather than the project payload, so opening someone else's
    // topology cannot silently turn it off.
    expect(store.get('fm-simulator-colour-vision')).toBe('red-green');
  });

  it('survives a project load, which replaces graph and settings state', () => {
    stubBrowser();
    useStore.getState().setColourVisionMode('red-green');

    useStore.getState().restoreState([], [], [], {});

    expect(useStore.getState().colourVisionMode).toBe('red-green');
  });

  it('works with neither document nor localStorage present', () => {
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('localStorage', undefined);

    expect(() => useStore.getState().setColourVisionMode('red-green')).not.toThrow();
    expect(useStore.getState().colourVisionMode).toBe('red-green');
  });
});
