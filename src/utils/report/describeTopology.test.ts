import { describe, it, expect } from 'vitest';
import {
  buildTopologyStats,
  describeMapConditions,
  describeFilterNode,
  describeGigaSmartAction,
  describeInputNode,
  describeGigaStreamNode,
  describeToolNode,
  describeInputNodeDetail,
  describeProcessingNodeDetail,
  describeToolNodeDetail,
  summarizeMapInclusionExclusion,
} from './describeTopology';
import { NODE_TYPES, ACTION_TYPES, CONFIG_TYPES } from '../../constants/nodeTypes';
import type {
  CustomNode,
  TrafficStream,
  MapCondition,
  FilterNodeData,
  GigaSmartNodeData,
  InputNodeData,
  GigaStreamNodeData,
  ToolNodeData,
  NodeMetrics,
} from '../../store/types';
import type { Edge } from '@xyflow/react';

const node = (id: string, type: string, data: Record<string, unknown>): CustomNode =>
  ({
    id,
    type,
    position: { x: 0, y: 0 },
    data,
  }) as CustomNode;

const stream = (overrides: Partial<TrafficStream>): TrafficStream => ({
  id: overrides.id || 'ts1',
  name: overrides.name || 'Stream',
  sourceNodeId: overrides.sourceNodeId || 'n1',
  vlan: overrides.vlan || '',
  ipSrc: overrides.ipSrc || '',
  ipDst: overrides.ipDst || '',
  portSrc: overrides.portSrc || '',
  portDst: overrides.portDst || '',
  protocol: overrides.protocol || 'TCP',
  bandwidth: overrides.bandwidth ?? 0,
  active: overrides.active ?? true,
});

describe('buildTopologyStats', () => {
  it('counts TAP and SPAN inputs via the .startsWith(CONFIG_TYPES.X) convention, not exact match', () => {
    const nodes: CustomNode[] = [
      node('i1', NODE_TYPES.INPUT, { label: 'Tap 1', configType: CONFIG_TYPES.TAP }),
      node('i2', NODE_TYPES.INPUT, { label: 'Tap 2 secondary', configType: `${CONFIG_TYPES.TAP} - Secondary` }),
      node('i3', NODE_TYPES.INPUT, { label: 'Span 1', configType: CONFIG_TYPES.SPAN }),
      node('i4', NODE_TYPES.INPUT, { label: 'Erspan 1', configType: CONFIG_TYPES.ERSPAN }),
    ];
    const stats = buildTopologyStats(nodes, [], []);
    expect(stats.inputCounts.tap).toBe(2);
    expect(stats.inputCounts.span).toBe(1);
    expect(stats.inputCounts.erspan).toBe(1);
    expect(stats.inputCounts.total).toBe(4);
  });

  it('also counts a TAP modelled as its own hardwareNode wired to a chassis, but not a tap tray', () => {
    const nodes: CustomNode[] = [
      node('h1', NODE_TYPES.HARDWARE, { label: 'TAP Unit', model: 'TAP-M251T' }),
      node('h2', NODE_TYPES.HARDWARE, { label: 'Tap Tray', model: 'TAP-M100T' }),
      node('h3', NODE_TYPES.HARDWARE, { label: 'Chassis', model: 'GigaVUE-HC1' }),
    ];
    const stats = buildTopologyStats(nodes, [], []);
    expect(stats.inputCounts.tap).toBe(1);
    expect(stats.inputCounts.total).toBe(1);
  });

  it('counts GigaSMART actions across standalone gigaSmartNode and embedded gigaSmartApps on hardware/tool nodes', () => {
    const nodes: CustomNode[] = [
      node('g1', NODE_TYPES.GIGASMART, { label: 'Dedup', actionType: ACTION_TYPES.DEDUPLICATION }),
      node('h1', NODE_TYPES.HARDWARE, {
        label: 'HC1',
        model: 'GigaVUE-HC1',
        gigaSmartApps: [{ label: 'app', actionType: ACTION_TYPES.SSL_DECRYPT }],
      }),
      node('t1', NODE_TYPES.TOOL, {
        label: 'GSA',
        toolName: 'GSA',
        gigaSmartApps: [{ label: 'app2', actionType: ACTION_TYPES.SSL_DECRYPT }],
      }),
    ];
    const stats = buildTopologyStats(nodes, [], []);
    expect(stats.gigaSmartActionCounts[ACTION_TYPES.DEDUPLICATION]).toBe(1);
    expect(stats.gigaSmartActionCounts[ACTION_TYPES.SSL_DECRYPT]).toBe(2);
  });

  it('counts chassis by model, tool/map/filter counts, and aggregates traffic stream bandwidth', () => {
    const nodes: CustomNode[] = [
      node('h1', NODE_TYPES.HARDWARE, { label: 'HC1 a', model: 'GigaVUE-HC1' }),
      node('h2', NODE_TYPES.HARDWARE, { label: 'HC1 b', model: 'GigaVUE-HC1' }),
      node('h3', NODE_TYPES.HARDWARE, { label: 'TA25', model: 'GigaVUE-TA25E' }),
      node('m1', NODE_TYPES.MAP, { label: 'Map 1', conditions: [] }),
      node('f1', NODE_TYPES.FILTER, { label: 'Filter 1', configType: CONFIG_TYPES.VLAN_FILTER }),
      node('t1', NODE_TYPES.TOOL, { label: 'Splunk', toolName: 'Splunk' }),
    ];
    const streams = [stream({ id: 's1', bandwidth: 500 }), stream({ id: 's2', bandwidth: 1500 })];
    const stats = buildTopologyStats(nodes, [], streams);
    expect(stats.chassisCounts['GigaVUE-HC1']).toBe(2);
    expect(stats.chassisCounts['GigaVUE-TA25E']).toBe(1);
    expect(stats.mapNodeCount).toBe(1);
    expect(stats.filterNodeCount).toBe(1);
    expect(stats.toolCount).toBe(1);
    expect(stats.trafficStreamCount).toBe(2);
    expect(stats.totalBandwidthMbps).toBe(2000);
    expect(stats.totalBandwidthLabel).toBe('2.00 Gbps');
  });
});

