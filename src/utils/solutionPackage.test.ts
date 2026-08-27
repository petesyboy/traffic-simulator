import { describe, it, expect, vi } from 'vitest';
import { generateAllSolutionAssets, exportSolutionToDirectoryOrZip } from './solutionPackage';
import type { CustomNode } from '../store/types';
import type { Edge } from '@xyflow/react';

describe('solutionPackage', () => {
  const mockNodes: CustomNode[] = [
    {
      id: 'hc1',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'GigaVUE-HC1 - Core',
        model: 'GigaVUE-HC1',
        sku: 'HC1-BASE',
        configType: 'Hardware',
        site: 'DC1',
      },
    },
  ];

  const mockEdges: Edge[] = [];

  it('generates all standardized solution deliverable files in memory', async () => {
    const assets = await generateAllSolutionAssets({
      nodes: mockNodes,
      edges: mockEdges,
      trafficStreams: [],
      currentScenarioName: 'City of Goteborg',
      advancedMode: true,
      projectLicenseMode: 'Perpetual',
      defaultTermDuration: '36',
      projectRegion: 'US',
    });

    const filenames = assets.map((a) => a.filename);

    expect(filenames).toContain('Solution_Overview_City_of_Goteborg.json');
    expect(filenames).toContain('Bill_of_Materials_City_of_Goteborg.csv');
    expect(filenames).toContain('Bill_of_Materials_Deployment_Report_City_of_Goteborg.csv');
    expect(filenames).toContain('Commercial_Quote_City_of_Goteborg.csv');
    expect(filenames).toContain('Commercial_Quote_City_of_Goteborg.json');

    // Check BOM CSV content
    const bomAsset = assets.find((a) => a.filename.includes('Bill_of_Materials_City_of_Goteborg.csv'));
    expect(bomAsset).toBeDefined();
    expect(typeof bomAsset?.content).toBe('string');
    expect(bomAsset?.content as string).toContain('Site / Location,Type,SKU,Description,Term,Qty');

    // Check JSON content
    const jsonAsset = assets.find((a) => a.filename.includes('Solution_Overview_City_of_Goteborg.json'));
    expect(jsonAsset).toBeDefined();
    expect(typeof jsonAsset?.content).toBe('string');
    expect(jsonAsset?.content as string).toContain('"nodes"');
  }, 15000);

  it('exports all assets to ZIP package when directory picker is unavailable', async () => {
    const promptMock = vi.fn().mockReturnValue('Solution_Package_City_of_Goteborg.zip');
    (globalThis as unknown as Record<string, unknown>).window = {
      prompt: promptMock,
    };

    const result = await exportSolutionToDirectoryOrZip({
      nodes: mockNodes,
      edges: mockEdges,
      trafficStreams: [],
      currentScenarioName: 'City of Goteborg',
      advancedMode: true,
    });

    expect(result.fileCount).toBeGreaterThan(0);
  }, 15000);
});
