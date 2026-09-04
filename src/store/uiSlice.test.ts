import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from './store';

function installFakeDOM() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  });

  const attrs = new Map<string, string>();
  vi.stubGlobal('document', {
    documentElement: {
      getAttribute: (name: string) => attrs.get(name) ?? null,
      setAttribute: (name: string, value: string) => {
        attrs.set(name, String(value));
      },
    },
  });
}

describe('uiSlice theme management', () => {
  beforeEach(() => {
    installFakeDOM();
  });

  it('toggles theme between dark and light', () => {
    useStore.getState().setTheme('dark');
    expect(useStore.getState().theme).toBe('dark');
    expect(localStorage.getItem('fm-simulator-theme')).toBe('dark');

    useStore.getState().toggleTheme();
    expect(useStore.getState().theme).toBe('light');
    expect(localStorage.getItem('fm-simulator-theme')).toBe('light');

    useStore.getState().toggleTheme();
    expect(useStore.getState().theme).toBe('dark');
    expect(localStorage.getItem('fm-simulator-theme')).toBe('dark');
  });

  it('updates documentElement data-theme attribute on theme change', () => {
    useStore.getState().setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    useStore.getState().setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('updates currentScenarioName and syncs to fm-simulator-last-slot and fm-simulator-autosave', () => {
    localStorage.setItem(
      'fm-simulator-autosave',
      JSON.stringify({ nodes: [], edges: [], projectName: 'Old Project' })
    );

    useStore.getState().setCurrentScenarioName('Saab-DUAL-TA25E');
    expect(useStore.getState().currentScenarioName).toBe('Saab-DUAL-TA25E');
    expect(localStorage.getItem('fm-simulator-last-slot')).toBe('Saab-DUAL-TA25E');

    const autosave = JSON.parse(localStorage.getItem('fm-simulator-autosave') || '{}');
    expect(autosave.projectName).toBe('Saab-DUAL-TA25E');

    useStore.getState().setCurrentScenarioName(null);
    expect(useStore.getState().currentScenarioName).toBeNull();
    expect(localStorage.getItem('fm-simulator-last-slot')).toBeNull();
  });
});
