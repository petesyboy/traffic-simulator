import { describe, it, expect } from 'vitest';
import { detectDiagramSplitting } from './captureTopologyDiagram';
import type { CustomNode } from '../../store/types';
import type { Edge } from '@xyflow/react';

describe('detectDiagramSplitting', () => {
  it('returns shouldSplit: false for single site or unassigned topologies', () => {
    const nodes: CustomNode[] = [
      {
        id: 'n1',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: { label: 'TA25 #1', site: 'Site Alpha' },
      } as CustomNode,
      {
        id: 'n2',
        type: 'hardwareNode',
        position: { x: 100, y: 0 },
        data: { label: 'TA25 #2', site: 'Site Alpha' },
      } as CustomNode,
    ];

    const result = detectDiagramSplitting(nodes, []);
    expect(result.shouldSplit).toBe(false);
    expect(result.partitions).toHaveLength(0);
  });

  it('detects multiple sites and creates focused partitions for each site', () => {
    const nodes: CustomNode[] = [
      {
        id: 'n-alpha-1',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: { label: 'Alpha TA25', site: 'Site Alpha' },
      } as CustomNode,
      {
        id: 'n-beta-1',
        type: 'hardwareNode',
        position: { x: 200, y: 0 },
        data: { label: 'Beta HC3', site: 'Site Beta' },
      } as CustomNode,
      {
        id: 'tool-beta',
        type: 'toolNode',
        position: { x: 300, y: 0 },
        data: { label: 'Beta Probe' },
      } as CustomNode,
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'n-beta-1', target: 'tool-beta' },
    ];

    const result = detectDiagramSplitting(nodes, edges);
    expect(result.shouldSplit).toBe(true);
    expect(result.partitions).toHaveLength(2);

    const alphaPartition = result.partitions.find((p) => p.siteName === 'Site Alpha');
    expect(alphaPartition?.nodeIds).toContain('n-alpha-1');

    const betaPartition = result.partitions.find((p) => p.siteName === 'Site Beta');
    expect(betaPartition?.nodeIds).toContain('n-beta-1');
    expect(betaPartition?.nodeIds).toContain('tool-beta');
  });

  it('does not leak nodes with conflicting sites when connected across sites', () => {
    const nodes: CustomNode[] = [
      {
        id: 'n-alpha',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: { label: 'Alpha TA25', site: 'Site Alpha' },
      } as CustomNode,
      {
        id: 'n-beta',
        type: 'hardwareNode',
        position: { x: 200, y: 0 },
        data: { label: 'Beta HC3', site: 'Site Beta' },
      } as CustomNode,
    ];

    const edges: Edge[] = [
      { id: 'inter-site-link', source: 'n-alpha', target: 'n-beta' },
    ];

    const result = detectDiagramSplitting(nodes, edges);
    const alphaPartition = result.partitions.find((p) => p.siteName === 'Site Alpha');
    const betaPartition = result.partitions.find((p) => p.siteName === 'Site Beta');

    expect(alphaPartition?.nodeIds).toEqual(['n-alpha']);
    expect(betaPartition?.nodeIds).toEqual(['n-beta']);
  });
});
