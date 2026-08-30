import { describe, it, expect } from 'vitest';
import {
  generateStreamsForTopology,
  getTopologyIngressSummary,
  getMonitoredLinksForNode,
} from './trafficStreamUtils';
import type { CustomNode, HardwareNodeData, InputNodeData } from '../store/types';

describe('trafficStreamUtils', () => {
  const createMockTapNode = (id: string, model: string, sku: string, linkCount = 6): CustomNode => ({
    id,
    type: 'hardwareNode',
    position: { x: 0, y: 0 },
    data: {
      label: `TAP ${id.toUpperCase()}`,
      model,
      sku,
      tappedLinksCount: linkCount,
      tappedLinkAllocations: [
        { qty: linkCount, optic: 'SFP-532', toolOptic: 'SFP-532' },
      ],
    } as HardwareNodeData,
  });

  const createMockInputNode = (id: string, portSpeed = '10G', linkCount = 1): CustomNode => ({
    id,
    type: 'inputNode',
    position: { x: 0, y: 0 },
    data: {
      label: `Input Port ${id}`,
      configType: 'SPAN Port',
      portSpeed,
      linkSpeed: 10000,
      tappedLinksCount: linkCount,
    } as InputNodeData,
  });

  it('discovers all monitored links for a TAP node with allocations', () => {
    const node = createMockTapNode('tap-1', 'TAP-M253', 'TAP-M253', 6);
    const links = getMonitoredLinksForNode(node);
    expect(links).toHaveLength(6);
    expect(links[0].speedMbps).toBe(10000);
    expect(links[5].linkIndex).toBe(6);
  });

  it('generates 48 traffic streams for 8 TAP modules (6 links each)', () => {
    const tapNodes: CustomNode[] = [];
    for (let i = 1; i <= 8; i++) {
      tapNodes.push(createMockTapNode(`tap-${i}`, 'TAP-M253', 'TAP-M253', 6));
    }

    const summary = getTopologyIngressSummary(tapNodes);
    expect(summary.ingressNodeCount).toBe(8);
    expect(summary.totalMonitoredLinks).toBe(48);
    expect(summary.totalPotentialBandwidthMbps).toBe(480000); // 48 * 10G = 480 Gbps

    const streams = generateStreamsForTopology(tapNodes, {
      profileBias: 'mixed',
      utilizationMin: 0.45,
      utilizationMax: 0.55,
    });

    expect(streams).toHaveLength(48);

    // Verify all streams have ~50% link utilisation (~4.5 Gbps to 5.5 Gbps for 10G links)
    streams.forEach((stream) => {
      expect(stream.bandwidth).toBeGreaterThanOrEqual(4500);
      expect(stream.bandwidth).toBeLessThanOrEqual(5500);
      expect(stream.active).toBe(true);
      expect(stream.drift).toBe(1.0);
      expect(stream.sourceNodeId).toMatch(/^tap-[1-8]$/);
      expect(stream.vlan).toBeDefined();
      expect(stream.ipSrc).toBeDefined();
      expect(stream.ipDst).toBeDefined();
    });
  });

  it('generates Telco & Mobile Core biased traffic profiles (GTP, 5G SBI, SIP, RTP, FlowVUE)', () => {
    const tapNode = createMockTapNode('tap-mobile', 'TAP-M253', 'TAP-M253', 10);
    const streams = generateStreamsForTopology([tapNode], {
      profileBias: 'telco',
    });

    expect(streams).toHaveLength(10);

    const destinationPorts = streams.map((s) => s.portDst);
    // Telco profile should contain GTP-U (2152), GTP-C (2123), 5G SBI (8080), VoLTE SIP (5060), RTP (5004), Diameter (3868), FlowVUE (2055)
    expect(destinationPorts).toContain('2152'); // GTP-U
    expect(destinationPorts).toContain('2123'); // GTP-C
    expect(destinationPorts).toContain('5060'); // SIP
    expect(destinationPorts).toContain('3868'); // Diameter
    expect(destinationPorts).toContain('2055'); // FlowVUE
  });

  it('generates Enterprise biased traffic profiles (HTTPS, DB, DNS, SSH, Kafka)', () => {
    const tapNode = createMockTapNode('tap-corp', 'TAP-M253', 'TAP-M253', 10);
    const streams = generateStreamsForTopology([tapNode], {
      profileBias: 'enterprise',
    });

    expect(streams).toHaveLength(10);

    const destinationPorts = streams.map((s) => s.portDst);
    expect(destinationPorts).toContain('443');  // HTTPS
    expect(destinationPorts).toContain('5432'); // Postgres
    expect(destinationPorts).toContain('53');   // DNS
    expect(destinationPorts).toContain('9092'); // Kafka
    expect(destinationPorts).toContain('22');   // SSH
  });

  it('correctly handles 40G / 100G BiDi TAP modules (TAP-M506T)', () => {
    const m506Node: CustomNode = {
      id: 'tap-m506',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'M506T 40G/100G TAP',
        model: 'TAP-M506T',
        sku: 'TAP-M506T',
        tappedLinksCount: 4,
      } as HardwareNodeData,
    };

    const links = getMonitoredLinksForNode(m506Node);
    expect(links).toHaveLength(4);
    expect(links[0].speedMbps).toBe(40000);

    const streams = generateStreamsForTopology([m506Node], {
      utilizationMin: 0.48,
      utilizationMax: 0.52,
    });

    expect(streams).toHaveLength(4);
    // 50% of 40G = ~20,000 Mbps
    expect(streams[0].bandwidth).toBeGreaterThanOrEqual(19000);
    expect(streams[0].bandwidth).toBeLessThanOrEqual(21000);
  });

  it('handles canvas Input Nodes with varying port speeds', () => {
    const input1G = createMockInputNode('span-1g', '1G', 1);
    const input100G = createMockInputNode('span-100g', '100G', 1);

    const streams = generateStreamsForTopology([input1G, input100G], {
      utilizationMin: 0.50,
      utilizationMax: 0.50,
    });

    expect(streams).toHaveLength(2);
    // 50% of 1G (1000 Mbps) is 500 Mbps
    expect(streams[0].bandwidth).toBe(500);
    // 50% of 100G (100000 Mbps) is 50000 Mbps
    expect(streams[1].bandwidth).toBe(50000);
  });

  it('filters out auto-tray chassis containers (TAP-M100T/TAP-M200T)', () => {
    const trayNode: CustomNode = {
      id: 'tray-1',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Tray Container',
        model: 'TAP-M200T',
        sku: 'TAP-M200T',
      } as HardwareNodeData,
    };

    const links = getMonitoredLinksForNode(trayNode);
    expect(links).toHaveLength(0);
  });
});
