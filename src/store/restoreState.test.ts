import { describe, it, expect } from 'vitest';
import { useStore } from './store';

describe('restoreState scenario import', () => {
  it('successfully restores the 2-site HC3 and TA25E scenario JSON', () => {
    const scenarioJson = {
      nodes: [
        {
          id: '3de7a60b-956e-4c50-9178-9e39cb67ed89',
          type: 'hardwareNode',
          position: { x: 390.5, y: 567.5 },
          data: {
            label: 'GigaVUE-TA25E',
            configType: 'Hardware',
            model: 'GigaVUE-TA25E',
            sku: 'TA25E-BASE',
            site: 'Site A',
          },
        },
        {
          id: 'dfb89c97-c63b-4bb8-b8b8-2fd43367152f',
          type: 'hardwareNode',
          position: { x: 800.5, y: 646.5 },
          data: {
            label: 'GigaVUE-HC3',
            configType: 'Hardware',
            model: 'GigaVUE-HC3',
            sku: 'HC3-BASE',
            site: 'Site A',
          },
        },
        {
          id: 'hardwareNode-ce7071d4-0e56-487f-8d96-ab0b5c296531',
          type: 'hardwareNode',
          position: { x: 2630.5, y: 1516.5 },
          data: {
            label: 'GigaVUE-HC3 #2',
            configType: 'Hardware',
            model: 'GigaVUE-HC3',
            sku: 'HC3-BASE',
            site: 'Site B',
          },
        },
      ],
      edges: [
        {
          id: 'e-1',
          source: '3de7a60b-956e-4c50-9178-9e39cb67ed89',
          target: 'dfb89c97-c63b-4bb8-b8b8-2fd43367152f',
        },
      ],
      trafficStreams: [],
      settings: {
        advancedMode: true,
        projectLicenseMode: 'HTL' as const,
        defaultTermDuration: '36',
        projectRegion: 'EU' as const,
      },
    };

    useStore.getState().restoreState(
      scenarioJson.nodes as any,
      scenarioJson.edges as any,
      scenarioJson.trafficStreams as any,
      scenarioJson.settings
    );

    const state = useStore.getState();
    expect(state.nodes.length).toBe(3);
    expect(state.advancedMode).toBe(true);
    expect(state.projectLicenseMode).toBe('HTL');
    expect(state.defaultTermDuration).toBe('36');
    expect(state.projectRegion).toBe('EU');
  });
});