describe('describeMapConditions', () => {
  it('returns the pass-all sentence when there are no conditions', () => {
    expect(describeMapConditions([])).toBe('Traffic Map: Pass All (No filters)');
  });

  it('describes a single condition', () => {
    const conditions: MapCondition[] = [{ field: 'vlan', value: '100', action: 'pass' }];
    expect(describeMapConditions(conditions)).toBe('Traffic Map (Filtering Rules):\n• VLAN = 100 -> PASS');
  });

  it('describes multiple conditions with AND/OR prefixes and PASS/DROP actions', () => {
    const conditions: MapCondition[] = [
      { field: 'vlan', value: '100', action: 'pass' },
      { field: 'portdst', value: '443', action: 'drop', logic: 'AND' },
      { field: 'ipsrc', value: '10.0.0.0/8', action: 'pass', logic: 'OR' },
    ];
    expect(describeMapConditions(conditions)).toBe(
      'Traffic Map (Filtering Rules):\n' +
        '• VLAN = 100 -> PASS\n' +
        '• AND DST PORT = 443 -> DROP\n' +
        '• OR SRC IP = 10.0.0.0/8 -> PASS',
    );
  });
});

describe('describeFilterNode', () => {
  it('describes a VLAN filter', () => {
    const data = { configType: CONFIG_TYPES.VLAN_FILTER, vlanIds: '100,200' } as FilterNodeData;
    expect(describeFilterNode(data)).toBe('VLAN Filter:\n• VLAN IDs: 100,200\n• Action: PASS matching / DROP others');
  });

  it('describes an IP subnet filter', () => {
    const data = { configType: CONFIG_TYPES.IP_FILTER, ipSubnet: '10.0.0.0/8' } as FilterNodeData;
    expect(describeFilterNode(data)).toBe('IP Filter:\n• Subnet: 10.0.0.0/8\n• Action: PASS matching / DROP others');
  });

  it('describes a port filter', () => {
    const data = { configType: CONFIG_TYPES.PORT_FILTER, ports: '80,443' } as FilterNodeData;
    expect(describeFilterNode(data)).toBe(
      'Port Filter:\n• Port numbers: 80,443\n• Action: PASS matching / DROP others',
    );
  });

  it('falls back to a generic message when no criteria are set', () => {
    const data = { configType: 'Traffic Map' } as unknown as FilterNodeData;
    expect(describeFilterNode(data)).toBe('Filter: No criteria set');
  });
});

