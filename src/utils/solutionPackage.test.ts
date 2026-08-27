import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAllSolutionAssets, exportSolutionToDirectoryOrZip } from './solutionPackage';
import { saveProjectQuoteWorkspace, clearProjectQuoteWorkspace } from './projectQuoteStorage';
import { DEFAULT_DISCOUNT_CONFIG } from './pricingEngine';
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
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        mockStorage = {};
      },
    });
  });

  it('omits commercial quote when no discounting is configured', async () => {
    clearProjectQuoteWorkspace('City of Goteborg');

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

    // Architectural and engineering assets are present
    expect(filenames).toContain('Solution_Overview_City_of_Goteborg.json');
    expect(filenames).toContain('Bill_of_Materials_City_of_Goteborg.csv');
    expect(filenames).toContain('Bill_of_Materials_Deployment_Report_City_of_Goteborg.csv');
    expect(filenames).toContain('Gigamon_Architecture_City_of_Goteborg.pdf');

    // Commercial quotes are cleanly omitted
    expect(filenames).not.toContain('Commercial_Quote_City_of_Goteborg.csv');
    expect(filenames).not.toContain('Commercial_Quote_City_of_Goteborg.json');
    expect(filenames).not.toContain('Commercial_Quote_City_of_Goteborg.pdf');
  }, 15000);

  it('includes commercial quote when discounting is configured for the project', async () => {
    saveProjectQuoteWorkspace('City of Goteborg', {
      discountConfig: {
        ...DEFAULT_DISCOUNT_CONFIG,
        global: 20,
      },
      excludeOptics: false,
      freePowerCords: false,
      spanOnlyMode: false,
    });

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
    expect(filenames).toContain('Gigamon_Architecture_City_of_Goteborg.pdf');
    expect(filenames).toContain('Commercial_Quote_City_of_Goteborg.csv');
    expect(filenames).toContain('Commercial_Quote_City_of_Goteborg.json');
    expect(filenames).toContain('Commercial_Quote_City_of_Goteborg.pdf');
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
