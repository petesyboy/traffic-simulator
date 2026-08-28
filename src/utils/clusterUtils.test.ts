import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { CustomNode } from '../store/types';
import {
  buildClusterNode,
  expandClusterNode,
  collapseClusterNode,
  dissolveClusterNode,
  buildClusterSummary,
  isTapNode,
  isToolNode,
} from './clusterUtils';
import { generateBom } from './bom/bomGenerator';

describe('clusterUtils', () => {
  const createMockTap = (id: string, model: string, sku: string, tappedLinksCount = 6): CustomNode => ({
    id,
    type: 'hardwareNode',
    position: { x: 100, y: 100 },
    data: {
      label: model,
      model,
      sku,
      configType: 'Hardware',
      tappedLinksCount,
    },
  });

  const createMockTool = (id: string, toolName: string, ingestLimitMbps = 10000): CustomNode => ({
    id,
    type: 'toolNode',
    position: { x: 800, y: 100 },
    data: {
      label: toolName,
      toolName,
      configType: 'Packet Tool',
      ingestLimitMbps,
    },
  });

  it('identifies TAP and Tool nodes correctly', () => {
    const tap = createMockTap('t1', 'TAP-M251T', 'TAP-M251T');
    const tool = createMockTool('tl1', 'Ericsson Probe');
    const input = { id: 'in1', type: 'inputNode', position: { x: 0, y: 0 }, data: { label: 'In', configType: 'SPAN Port' } };

    expect(isTapNode(tap)).toBe(true);
    expect(isTapNode(tool)).toBe(false);
    expect(isToolNode(tool)).toBe(true);
    expect(isToolNode(tap)).toBe(false);
    expect(isTapNode(input as CustomNode)).toBe(false);
  });

  it('extracts fiber type, split ratio, and link counts for homogeneous TAP clusters', () => {
    const taps = Array.from({ length: 8 }, (_, i) =>
      createMockTap(`t-${i}`, 'TAP-M251T', 'TAP-M251T', 6),
    );
    const summary = buildClusterSummary(taps, 'tap');

    expect(summary.count).toBe(8);
    expect(summary.totalLinks).toBe(48);
    expect(summary.isMixed).toBe(false);
    expect(summary.breakdown).toHaveLength(1);
    expect(summary.breakdown[0].model).toBe('TAP-M251T');
    expect(summary.breakdown[0].count).toBe(8);
    expect(summary.breakdown[0].totalLinks).toBe(48);
  });

  it('handles heterogeneous / mixed TAP clusters (multimode 50/50 and singlemode 70/30)', () => {
    const mmTaps = Array.from({ length: 4 }, (_, i) =>
      createMockTap(`mm-${i}`, 'TAP-M251T', 'TAP-M251T', 6),
    );
    const smTaps = Array.from({ length: 4 }, (_, i) =>
      createMockTap(`sm-${i}`, 'TAP-M273T', 'TAP-M273T', 6),
    );
    const mixedTaps = [...mmTaps, ...smTaps];
    const summary = buildClusterSummary(mixedTaps, 'tap');

    expect(summary.count).toBe(8);
    expect(summary.totalLinks).toBe(48);
    expect(summary.isMixed).toBe(true);
    expect(summary.breakdown).toHaveLength(2);

    const mmEntry = summary.breakdown.find(b => b.model === 'TAP-M251T');
    const smEntry = summary.breakdown.find(b => b.model === 'TAP-M273T');

    expect(mmEntry).toBeDefined();
    expect(mmEntry?.count).toBe(4);
    expect(mmEntry?.fiberType).toContain('Multimode');
    expect(mmEntry?.splitRatio).toBe('50/50');
    expect(mmEntry?.totalLinks).toBe(24);

    expect(smEntry).toBeDefined();
    expect(smEntry?.count).toBe(4);
    expect(smEntry?.fiberType).toContain('Singlemode');
    expect(smEntry?.splitRatio).toBe('70/30');
    expect(smEntry?.totalLinks).toBe(24);
  });

  it('builds a collapsed cluster node and reroutes external edges', () => {
    const taps = [
      createMockTap('t1', 'TAP-M251T', 'TAP-M251T', 6),
      createMockTap('t2', 'TAP-M251T', 'TAP-M251T', 6),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 't1', sourceHandle: 'out', target: 'hc3', targetHandle: 'in' },
      { id: 'e2', source: 't2', sourceHandle: 'out', target: 'hc3', targetHandle: 'in' },
    ];

    const { clusterNode, updatedNodes, updatedEdges } = buildClusterNode(taps, edges, 'tap');

    expect(clusterNode.type).toBe('clusterNode');
    expect(clusterNode.data?.isCollapsed).toBe(true);
    expect(clusterNode.data?.summary?.count).toBe(2);
    expect(clusterNode.data?.summary?.totalLinks).toBe(12);

    // Member nodes should be marked hidden
    expect(updatedNodes.every(n => n.hidden === true)).toBe(true);
    expect(updatedNodes.every(n => n.data?.clusterId === clusterNode.id)).toBe(true);

    // Edges should now point from cluster node
    expect(updatedEdges.every(e => e.source === clusterNode.id)).toBe(true);
  });

  it('expands and collapses the cluster smoothly, restoring edges', () => {
    const taps = [
      createMockTap('t1', 'TAP-M251T', 'TAP-M251T', 6),
      createMockTap('t2', 'TAP-M251T', 'TAP-M251T', 6),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 't1', sourceHandle: 'out', target: 'hc3', targetHandle: 'in' },
      { id: 'e2', source: 't2', sourceHandle: 'out', target: 'hc3', targetHandle: 'in' },
    ];

    const { clusterNode, updatedNodes, updatedEdges } = buildClusterNode(taps, edges, 'tap');
    const allNodes = [clusterNode, ...updatedNodes];

    // Expand
    const expanded = expandClusterNode(clusterNode, allNodes, updatedEdges);
    const expandedCluster = expanded.nodes.find(n => n.id === clusterNode.id);
    expect(expandedCluster?.data?.isCollapsed).toBe(false);
    expect(expanded.nodes.filter(n => n.id !== clusterNode.id).every(n => !n.hidden)).toBe(true);
    expect(expanded.edges.find(e => e.id === 'e1')?.source).toBe('t1');
    expect(expanded.edges.find(e => e.id === 'e2')?.source).toBe('t2');

    // Collapse again
    const collapsed = collapseClusterNode(expandedCluster!, expanded.nodes, expanded.edges);
    const collapsedCluster = collapsed.nodes.find(n => n.id === clusterNode.id);
    expect(collapsedCluster?.data?.isCollapsed).toBe(true);
    expect(collapsed.nodes.filter(n => n.id !== clusterNode.id).every(n => n.hidden)).toBe(true);
    expect(collapsed.edges.every(e => e.source === clusterNode.id)).toBe(true);
  });

  it('dissolves the cluster and restores original member nodes', () => {
    const taps = [
      createMockTap('t1', 'TAP-M251T', 'TAP-M251T', 6),
      createMockTap('t2', 'TAP-M251T', 'TAP-M251T', 6),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 't1', sourceHandle: 'out', target: 'hc3', targetHandle: 'in' },
      { id: 'e2', source: 't2', sourceHandle: 'out', target: 'hc3', targetHandle: 'in' },
    ];

    const { clusterNode, updatedNodes, updatedEdges } = buildClusterNode(taps, edges, 'tap');
    const allNodes = [clusterNode, ...updatedNodes];

    const dissolved = dissolveClusterNode(clusterNode.id, allNodes, updatedEdges);
    expect(dissolved.nodes.find(n => n.id === clusterNode.id)).toBeUndefined();
    expect(dissolved.nodes).toHaveLength(2);
    expect(dissolved.nodes.every(n => !n.hidden)).toBe(true);
    expect(dissolved.edges.find(e => e.id === 'e1')?.source).toBe('t1');
    expect(dissolved.edges.find(e => e.id === 'e2')?.source).toBe('t2');
  });

  it('handles Tool clusters (e.g. 10 Ericsson Probes) with ingest capacities', () => {
    const tools = Array.from({ length: 10 }, (_, i) =>
      createMockTool(`probe-${i}`, 'Ericsson Probe', 10000),
    );
    const summary = buildClusterSummary(tools, 'tool');

    expect(summary.count).toBe(10);
    expect(summary.totalIngestLimitMbps).toBe(100000);
    expect(summary.isMixed).toBe(false);
    expect(summary.breakdown[0].toolName).toBe('Ericsson Probe');
    expect(summary.breakdown[0].count).toBe(10);
    expect(summary.breakdown[0].ingestLimitMbps).toBe(10000);
  });

  it('preserves all member nodes in the Bill of Materials when clustered', () => {
    const taps = Array.from({ length: 8 }, (_, i) =>
      createMockTap(`t-${i}`, 'TAP-M251T', 'TAP-M251T', 6),
    );
    const { clusterNode, updatedNodes, updatedEdges } = buildClusterNode(taps, [], 'tap');
    const allNodes = [clusterNode, ...updatedNodes];

    const bom = generateBom(allNodes, updatedEdges, 'HTL', '12');

    // 8x TAP-M251T should be quoted
    const tapRow = bom.find(r => r.sku.startsWith('TAP-M251T'));
    expect(tapRow).toBeDefined();
    expect(tapRow?.qty).toBe(8);

    // Trays needed for 8 modules (6 in M200T + 2 in M100T)
    const m200Row = bom.find(r => r.sku === 'TAP-M200T');
    const m100Row = bom.find(r => r.sku === 'TAP-M100T');
    expect(m200Row?.qty).toBe(1);
    expect(m100Row?.qty).toBe(1);
  });

  it('reliably preserves incoming links across repeated expand/collapse cycles for Tool clusters', () => {
    const probes = Array.from({ length: 10 }, (_, i) =>
      createMockTool(`probe-${i}`, 'Ericsson Probe', 10000),
    );
    const edges: Edge[] = probes.map((p, i) => ({
      id: `e-hc3-probe-${i}`,
      source: 'hc3-node',
      sourceHandle: 'out',
      target: p.id,
      targetHandle: 'in',
    }));

    // 1. Build cluster (starts collapsed)
    const { clusterNode, updatedNodes, updatedEdges } = buildClusterNode(probes, edges, 'tool');
    expect(updatedEdges).toHaveLength(10);
    expect(updatedEdges.every(e => e.target === clusterNode.id)).toBe(true);
    expect(updatedEdges.every(e => e.targetHandle === 'in')).toBe(true);

    let currentNodes = [clusterNode, ...updatedNodes];
    let currentEdges = updatedEdges;

    // 2. Expand cycle 1
    const exp1 = expandClusterNode(currentNodes[0], currentNodes, currentEdges);
    currentNodes = exp1.nodes;
    currentEdges = exp1.edges;
    expect(currentNodes.filter(n => n.id !== clusterNode.id).every(n => !n.hidden)).toBe(true);
    probes.forEach((p, i) => {
      const e = currentEdges.find(edge => edge.id === `e-hc3-probe-${i}`);
      expect(e).toBeDefined();
      expect(e?.target).toBe(p.id);
      expect(e?.targetHandle).toBe('in');
      expect(e?.sourceHandle).toBe('out');
    });

    // 3. Collapse cycle 1
    const col1 = collapseClusterNode(currentNodes[0], currentNodes, currentEdges);
    currentNodes = col1.nodes;
    currentEdges = col1.edges;
    expect(currentNodes.filter(n => n.id !== clusterNode.id).every(n => n.hidden)).toBe(true);
    expect(currentEdges.every(e => e.target === clusterNode.id)).toBe(true);
    expect(currentEdges.every(e => e.targetHandle === 'in')).toBe(true);

    // 4. Expand cycle 2
    const exp2 = expandClusterNode(currentNodes[0], currentNodes, currentEdges);
    currentNodes = exp2.nodes;
    currentEdges = exp2.edges;
    expect(currentNodes.filter(n => n.id !== clusterNode.id).every(n => !n.hidden)).toBe(true);
    probes.forEach((p, i) => {
      const e = currentEdges.find(edge => edge.id === `e-hc3-probe-${i}`);
      expect(e).toBeDefined();
      expect(e?.target).toBe(p.id);
      expect(e?.targetHandle).toBe('in');
    });

    // 5. Dissolve
    const dissolved = dissolveClusterNode(clusterNode.id, currentNodes, currentEdges);
    expect(dissolved.nodes).toHaveLength(10);
    expect(dissolved.edges).toHaveLength(10);
    probes.forEach((p, i) => {
      const e = dissolved.edges.find(edge => edge.id === `e-hc3-probe-${i}`);
      expect(e).toBeDefined();
      expect(e?.target).toBe(p.id);
      expect(e?.targetHandle).toBe('in');
    });
  });
});