describe('describeGigaSmartAction', () => {
  it('describes deduplication', () => {
    expect(describeGigaSmartAction({ actionType: ACTION_TYPES.DEDUPLICATION } as GigaSmartNodeData)).toBe(
      'Action: Drop',
    );
  });

  it('describes packet slicing with the configured slice size', () => {
    expect(
      describeGigaSmartAction({ actionType: ACTION_TYPES.PACKET_SLICING, sliceSize: 64 } as GigaSmartNodeData),
    ).toBe('Action: Slice (64B)');
  });

  it('describes header stripping', () => {
    expect(describeGigaSmartAction({ actionType: ACTION_TYPES.HEADER_STRIP } as GigaSmartNodeData)).toBe(
      'Action: Strip',
    );
  });

  it('describes a metadata action by its output format', () => {
    expect(
      describeGigaSmartAction({
        actionType: ACTION_TYPES.APP_METADATA,
        metadataFormat: 'JSON',
      } as GigaSmartNodeData),
    ).toBe('Format: JSON');
  });

  it('falls back to a generic action label for anything else', () => {
    expect(describeGigaSmartAction({ actionType: ACTION_TYPES.SSL_DECRYPT } as GigaSmartNodeData)).toBe(
      'Action: SSL Decrypt',
    );
  });
});

describe('describeInputNode', () => {
  it.each([
    [CONFIG_TYPES.SPAN, 'SPAN Input Port'],
    [CONFIG_TYPES.TAP, 'TAP Hardware Device'],
    [CONFIG_TYPES.ERSPAN, 'ERSPAN Tunnel Input'],
    [CONFIG_TYPES.EAST_WEST, 'East/West Traffic Source'],
    [CONFIG_TYPES.VMWARE, 'VMWare Virtual Estate'],
    ['Unknown', 'Network Input'],
  ])('labels configType %s as %s', (configType, expected) => {
    expect(describeInputNode({ configType } as InputNodeData)).toBe(expected);
  });
});

describe('describeGigaStreamNode', () => {
  it('describes the load-balancing configuration', () => {
    const data = { algorithm: 'Hash-Based', linkCount: 4 } as GigaStreamNodeData;
    expect(describeGigaStreamNode(data)).toBe(
      'GigaStream Load Balancer: distributes traffic across 4 links using Hash-Based.',
    );
  });

  it('falls back to sensible defaults when unset', () => {
    const data = {} as GigaStreamNodeData;
    expect(describeGigaStreamNode(data)).toBe(
      'GigaStream Load Balancer: distributes traffic across 2 links using Round Robin.',
    );
  });
});

describe('describeToolNode', () => {
  it('describes a tool with an ingest limit', () => {
    const data = { toolName: 'Splunk', expectedFormat: 'packets', ingestLimitMbps: 1000 } as ToolNodeData;
    expect(describeToolNode(data)).toBe('Splunk: receives packets traffic (ingest limit 1.00 Gbps).');
  });

  it('describes a tool with no ingest limit set', () => {
    const data = { toolName: 'Vectra', expectedType: 'metadata' } as ToolNodeData;
    expect(describeToolNode(data)).toBe('Vectra: receives metadata traffic.');
  });
});

// ─── Detail builders ──────────────────────────────────────────────────────────

const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

