import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAllSolutionAssets, exportSolutionToDirectoryOrZip } from './solutionPackage';
import * as captureDiagramModule from './report/captureTopologyDiagram';
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
    vi.spyOn(captureDiagramModule, 'captureTopologyDiagramForReport').mockResolvedValue(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    );
  });

  it('generates the 6 canonical solution deliverable files in memory', async () => {
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

    expect(filenames).toHaveLength(6);
    expect(filenames).toContain('Solution_Overview_City_of_Goteborg.json');
    expect(filenames).toContain('Bill_of_Materials_City_of_Goteborg.csv');
    expect(filenames).toContain('Bill_of_Materials_Deployment_Report_City_of_Goteborg.csv');
    expect(filenames).toContain('Gigamon_Architecture_Diagram_City_of_Goteborg.png');
    expect(filenames).toContain('Gigamon_Architecture_City_of_Goteborg.pdf');
    expect(filenames).toContain('Gigamon_Architecture_Uplink_City_of_Goteborg.pdf');

    // No commercial quotes in deliverables dump
    expect(filenames).not.toContain('Commercial_Quote_City_of_Goteborg.csv');
    expect(filenames).not.toContain('Commercial_Quote_City_of_Goteborg.json');
    expect(filenames).not.toContain('Commercial_Quote_City_of_Goteborg.pdf');
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
