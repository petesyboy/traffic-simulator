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
  formatEdgeLinkPrefix,
  getEdgeTapLinksCount,
} from './clusterUtils';
import { generateBom } from './bom/bomGenerator';
import { calculateSimulationStep } from './simulation';

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

  it('preserves multi-destination links from 8 TAPs targeting 2 distinct TA25E chassis through expand, collapse, and dissolve', () => {
    const taps = Array.from({ length: 8 }, (_, i) =>
      createMockTap(`tap-${i + 1}`, 'TAP-M273T', 'TAP-M273T', 6),
    );
    // TAPs 1-4 connect to TA25E #1, TAPs 5-8 connect to TA25E #2
    const edges: Edge[] = taps.map((tap, i) => ({
      id: `e-tap-${i + 1}-ta`,
      source: tap.id,
      sourceHandle: 'out',
      target: i < 4 ? 'ta-site-a-1' : 'ta-site-a-2',
      targetHandle: 'in',
    }));

    // 1. Build cluster
    const { clusterNode, updatedNodes, updatedEdges } = buildClusterNode(taps, edges, 'tap');
    expect(updatedEdges).toHaveLength(8);
    // 4 edges to ta1, 4 edges to ta2
    expect(updatedEdges.filter(e => e.target === 'ta-site-a-1')).toHaveLength(4);
    expect(updatedEdges.filter(e => e.target === 'ta-site-a-2')).toHaveLength(4);

    let currentNodes = [clusterNode, ...updatedNodes];
    let currentEdges = updatedEdges;

    // 2. Expand
    const exp = expandClusterNode(currentNodes[0], currentNodes, currentEdges);
    currentNodes = exp.nodes;
    currentEdges = exp.edges;
    expect(currentEdges).toHaveLength(8);
    for (let i = 0; i < 4; i++) {
      const e = currentEdges.find(edge => edge.id === `e-tap-${i + 1}-ta`);
      expect(e?.source).toBe(`tap-${i + 1}`);
      expect(e?.target).toBe('ta-site-a-1');
    }
    for (let i = 4; i < 8; i++) {
      const e = currentEdges.find(edge => edge.id === `e-tap-${i + 1}-ta`);
      expect(e?.source).toBe(`tap-${i + 1}`);
      expect(e?.target).toBe('ta-site-a-2');
    }

    // 3. Collapse
    const col = collapseClusterNode(currentNodes[0], currentNodes, currentEdges);
    currentNodes = col.nodes;
    currentEdges = col.edges;
    expect(currentEdges).toHaveLength(8);
    expect(currentEdges.every(e => e.source === clusterNode.id)).toBe(true);

    // 4. Dissolve
    const dissolved = dissolveClusterNode(clusterNode.id, currentNodes, currentEdges);
    expect(dissolved.nodes).toHaveLength(8);
    expect(dissolved.edges).toHaveLength(8);
    for (let i = 0; i < 4; i++) {
      const e = dissolved.edges.find(edge => edge.id === `e-tap-${i + 1}-ta`);
      expect(e?.source).toBe(`tap-${i + 1}`);
      expect(e?.target).toBe('ta-site-a-1');
    }
    for (let i = 4; i < 8; i++) {
      const e = dissolved.edges.find(edge => edge.id === `e-tap-${i + 1}-ta`);
      expect(e?.source).toBe(`tap-${i + 1}`);
      expect(e?.target).toBe('ta-site-a-2');
    }
  });

  describe('formatEdgeLinkPrefix', () => {
    it('formats sequential link ranges (e.g. Links 1 to 6, Links 7 to 12) for a multi-TAP cluster stack', () => {
      const tapMembers: CustomNode[] = Array.from({ length: 4 }, (_, i) => ({
        id: `tap-${i + 1}`,
        type: 'hardwareNode',
        position: { x: 0, y: i * 100 },
        data: {
          label: `TAP ${i + 1}`,
          model: 'TAP-M273T',
          sku: 'TAP-M273T',
          tappedLinksCount: 6,
        },
      } as unknown as CustomNode));

      const clusterNode: CustomNode = {
        id: 'cluster-tap-1',
        type: 'clusterNode',
        position: { x: 0, y: 0 },
        data: {
          label: '4x TAP Cluster',
          clusterType: 'tap',
          memberNodeIds: tapMembers.map((t) => t.id),
        },
      } as unknown as CustomNode;

      const ta25Node: CustomNode = {
        id: 'ta25-1',
        type: 'hardwareNode',
        position: { x: 400, y: 0 },
        data: { label: 'TA25E', model: 'GigaVUE-TA25E' },
      } as unknown as CustomNode;

      const allNodes = [...tapMembers, clusterNode, ta25Node];

      const parallelEdges: Edge[] = tapMembers.map((t, idx) => ({
        id: `e-tap-${idx + 1}`,
        source: 'cluster-tap-1',
        target: 'ta25-1',
        sourceHandle: 'out',
        data: { originalSource: t.id },
      }));

      expect(getEdgeTapLinksCount(parallelEdges[0], clusterNode, allNodes)).toBe(6);
      expect(formatEdgeLinkPrefix(parallelEdges[0], parallelEdges, allNodes)).toBe('Links 1 to 6');
      expect(formatEdgeLinkPrefix(parallelEdges[1], parallelEdges, allNodes)).toBe('Links 7 to 12');
      expect(formatEdgeLinkPrefix(parallelEdges[2], parallelEdges, allNodes)).toBe('Links 13 to 18');
      expect(formatEdgeLinkPrefix(parallelEdges[3], parallelEdges, allNodes)).toBe('Links 19 to 24');
    });

    it('formats multi-link range (Links 1 to 6) for a standalone single TAP module', () => {
      const tapNode: CustomNode = {
        id: 'tap-standalone',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: { label: 'TAP-M251T', model: 'TAP-M251T', tappedLinksCount: 6 },
      } as unknown as CustomNode;
      const taNode: CustomNode = { id: 'ta-1', type: 'hardwareNode', position: { x: 200, y: 0 }, data: { label: 'TA25' } } as unknown as CustomNode;

      const edge: Edge = { id: 'e-standalone', source: 'tap-standalone', target: 'ta-1' };

      expect(formatEdgeLinkPrefix(edge, [edge], [tapNode, taNode])).toBe('Links 1 to 6');
    });

    it('formats standard Link 1/3, Link 2/3 for non-TAP parallel links', () => {
      const taNode: CustomNode = { id: 'ta-1', type: 'hardwareNode', position: { x: 0, y: 0 }, data: { label: 'TA25' } } as unknown as CustomNode;
      const hcNode: CustomNode = { id: 'hc-1', type: 'hardwareNode', position: { x: 400, y: 0 }, data: { label: 'HC3' } } as unknown as CustomNode;

      const edges: Edge[] = [
        { id: 'e1', source: 'ta-1', target: 'hc-1', sourceHandle: 'out' },
        { id: 'e2', source: 'ta-1', target: 'hc-1', sourceHandle: 'out' },
        { id: 'e3', source: 'ta-1', target: 'hc-1', sourceHandle: 'out' },
      ];

      expect(formatEdgeLinkPrefix(edges[0], edges, [taNode, hcNode])).toBe('Link 1/3');
      expect(formatEdgeLinkPrefix(edges[1], edges, [taNode, hcNode])).toBe('Link 2/3');
      expect(formatEdgeLinkPrefix(edges[2], edges, [taNode, hcNode])).toBe('Link 3/3');
    });
  });

  describe('Simulation through collapsed clusters', () => {
    it('continues routing traffic to downstream chassis when TAP cluster is collapsed', () => {
      // Create 4 TAP nodes (6 links each = 24 links)
      const taps = Array.from({ length: 4 }, (_, i) =>
        createMockTap(`tap-${i + 1}`, 'TAP-M273T', 'TAP-M273T', 6)
      );

      const taNode: CustomNode = {
        id: 'ta25-1',
        type: 'hardwareNode',
        position: { x: 500, y: 100 },
        data: {
          label: 'GigaVUE-TA25E',
          model: 'GigaVUE-TA25E',
          sku: 'GVS-TAX21E-HW',
          configType: 'Hardware',
        },
      } as unknown as CustomNode;

      // Create edges from each TAP to TA25E
      const initialEdges: Edge[] = taps.map((tap, idx) => ({
        id: `e-tap-${idx + 1}`,
        source: tap.id,
        target: taNode.id,
        sourceHandle: 'out',
        targetHandle: 'in',
      }));

      // Collapse the TAPs into a cluster
      const { clusterNode, updatedNodes, updatedEdges } = buildClusterNode(taps, initialEdges, 'tap');
      const allNodes = [clusterNode, taNode, ...updatedNodes];

      // Create traffic streams originating from the member TAP nodes
      const streams = taps.map((tap, idx) => ({
        id: `stream-${idx + 1}`,
        name: `TAP Stream ${idx + 1}`,
        sourceNodeId: tap.id,
        active: true,
        bandwidth: 5000, // 5 Gbps each = 20 Gbps total
        protocol: 'tcp' as const,
        vlan: '100',
        ipSrc: '192.168.1.1',
        ipDst: '10.0.0.1',
        portSrc: '50000',
        portDst: '443',
      }));

      // Run simulation step with collapsed cluster
      const result = calculateSimulationStep(allNodes, updatedEdges, streams);

      // Verify member TAP nodes recorded Tx metrics
      expect(result.metrics['tap-1'].txMbps).toBe(5000);

      // Verify the collapsed cluster node recorded aggregate Tx metrics
      expect(result.metrics[clusterNode.id].txMbps).toBe(20000);

      // Verify downstream TA25E chassis received all 20 Gbps of traffic!
      expect(result.metrics['ta25-1'].rxMbps).toBe(20000);

      // Verify all edges connecting cluster to TA25E are active
      expect(result.activeEdges.length).toBeGreaterThan(0);
    });
  });
});

