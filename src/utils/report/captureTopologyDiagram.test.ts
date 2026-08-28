import { describe, it, expect } from 'vitest';
import { detectDiagramSplitting, prepareTopologyForDiagramCapture } from './captureTopologyDiagram';
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

describe('prepareTopologyForDiagramCapture', () => {
  it('automatically collapses > 4 unclustered TAPs into a single compact TAP stack for screenshots', () => {
    const tapNodes: CustomNode[] = Array.from({ length: 6 }, (_, i) => ({
      id: `tap-${i + 1}`,
      type: 'hardwareNode',
      position: { x: 50, y: i * 100 },
      data: {
        label: `TAP ${i + 1}`,
        model: 'TAP-M273T',
        sku: 'TAP-M273T',
        configType: 'TAP Module',
      },
    } as CustomNode));

    const chassisNode: CustomNode = {
      id: 'ta25e',
      type: 'hardwareNode',
      position: { x: 400, y: 200 },
      data: { label: 'TA25E', model: 'GigaVUE-TA25E', configType: 'Chassis' },
    } as CustomNode;

    const edges: Edge[] = tapNodes.map((t, idx) => ({
      id: `e-tap-${idx}`,
      source: t.id,
      target: 'ta25e',
      sourceHandle: 'out',
      targetHandle: 'in',
    }));

    const { nodes, edges: preparedEdges } = prepareTopologyForDiagramCapture([...tapNodes, chassisNode], edges);

    // Should contain 1 clusterNode + 6 hidden tap nodes + 1 chassis node
    const cluster = nodes.find((n) => n.type === 'clusterNode');
    expect(cluster).toBeDefined();
    expect(cluster?.data?.clusterType).toBe('tap');
    expect(cluster?.data?.isCollapsed).toBe(true);
    expect(cluster?.data?.summary?.count).toBe(6);

    // All original edges should now route through the cluster node
    preparedEdges.forEach((e) => {
      expect(e.source).toBe(cluster?.id);
    });
  });

  it('automatically collapses > 4 unclustered Tools into a single compact Tool stack for screenshots', () => {
    const toolNodes: CustomNode[] = Array.from({ length: 8 }, (_, i) => ({
      id: `tool-${i + 1}`,
      type: 'toolNode',
      position: { x: 800, y: i * 90 },
      data: {
        label: `Probe ${i + 1}`,
        model: 'Ericsson Probe',
        configType: 'Custom Tool',
        ingestLimitMbps: 10000,
      },
    } as CustomNode));

    const hc3Node: CustomNode = {
      id: 'hc3',
      type: 'hardwareNode',
      position: { x: 400, y: 300 },
      data: { label: 'HC3', model: 'GigaVUE-HC3', configType: 'Chassis' },
    } as CustomNode;

    const edges: Edge[] = toolNodes.map((t, idx) => ({
      id: `e-tool-${idx}`,
      source: 'hc3',
      target: t.id,
      sourceHandle: 'out',
      targetHandle: 'in',
    }));

    const { nodes, edges: preparedEdges } = prepareTopologyForDiagramCapture([hc3Node, ...toolNodes], edges);

    const cluster = nodes.find((n) => n.type === 'clusterNode');
    expect(cluster).toBeDefined();
    expect(cluster?.data?.clusterType).toBe('tool');
    expect(cluster?.data?.isCollapsed).toBe(true);
    expect(cluster?.data?.summary?.count).toBe(8);

    preparedEdges.forEach((e) => {
      expect(e.target).toBe(cluster?.id);
    });
  });

  it('leaves <= 4 TAPs and Tools as individual nodes without clustering', () => {
    const tapNodes: CustomNode[] = Array.from({ length: 3 }, (_, i) => ({
      id: `tap-${i + 1}`,
      type: 'hardwareNode',
      position: { x: 50, y: i * 100 },
      data: { label: `TAP ${i + 1}`, model: 'TAP-M273T', sku: 'TAP-M273T' },
    } as CustomNode));

    const { nodes } = prepareTopologyForDiagramCapture(tapNodes, []);
    const clusters = nodes.filter((n) => n.type === 'clusterNode');
    expect(clusters).toHaveLength(0);
    expect(nodes).toHaveLength(3);
  });
});
