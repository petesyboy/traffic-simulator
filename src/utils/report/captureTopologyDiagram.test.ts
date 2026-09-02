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

  it('groups standalone VMware / virtual cloud estates with their connected destination chassis', () => {
    const nodes: CustomNode[] = [
      {
        id: 'vmware-estate-1',
        type: 'virtualNode',
        position: { x: 0, y: 300 },
        data: { label: 'VMware Estate 1', site: 'VMware Private Cloud', model: 'VMware Virtual TAP' },
      } as CustomNode,
      {
        id: 'ta25e-dc1',
        type: 'hardwareNode',
        position: { x: 300, y: 300 },
        data: { label: 'GigaVUE-TA25E - DC1', site: 'DC1', model: 'GigaVUE-TA25E' },
      } as CustomNode,
      {
        id: 'ta25e-dc2',
        type: 'hardwareNode',
        position: { x: 300, y: 100 },
        data: { label: 'GigaVUE-TA25E - DC2', site: 'DC2', model: 'GigaVUE-TA25E' },
      } as CustomNode,
    ];

    const edges: Edge[] = [
      { id: 'e-vmware', source: 'vmware-estate-1', target: 'ta25e-dc1' },
    ];

    const result = detectDiagramSplitting(nodes, edges);
    expect(result.shouldSplit).toBe(true);

    const vmwarePartition = result.partitions.find((p) => p.siteName === 'VMware Private Cloud');
    expect(vmwarePartition?.nodeIds).toContain('vmware-estate-1');
    expect(vmwarePartition?.nodeIds).toContain('ta25e-dc1');
  });

  it('includes connected DWDM transport networks in each participating data centre partition', () => {
    const nodes: CustomNode[] = [
      {
        id: 'dc1-ta',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: { label: 'DC1 TA200', site: 'DC1', model: 'GigaVUE-TA200' },
      } as CustomNode,
      {
        id: 'dc2-ta',
        type: 'hardwareNode',
        position: { x: 0, y: 300 },
        data: { label: 'DC2 TA200', site: 'DC2', model: 'GigaVUE-TA200' },
      } as CustomNode,
      {
        id: 'dwdm-ring',
        type: 'dwdmNetworkNode',
        position: { x: 300, y: 150 },
        data: { label: 'Core DWDM Ring', configType: 'dwdmNetwork' },
      } as CustomNode,
    ];

    const edges: Edge[] = [
      { id: 'e-dc1-dwdm', source: 'dc1-ta', target: 'dwdm-ring' },
      { id: 'e-dc2-dwdm', source: 'dc2-ta', target: 'dwdm-ring' },
    ];

    const result = detectDiagramSplitting(nodes, edges);
    expect(result.shouldSplit).toBe(true);
    expect(result.partitions).toHaveLength(2);

    const dc1Partition = result.partitions.find((p) => p.siteName === 'DC1');
    expect(dc1Partition?.nodeIds).toContain('dc1-ta');
    expect(dc1Partition?.nodeIds).toContain('dwdm-ring');
    expect(dc1Partition?.nodeIds).not.toContain('dc2-ta');

    const dc2Partition = result.partitions.find((p) => p.siteName === 'DC2');
    expect(dc2Partition?.nodeIds).toContain('dc2-ta');
    expect(dc2Partition?.nodeIds).toContain('dwdm-ring');
    expect(dc2Partition?.nodeIds).not.toContain('dc1-ta');
  });
});

describe('prepareTopologyForDiagramCapture', () => {
  it('collapses existing expanded cluster nodes into compact stacks for screenshots', () => {
    const clusterNode = {
      id: 'cluster-taps',
      type: 'clusterNode',
      position: { x: 50, y: 100 },
      data: {
        clusterType: 'tap',
        isCollapsed: false,
        memberNodeIds: ['tap-1', 'tap-2'],
      },
    } as unknown as CustomNode;

    const tap1 = {
      id: 'tap-1',
      type: 'hardwareNode',
      position: { x: 50, y: 100 },
      data: { label: 'TAP 1', clusterId: 'cluster-taps' },
      hidden: false,
    } as unknown as CustomNode;

    const tap2 = {
      id: 'tap-2',
      type: 'hardwareNode',
      position: { x: 50, y: 200 },
      data: { label: 'TAP 2', clusterId: 'cluster-taps' },
      hidden: false,
    } as unknown as CustomNode;

    const { nodes } = prepareTopologyForDiagramCapture([clusterNode, tap1, tap2], []);
    const cluster = nodes.find((n) => n.id === 'cluster-taps');
    expect(cluster?.data?.isCollapsed).toBe(true);
  });

  it('preserves unclustered user layout while auto-spacing for export description boxes', () => {
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

    // Unclustered layout is preserved without cross-site forced grouping
    const clusters = nodes.filter((n) => n.type === 'clusterNode');
    expect(clusters).toHaveLength(0);
    expect(nodes).toHaveLength(7);
    expect(preparedEdges).toHaveLength(6);
  });
});