describe('describeInputNodeDetail', () => {
  const nodes: CustomNode[] = [
    node('in1', NODE_TYPES.INPUT, { label: 'Core Tap 1', configType: CONFIG_TYPES.TAP, linkSpeed: 10000 }),
    node('map1', NODE_TYPES.MAP, { label: 'Core Map', conditions: [] }),
    node('tool1', NODE_TYPES.TOOL, { label: 'Vectra', toolName: 'Vectra' }),
  ];
  const edges = [edge('e1', 'in1', 'map1'), edge('e2', 'map1', 'tool1')];
  const streams = [
    stream({ sourceNodeId: 'in1', name: 'Stream A', vlan: '100', protocol: 'TCP', portDst: '443', bandwidth: 500 }),
  ];

  it('lists link speed, matched traffic streams, downstream feed, and terminal destinations', () => {
    const detail = describeInputNodeDetail(nodes[0], nodes, edges, streams);
    expect(detail.headline).toBe('Core Tap 1 — TAP Hardware Device');
    expect(detail.bullets).toContain('Link speed: 10.00 Gbps');
    expect(detail.bullets).toContain('Traffic stream "Stream A": VLAN 100, TCP, port 443 at 500.0 Mbps');
    expect(detail.bullets).toContain('Feeds into: Core Map');
    expect(detail.bullets).toContain('Ultimately reaches: Vectra');
  });

  it('omits live-metrics bullets when nodeMetrics is not supplied', () => {
    const detail = describeInputNodeDetail(nodes[0], nodes, edges, streams);
    expect(detail.bullets.some((b) => b.startsWith('Observed:'))).toBe(false);
  });

  it('includes an Observed bullet when nodeMetrics is supplied', () => {
    const nodeMetrics: Record<string, NodeMetrics> = {
      in1: { rxMbps: 500, txMbps: 500, rxPackets: 0, txPackets: 0, droppedPackets: 0 },
    };
    const detail = describeInputNodeDetail(nodes[0], nodes, edges, streams, nodeMetrics);
    expect(detail.bullets).toContain('Observed: 500.0 Mbps in / 500.0 Mbps out');
  });

  it('includes the physical tap-link detail for a TAP input wired to a chassis', () => {
    const tapNodes: CustomNode[] = [
      node('in1', NODE_TYPES.INPUT, {
        label: 'Core Tap 1',
        configType: CONFIG_TYPES.TAP,
        tapFiberMode: 'Singlemode',
        tappedLinkOptic: 'SFP-533',
      }),
      node('hw1', NODE_TYPES.HARDWARE, {
        label: 'HC1 Chassis',
        model: 'GigaVUE-HC1',
        optics: [{ board: 'Base', optic: 'SFP-533', qty: 2 }],
      }),
    ];
    const tapEdges = [edge('e1', 'in1', 'hw1')];
    const detail = describeInputNodeDetail(tapNodes[0], tapNodes, tapEdges, []);
    expect(detail.bullets.some((b) => b.includes('Singlemode'))).toBe(true);
    expect(detail.bullets).toContain('Connects into: HC1 Chassis (GigaVUE-HC1)');
    expect(detail.bullets.some((b) => b.startsWith('Installed optics on HC1 Chassis:'))).toBe(true);
  });
});

describe('describeProcessingNodeDetail', () => {
  const nodes: CustomNode[] = [
    node('in1', NODE_TYPES.INPUT, { label: 'Core Tap 1', configType: CONFIG_TYPES.TAP }),
    node('map1', NODE_TYPES.MAP, {
      label: 'Core Map',
      conditions: [{ field: 'vlan', value: '100', action: 'pass' }],
    }),
    node('tool1', NODE_TYPES.TOOL, { label: 'Vectra', toolName: 'Vectra' }),
  ];
  const edges = [edge('e1', 'in1', 'map1'), edge('e2', 'map1', 'tool1')];

  it('includes rule detail plus upstream/downstream context', () => {
    const detail = describeProcessingNodeDetail(nodes[1], nodes, edges);
    expect(detail.headline).toBe('Core Map');
    expect(detail.bullets).toContain('VLAN = 100 -> PASS');
    expect(detail.bullets).toContain('Receives from: Core Tap 1');
    expect(detail.bullets).toContain('Forwards to: Vectra');
  });

  it('computes a reduction percentage when live rx/tx metrics show a drop', () => {
    const nodeMetrics: Record<string, NodeMetrics> = {
      map1: { rxMbps: 1000, txMbps: 400, rxPackets: 0, txPackets: 0, droppedPackets: 0, filterDroppedMbps: 600 },
    };
    const detail = describeProcessingNodeDetail(nodes[1], nodes, edges, nodeMetrics);
    expect(detail.bullets).toContain('Observed: 1.00 Gbps in, 400.0 Mbps out (60% reduction)');
    expect(detail.bullets).toContain('Filtered out: 600.0 Mbps');
  });

  it('omits the reduction percentage when tx is not less than rx', () => {
    const nodeMetrics: Record<string, NodeMetrics> = {
      map1: { rxMbps: 500, txMbps: 500, rxPackets: 0, txPackets: 0, droppedPackets: 0 },
    };
    const detail = describeProcessingNodeDetail(nodes[1], nodes, edges, nodeMetrics);
    expect(detail.bullets).toContain('Observed: 500.0 Mbps in, 500.0 Mbps out');
  });

  it('includes a plain-English include/exclude summary ahead of the precise map condition bullets', () => {
    const detail = describeProcessingNodeDetail(nodes[1], nodes, edges);
    expect(detail.bullets[0]).toBe('Includes: VLAN 100.');
  });

  it('includes the GigaSMART function glossary sentence for a GigaSMART node', () => {
    const gsNodes: CustomNode[] = [
      node('gsm1', NODE_TYPES.GIGASMART, { label: 'Dedup Engine', actionType: ACTION_TYPES.DEDUPLICATION }),
    ];
    const detail = describeProcessingNodeDetail(gsNodes[0], gsNodes, []);
    expect(detail.bullets).toContain('Action: Drop');
    expect(detail.bullets.some((b) => b.includes('Removes duplicate copies of the same packet'))).toBe(true);
  });
});

