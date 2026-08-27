import { describe, it, expect } from 'vitest';
import type { CustomNode, PortLink } from '../store/types';
import type { Edge } from '@xyflow/react';
import {
  deriveChassisRequiredOptics,
  distributeOpticsAcrossBoards,
  reallocateChassisOpticsAndPorts,
  reallocateAllProjectOpticsAndPorts,
} from './opticReallocation';

describe('opticReallocation', () => {
  const createMockTopology = () => {
    const nodes: CustomNode[] = [
      // TAP 1 (Multimode, 6 links = 12 feeds)
      {
        id: 'tap-1',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'G-TAP M Series TAP-M251T #1',
          configType: 'Hardware',
          model: 'G-TAP M Series TAP-M251T',
          sku: 'TAP-M251T',
          tappedLinksCount: 6,
          tappedLinkOptic: 'SFP-532T',
          tapFiberMode: 'Multimode',
          tappedLinkAllocations: [{ qty: 6, optic: 'SFP-532T' }],
        },
      },
      // TAP 2 (Multimode, 6 links = 12 feeds)
      {
        id: 'tap-2',
        type: 'hardwareNode',
        position: { x: 0, y: 100 },
        data: {
          label: 'G-TAP M Series TAP-M251T #2',
          configType: 'Hardware',
          model: 'G-TAP M Series TAP-M251T',
          sku: 'TAP-M251T',
          tappedLinksCount: 6,
          tappedLinkOptic: 'SFP-532T',
          tapFiberMode: 'Multimode',
          tappedLinkAllocations: [{ qty: 6, optic: 'SFP-532T' }],
        },
      },
      // Target HC1-Plus Chassis with 1 Main board + 1 expansion module in Slot 3
      // Currently has messy / surplus deployed optics: 2x QSFP, 24x Base SFP, 8x Slot 3 SFP (34 total)
      {
        id: 'hc1-plus',
        type: 'hardwareNode',
        position: { x: 300, y: 50 },
        data: {
          label: 'GigaVUE HC1 Plus - DC1',
          configType: 'Hardware',
          model: 'GigaVUE-HC1-Plus',
          sku: 'HC1P-BASE',
          installedBoards: {
            '2': 'PRT-HC1-X12',
            '3': 'PRT-HC1-X12',
          },
          optics: [
            { board: 'HC1P-BASE (Main Board)', optic: 'Q28-503T (100G QSFP28 LR4) [SM] (TAA)', qty: 2 },
            { board: 'HC1P-BASE (Main Board)', optic: 'SFP-532T (10G SFP+ SR) [MM] (TAA)', qty: 8 },
            { board: 'PRT-HC1-X12 (Slot 2)', optic: 'SFP-532T (10G SFP+ SR) [MM] (TAA)', qty: 12 },
            { board: 'PRT-HC1-X12 (Slot 3)', optic: 'SFP-532T (10G SFP+ SR) [MM] (TAA)', qty: 12 },
          ],
        },
      },
      // Peer TA25E Chassis for 2x 100G uplinks
      {
        id: 'ta25e',
        type: 'hardwareNode',
        position: { x: 600, y: 0 },
        data: {
          label: 'GigaVUE-TA25E - DC2',
          configType: 'Hardware',
          model: 'GigaVUE-TA25E',
          sku: 'TA25E-BASE',
          optics: [
            { board: 'Base Ports', optic: 'Q28-503T (100G QSFP28 LR4)', qty: 2 },
          ],
        },
      },
      // Outgoing Vectra Tool Node
      {
        id: 'tool-vectra',
        type: 'toolNode',
        position: { x: 600, y: 150 },
        data: {
          label: 'Vectra Tool',
          configType: 'Tool',
        },
      },
    ];

    const edges: Edge[] = [
      { id: 'e-tap1-hc1', source: 'tap-1', target: 'hc1-plus' },
      { id: 'e-tap2-hc1', source: 'tap-2', target: 'hc1-plus' },
      {
        id: 'e-hc1-ta25e',
        source: 'hc1-plus',
        target: 'ta25e',
        data: {
          portLinks: [
            { sourcePortId: '1/1/c1', targetPortId: '1/1/x15', opticSku: 'Q28-503T', pinned: true },
            { sourcePortId: '1/1/c2', targetPortId: '1/1/x25', opticSku: 'Q28-503T', pinned: true },
          ],
        },
      },
      { id: 'e-hc1-tool', source: 'hc1-plus', target: 'tool-vectra' },
    ];

    return { nodes, edges };
  };

  it('derives exact required transceivers from connected TAPs, uplinks, and tools', () => {
    const { nodes, edges } = createMockTopology();
    const hc1 = nodes.find((n) => n.id === 'hc1-plus')!;

    const required = deriveChassisRequiredOptics(hc1, nodes, edges);
    // TAP 1: 6 links * 2 = 12x SFP-532T
    // TAP 2: 6 links * 2 = 12x SFP-532T
    // TA25E Uplink: 2x Q28-503T
    // Tool: 1x tool ingest optic
    const totalRequiredCount = required.reduce((sum, r) => sum + r.qty, 0);
    expect(totalRequiredCount).toBe(27); // 24 MM SFP + 2 QSFP + 1 Tool SFP

    const qsfpReq = required.filter((r) => r.cage === 'QSFP');
    expect(qsfpReq.reduce((sum, r) => sum + r.qty, 0)).toBe(2);

    const sfpReq = required.filter((r) => r.cage === 'SFP');
    expect(sfpReq.reduce((sum, r) => sum + r.qty, 0)).toBe(25);
  });

  it('distributes required optics cleanly across Main Board first then expansion slots without surplus', () => {
    const { nodes, edges } = createMockTopology();
    const hc1 = nodes.find((n) => n.id === 'hc1-plus')!;
    const required = deriveChassisRequiredOptics(hc1, nodes, edges);

    const { installedOptics, affectedBoards } = distributeOpticsAcrossBoards(
      'GigaVUE-HC1-Plus',
      hc1.data as any,
      required,
    );

    const totalDeployed = installedOptics.reduce((sum, o) => sum + o.qty, 0);
    expect(totalDeployed).toBe(27); // Exactly 27 deployed, no surplus 34!

    // Main board takes 2x Q28-503T and fills its 8 SFP cages = 10
    const baseOptics = installedOptics.filter((o) => o.board.includes('Main') || o.board.includes('BASE'));
    const slot2Optics = installedOptics.filter((o) => o.board.includes('Slot 2'));
    const slot3Optics = installedOptics.filter((o) => o.board.includes('Slot 3'));

    const baseCount = baseOptics.reduce((sum, o) => sum + o.qty, 0);
    const slot2Count = slot2Optics.reduce((sum, o) => sum + o.qty, 0);
    const slot3Count = slot3Optics.reduce((sum, o) => sum + o.qty, 0);

    expect(baseCount).toBe(10);
    expect(slot2Count).toBe(12);
    expect(slot3Count).toBe(5);
    expect(affectedBoards).toContain('HC1P-BASE (Main Board)');
    expect(affectedBoards).toContain('PRT-HC1-X12 (Slot 2)');
    expect(affectedBoards).toContain('PRT-HC1-X12 (Slot 3)');
  });

  it('re-allocates chassis optics and resets edge port links in clean sequential order', () => {
    const { nodes, edges } = createMockTopology();

    const result = reallocateChassisOpticsAndPorts('hc1-plus', nodes, edges);

    expect(result.chassisUpdatedCount).toBe(1);
    expect(result.totalOpticsCount).toBe(27);

    const updatedHc1 = result.updatedNodes.find((n) => n.id === 'hc1-plus');
    const optics = updatedHc1?.data?.optics || [];
    const totalOptics = optics.reduce((sum: number, o: any) => sum + o.qty, 0);
    expect(totalOptics).toBe(27);

    // Verify edges have clean portLinks assigned
    const tap1Edge = result.updatedEdges.find((e) => e.id === 'e-tap1-hc1');
    const tap1Links = (tap1Edge?.data?.portLinks as PortLink[]) || [];
    expect(tap1Links.length).toBe(12);
    // Port assignments should start sequentially on 1/1/x1, 1/1/x2, ...
    expect(tap1Links[0].targetPortId).toBe('1/1/x1');
    expect(tap1Links[1].targetPortId).toBe('1/1/x2');

    const uplinkEdge = result.updatedEdges.find((e) => e.id === 'e-hc1-ta25e');
    const uplinkLinks = (uplinkEdge?.data?.portLinks as PortLink[]) || [];
    expect(uplinkLinks.length).toBe(2);
    expect(uplinkLinks[0].sourcePortId).toBe('1/1/c1');
    expect(uplinkLinks[1].sourcePortId).toBe('1/1/c2');
  });

  it('re-allocates all project chassis optics and ports project-wide', () => {
    const { nodes, edges } = createMockTopology();

    const result = reallocateAllProjectOpticsAndPorts(nodes, edges);

    expect(result.chassisUpdatedCount).toBe(2); // hc1-plus and ta25e
    expect(result.totalOpticsCount).toBeGreaterThan(0);
    expect(result.updatedEdges.length).toBe(edges.length);
  });
});