describe('summarizeMapInclusionExclusion', () => {
  it('returns the pass-all sentence when there are no conditions', () => {
    expect(summarizeMapInclusionExclusion([])).toBe('Includes: all traffic (no filters configured).');
  });

  it('summarizes a pass-only rule set', () => {
    const conditions: MapCondition[] = [{ field: 'vlan', value: '100', action: 'pass' }];
    expect(summarizeMapInclusionExclusion(conditions)).toBe('Includes: VLAN 100.');
  });

  it('summarizes a drop-only rule set', () => {
    const conditions: MapCondition[] = [{ field: 'portdst', value: '443', action: 'drop' }];
    expect(summarizeMapInclusionExclusion(conditions)).toBe('Excludes: traffic to port 443.');
  });

  it('summarizes a mixed include/exclude rule set', () => {
    const conditions: MapCondition[] = [
      { field: 'vlan', value: '100', action: 'pass' },
      { field: 'protocol', value: 'UDP', action: 'drop' },
    ];
    expect(summarizeMapInclusionExclusion(conditions)).toBe('Includes: VLAN 100. Excludes: UDP protocol traffic.');
  });
});

describe('describeToolNodeDetail', () => {
  it('traces terminal input origins and includes live rx when supplied', () => {
    const nodes: CustomNode[] = [
      node('in1', NODE_TYPES.INPUT, { label: 'Core Tap 1', configType: CONFIG_TYPES.TAP }),
      node('in2', NODE_TYPES.INPUT, { label: 'Switch SPAN 1', configType: CONFIG_TYPES.SPAN }),
      node('map1', NODE_TYPES.MAP, { label: 'Core Map', conditions: [] }),
      node('tool1', NODE_TYPES.TOOL, { label: 'Vectra', toolName: 'Vectra', expectedFormat: 'packets' }),
    ];
    const edges = [edge('e1', 'in1', 'map1'), edge('e2', 'in2', 'map1'), edge('e3', 'map1', 'tool1')];

    const detail = describeToolNodeDetail(nodes[3], nodes, edges);
    expect(detail.headline).toBe('Vectra: receives packets traffic.');
    const originsBullet = detail.bullets.find((b) => b.startsWith('Traffic originates from: '));
    expect(originsBullet).toContain('Core Tap 1');
    expect(originsBullet).toContain('Switch SPAN 1');

    const nodeMetrics: Record<string, NodeMetrics> = {
      tool1: { rxMbps: 250, txMbps: 0, rxPackets: 0, txPackets: 0, droppedPackets: 0 },
    };
    const detailWithMetrics = describeToolNodeDetail(nodes[3], nodes, edges, nodeMetrics);
    expect(detailWithMetrics.bullets).toContain('Currently receiving: 250.0 Mbps');
  });

  it('includes a purpose sentence and an overload-risk sentence for every tool', () => {
    const nodes: CustomNode[] = [node('tool1', NODE_TYPES.TOOL, { label: 'Vectra', toolName: 'Vectra' })];
    const detail = describeToolNodeDetail(nodes[0], nodes, []);
    expect(detail.bullets.some((b) => b.includes('NDR platform'))).toBe(true);
    expect(detail.bullets.some((b) => b.startsWith('Rated for up to'))).toBe(true);
    expect(detail.bullets.some((b) => b.startsWith('Traffic originates from:'))).toBe(false);
  });

  it('falls back to a generic purpose and overload sentence for an unlisted tool', () => {
    const nodes: CustomNode[] = [node('tool1', NODE_TYPES.TOOL, { label: 'Custom Tool', toolName: 'My Custom Tool' })];
    const detail = describeToolNodeDetail(nodes[0], nodes, []);
    expect(detail.bullets).toContain(
      'Monitors and analyses the traffic it receives to detect threats, measure performance, or support investigations.',
    );
    expect(detail.bullets.some((b) => b.includes('falls behind'))).toBe(true);
  });

  it('prefers the node-level ingest limit over the catalogue default when both are set', () => {
    const nodes: CustomNode[] = [
      node('tool1', NODE_TYPES.TOOL, { label: 'Vectra', toolName: 'Vectra', ingestLimitMbps: 2000 }),
    ];
    const detail = describeToolNodeDetail(nodes[0], nodes, []);
    expect(detail.bullets.some((b) => b.startsWith('Rated for up to 2.00 Gbps'))).toBe(true);
  });
});
