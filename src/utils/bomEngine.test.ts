import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import { syncOpticsOnTapConnection, validateConfiguration, setMockSkusMetadata } from './bomEngine';
import { type CustomNode, type InstalledOptic, type PortLink } from '../store/types';
import { syncPortAssignments } from './portSync';

describe('BOM Engine', () => {
  describe('syncOpticsOnTapConnection', () => {
    it('should add auto-added optics when a TAP is connected', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'inputNode',
          position: { x: 0, y: 0 },
          data: { label: 'TAP', configType: 'TAP', tapFiberMode: 'Multimode', tappedLinksCount: 1 }
        },
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: { label: 'HC1', configType: 'HC', model: 'GigaVUE-HC1', optics: [] }
        }
      ];
      const edges = [{ id: 'e1', source: 'tap-1', target: 'hc-1' }];
      
      const syncedNodes = syncOpticsOnTapConnection(nodes, edges);
      const hcNode = syncedNodes.find(n => n.id === 'hc-1');
      
      expect(hcNode?.data.optics).toBeDefined();
      expect(hcNode?.data.optics?.some((o: InstalledOptic) => o.optic.includes('SFP-532') && o.isAutoAdded)).toBe(true);
    });

    it('should auto-add resolved TAA copper optic SFP-501T (1G SFP Copper) when 3 copper links are tapped to TA25E', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'Active Copper TAP',
            configType: 'TAP',
            model: 'TAP-A-TX2',
            sku: 'TAP-A-TX2',
            tappedLinksCount: 3,
            tappedLinkOptic: '1G-SFP-CU',
            tappedLinkAllocations: [{ qty: 3, optic: '1G-SFP-CU' }]
          }
        },
        {
          id: 'ta25e-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: { label: 'TA25E', configType: 'TA', model: 'GigaVUE-TA25E', optics: [] }
        }
      ];
      const edges = [{ id: 'e1', source: 'tap-1', target: 'ta25e-1' }];

      const syncedNodes = syncOpticsOnTapConnection(nodes, edges);
      const taNode = syncedNodes.find(n => n.id === 'ta25e-1');

      expect(taNode?.data.optics).toBeDefined();
      expect(taNode?.data.optics?.length).toBe(1);
      expect(taNode?.data.optics?.[0]).toEqual({
        board: 'Base Ports',
        optic: 'SFP-501T (1G SFP Copper)',
        qty: 6,
        isAutoAdded: true
      });
    });

    it('should resolve a fully descriptive optic string (not a bare SKU) and the correct board name for a GigaVUE-HC1, whose base board is not literally named "Base Ports"', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'M251T Module',
            configType: 'TAP',
            model: 'TAP-M251T',
            sku: 'TAP-M251T',
            tappedLinksCount: 2,
            tappedLinkAllocations: [
              { qty: 2, optic: 'Passive Optical Splitter (Multimode)', toolOptic: '10G-SFP-SR' }
            ]
          }
        },
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: { label: 'HC1', configType: 'HC', model: 'GigaVUE-HC1', optics: [] }
        }
      ];
      const edges = [{ id: 'e1', source: 'tap-1', target: 'hc-1' }];

      const syncedNodes = syncOpticsOnTapConnection(nodes, edges);
      const hcNode = syncedNodes.find(n => n.id === 'hc-1');

      // Bare "SFP-532T" (no parenthetical) fails downstream fiber-type classification
      // (getOpticFiberType), which caused a false "fiber mismatch" warning even though
      // the correct quantity (2 links x 2 = 4) was already being added.
      expect(hcNode?.data.optics?.[0]).toEqual({
        board: 'HC1-X12G4 (Main board)',
        optic: 'SFP-532T (10G SFP+ SR)',
        qty: 4,
        isAutoAdded: true
      });
    });

    it('should merge multiple TAP-M251T modules feeding the same chassis into a single optic line, not split/undercounted lines', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'M251T Module A',
            configType: 'TAP',
            model: 'TAP-M251T',
            sku: 'TAP-M251T',
            tappedLinksCount: 1,
            tappedLinkAllocations: [{ qty: 1, optic: '10G-SFP-SR' }]
          }
        },
        {
          id: 'tap-2',
          type: 'hardwareNode',
          position: { x: 0, y: 100 },
          data: {
            label: 'M251T Module B',
            configType: 'TAP',
            model: 'TAP-M251T',
            sku: 'TAP-M251T',
            tappedLinksCount: 5
            // No tappedLinkAllocations -> exercises the legacy fallback raw-optic string.
          }
        },
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: { label: 'HC1', configType: 'HC', model: 'GigaVUE-HC1', optics: [] }
        }
      ];
      const edges = [
        { id: 'e1', source: 'tap-1', target: 'hc-1' },
        { id: 'e2', source: 'tap-2', target: 'hc-1' }
      ];

      const syncedNodes = syncOpticsOnTapConnection(nodes, edges);
      const hcNode = syncedNodes.find(n => n.id === 'hc-1');
      const sfpLines = hcNode?.data.optics?.filter((o: InstalledOptic) => o.optic.includes('SFP-532')) || [];

      expect(sfpLines.length).toBe(1);
      expect(sfpLines[0].qty).toBe(12);
    });

    it('does not let a manually-added (non-pinned) optic get absorbed into the auto-added pool it happens to share a type with', () => {
      // Regression: a chassis with a TAP feed AND an unrelated link (e.g. a
      // SPAN/VMware input) sharing the same optic type used to let a plain
      // manual "add 1 more" of that type get silently swallowed by the
      // auto-added requirement calculation - the net total never actually
      // grew, so a user trying to fix a "missing transceiver" on the
      // unrelated link's port could never succeed by adding more of the same
      // optic (only a *pinned* add worked, since only pins offset the
      // auto-added quota now).
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'TAP', configType: 'TAP', model: 'TAP-M251T', sku: 'TAP-M251T',
            tappedLinksCount: 1,
            tappedLinkAllocations: [{ qty: 1, optic: 'Passive Optical Splitter (Multimode)', toolOptic: 'SFP-532T' }],
          },
        },
        {
          id: 'ta-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: {
            label: 'TA25E', configType: 'TA', model: 'GigaVUE-TA25E', sku: 'TA25E-BASE',
            // 2 auto-added SFP-532T already cover the TAP's 1 link (2 ports).
            // A user then manually adds 1 more (e.g. for an unrelated SPAN
            // link) as a plain, non-pinned entry of the same type.
            optics: [
              { board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 2, isAutoAdded: true },
              { board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 1 },
            ],
          },
        },
      ];
      const edges = [{ id: 'e1', source: 'tap-1', target: 'ta-1' }];

      const syncedNodes = syncOpticsOnTapConnection(nodes, edges);
      const taNode = syncedNodes.find(n => n.id === 'ta-1');
      const totalSfp532 = (taNode?.data.optics as InstalledOptic[] | undefined)
        ?.filter(o => o.optic.includes('SFP-532'))
        .reduce((sum, o) => sum + o.qty, 0);

      // 2 auto (still covering the TAP) + 1 manual (untouched) = 3, not capped at 2.
      expect(totalSfp532).toBe(3);
    });
  });

  describe('validateConfiguration', () => {
    it('should return error if GigaSMART node is not connected to HC', () => {
      const nodes: CustomNode[] = [
        {
          id: 'gs-1',
          type: 'gigaSmartNode',
          position: { x: 0, y: 0 },
          data: { label: 'Dedup', configType: 'GigaSMART', actionType: 'Deduplication' }
        }
      ];
      const errors = validateConfiguration(nodes, []);
      expect(errors.some(e => e.type === 'no_hc_for_gigasmart')).toBe(true);
    });

    it('should return error if SFP capacity is exceeded', () => {
      const nodes: CustomNode[] = [
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'HC1',
            configType: 'HC',
            model: 'GigaVUE-HC1',
            optics: [{ board: 'Base Ports', optic: 'SFP-532', qty: 20 }] // HC1 base has 12 SFP cages
          }
        }
      ];
      const errors = validateConfiguration(nodes, []);
      expect(errors.some(e => e.type === 'port_capacity_exceeded')).toBe(true);
    });

    it('should flag an error if an optic SKU is marked as End of Sale in skus_metadata', () => {
      setMockSkusMetadata({
        'SFP-532T': { eos: '2025-07-07', replacement: 'SFP-532T-Replacement' }
      });
      
      const nodes: CustomNode[] = [
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'HC1',
            configType: 'HC',
            model: 'GigaVUE-HC1',
            optics: [{ board: 'Base Ports', optic: 'SFP-532', qty: 2 }]
          }
        }
      ];
      const errors = validateConfiguration(nodes, []);
      expect(errors.some(e => e.type === 'eos_eol_sku_used' && e.message.includes('End of Sale') && e.message.includes('SFP-532T-Replacement'))).toBe(true);
      
      // Clean up mock
      setMockSkusMetadata(null);
    });
  });
});

describe('MPO breakout panel validation', () => {
  const chassis = (id: string, optic: string, board = 'Base Ports', qty = 1): CustomNode => ({
    id,
    type: 'hardwareNode',
    position: { x: 0, y: 0 },
    data: { label: id, model: 'GigaVUE-TA25E', sku: 'TA25E-BASE', optics: [{ board, optic, qty }] },
  } as CustomNode);

  const panel = (id: string): CustomNode => ({
    id,
    type: 'hardwareNode',
    position: { x: 0, y: 0 },
    data: { label: id, model: 'PNL-M341T', sku: 'PNL-M341T' },
  } as CustomNode);

  const panelSM = (id: string): CustomNode => ({
    id,
    type: 'hardwareNode',
    position: { x: 0, y: 0 },
    data: { label: id, model: 'PNL-M343T', sku: 'PNL-M343T' },
  } as CustomNode);

  const tool = (id: string): CustomNode => ({
    id,
    type: 'toolNode',
    position: { x: 0, y: 0 },
    data: { label: id, configType: 'Packet Tool' },
  } as CustomNode);

  it('a chassis with a valid parallel optic wired to a panel, fanned out to a tool, raises no breakout errors', () => {
    const nodes = [chassis('c1', 'Q28-502T (100G QSFP28 SR4)'), panel('p1'), tool('t1')];
    const edges: Edge[] = [
      { id: 'e1', source: 'c1', target: 'p1' },
      { id: 'e2', source: 'p1', target: 't1' },
    ];
    const synced = syncPortAssignments(nodes, edges);
    const errors = validateConfiguration(nodes, synced);

    expect(errors.filter(e => e.type.startsWith('breakout_'))).toEqual([]);
    // Sanity: the chassis really did land on a QSFP cage and the panel on an MPO port.
    const e1Links = (synced[0].data?.portLinks as PortLink[]) || [];
    expect(e1Links[0]?.sourcePortId).toMatch(/^1\/1\/c/);
    expect(e1Links[0]?.targetPortId).toBe('1/1/m1');
  });

  it('flags a non-parallel optic (LR4) on the chassis side of a breakout link', () => {
    const nodes = [chassis('c1', 'Q28-503T (100G QSFP28 LR4)'), panel('p1')];
    const edges: Edge[] = [{ id: 'e1', source: 'c1', target: 'p1' }];
    const synced = syncPortAssignments(nodes, edges);
    const errors = validateConfiguration(nodes, synced);

    const err = errors.find(e => e.type === 'breakout_optic_incompatible');
    expect(err).toBeDefined();
    expect(err?.nodeId).toBe('c1');
    expect(err?.message).toContain('Q28-503T');
  });

  it('flags a multimode parallel optic (SR4) feeding a singlemode panel (PNL-M343T)', () => {
    const nodes = [chassis('c1', 'Q28-502T (100G QSFP28 SR4)'), panelSM('p1')];
    const edges: Edge[] = [{ id: 'e1', source: 'c1', target: 'p1' }];
    const synced = syncPortAssignments(nodes, edges);
    const errors = validateConfiguration(nodes, synced);

    // A genuinely parallel optic, so it must NOT also trip the separate
    // "not a parallel-fibre optic" check - these are distinct problems.
    expect(errors.some(e => e.type === 'breakout_optic_incompatible')).toBe(false);
    const err = errors.find(e => e.type === 'breakout_panel_fiber_type_mismatch');
    expect(err).toBeDefined();
    expect(err?.nodeId).toBe('c1');
    expect(err?.message).toContain('Q28-502T');
    expect(err?.message).toContain('multimode');
  });

  it('flags a singlemode parallel optic (PLR4) feeding a multimode panel (PNL-M341T)', () => {
    const nodes = [chassis('c1', 'Q28-506 (100G QSFP28 PLR4)'), panel('p1')];
    const edges: Edge[] = [{ id: 'e1', source: 'c1', target: 'p1' }];
    const synced = syncPortAssignments(nodes, edges);
    const errors = validateConfiguration(nodes, synced);

    expect(errors.some(e => e.type === 'breakout_optic_incompatible')).toBe(false);
    const err = errors.find(e => e.type === 'breakout_panel_fiber_type_mismatch');
    expect(err).toBeDefined();
    expect(err?.nodeId).toBe('c1');
    expect(err?.message).toContain('Q28-506');
  });

  it('accepts a fibre-type-matched parallel optic (SR4 -> multimode panel) with no fibre mismatch error', () => {
    const nodes = [chassis('c1', 'Q28-502T (100G QSFP28 SR4)'), panel('p1')];
    const edges: Edge[] = [{ id: 'e1', source: 'c1', target: 'p1' }];
    const synced = syncPortAssignments(nodes, edges);
    const errors = validateConfiguration(nodes, synced);

    expect(errors.some(e => e.type === 'breakout_panel_fiber_type_mismatch')).toBe(false);
  });

  it('also flags a fibre-type mismatch wired in the aggregation direction (panel -> chassis)', () => {
    const nodes = [panelSM('p1'), chassis('c1', 'Q28-502T (100G QSFP28 SR4)')];
    const edges: Edge[] = [{ id: 'e1', source: 'p1', target: 'c1' }];
    const synced = syncPortAssignments(nodes, edges);
    const errors = validateConfiguration(nodes, synced);

    const err = errors.find(e => e.type === 'breakout_panel_fiber_type_mismatch');
    expect(err).toBeDefined();
    expect(err?.nodeId).toBe('c1');
  });

  it('flags an LC lane optic that does not match the group\'s derived speed/fibre tier', () => {
    // 100G MM parent -> lanes should be 25G SR (SFP-552/552T); wire the lane to a
    // second chassis fitted with a 10G optic instead, a genuine speed mismatch.
    const nodes = [
      chassis('c1', 'Q28-502T (100G QSFP28 SR4)'),
      panel('p1'),
      chassis('c2', 'SFP-532T (10G SFP+ SR)'),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'c1', target: 'p1', data: { portLinks: [{ sourcePortId: '1/1/c1', targetPortId: '1/1/m1' }] } },
      { id: 'e2', source: 'p1', target: 'c2', data: { portLinks: [{ sourcePortId: '1/1/m1/1', targetPortId: '1/1/x1' }] } },
    ] as Edge[];

    const errors = validateConfiguration(nodes, edges);
    const err = errors.find(e => e.type === 'breakout_lane_speed_mismatch');
    expect(err).toBeDefined();
    expect(err?.nodeId).toBe('c2');
    expect(err?.message).toContain('SFP-532T');
  });

  it('accepts a correctly speed-matched LC lane optic with no mismatch error', () => {
    const nodes = [
      chassis('c1', 'Q28-502T (100G QSFP28 SR4)'),
      panel('p1'),
      chassis('c2', 'SFP-552T (25G SFP28 SR)'),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'c1', target: 'p1', data: { portLinks: [{ sourcePortId: '1/1/c1', targetPortId: '1/1/m1' }] } },
      { id: 'e2', source: 'p1', target: 'c2', data: { portLinks: [{ sourcePortId: '1/1/m1/1', targetPortId: '1/1/x1' }] } },
    ] as Edge[];

    const errors = validateConfiguration(nodes, edges);
    expect(errors.some(e => e.type === 'breakout_lane_speed_mismatch')).toBe(false);
  });

  // The panel/chassis edge can point either way - chassis->panel for breakout
  // (chassis feeds the panel, fans out to lower-speed legs) or panel->chassis
  // for aggregation (lower-speed legs feed the panel, funnels up into the
  // chassis). validateBreakoutPanels() treats "the panel's MPO peer" the same
  // regardless of edge direction, so the same parallel-optic rule (and its
  // KB-sourced exclusions, e.g. QDD-501) must hold in both directions.
  const qddChassis = (id: string, optic: string, qty = 1): CustomNode => ({
    id,
    type: 'hardwareNode',
    position: { x: 0, y: 0 },
    data: { label: id, model: 'GigaVUE-TA400E', sku: 'TA400E-BASE', optics: [{ board: 'Base Ports', optic, qty }] },
  } as CustomNode);

  it('flags QDD-501 (physically parallel but not a Gigamon-supported breakout SKU) wired in the aggregation direction (panel -> chassis)', () => {
    const nodes = [panel('p1'), qddChassis('c1', 'QDD-501 (400G QSFP-DD SR4)')];
    const edges: Edge[] = [{ id: 'e1', source: 'p1', target: 'c1' }];
    const synced = syncPortAssignments(nodes, edges);
    const errors = validateConfiguration(nodes, synced);

    const err = errors.find(e => e.type === 'breakout_optic_incompatible');
    expect(err).toBeDefined();
    expect(err?.nodeId).toBe('c1');
    expect(err?.message).toContain('QDD-501');
  });

  it('accepts a genuinely supported aggregation parent (QDD-511, singlemode panel) wired panel -> chassis with no breakout errors', () => {
    const nodes = [panelSM('p1'), qddChassis('c1', 'QDD-511 (400G QSFP-DD DR4)')];
    const edges: Edge[] = [{ id: 'e1', source: 'p1', target: 'c1' }];
    const synced = syncPortAssignments(nodes, edges);
    const errors = validateConfiguration(nodes, synced);

    expect(errors.filter(e => e.type.startsWith('breakout_'))).toEqual([]);
  });

  it('flags a panel with more MPO groups wired than it physically has (defensive check for corrupted/hand-edited data)', () => {
    const nodes = [
      chassis('c1', 'Q28-502T (100G QSFP28 SR4)'),
      chassis('c2', 'Q28-502T (100G QSFP28 SR4)'),
      chassis('c3', 'Q28-502T (100G QSFP28 SR4)'),
      chassis('c4', 'Q28-502T (100G QSFP28 SR4)'),
      panel('p1'),
    ];
    // A real panel only exposes 3 MPO ports (getPanelPorts) - m4 does not exist,
    // simulating hand-edited/imported project data claiming a 4th group.
    const edges: Edge[] = ['m1', 'm2', 'm3', 'm4'].map((mpo, i) => ({
      id: `e${i}`,
      source: `c${i + 1}`,
      target: 'p1',
      data: { portLinks: [{ sourcePortId: '1/1/c1', targetPortId: `1/1/${mpo}` }] },
    })) as Edge[];

    const errors = validateConfiguration(nodes, edges);
    const err = errors.find(e => e.type === 'breakout_panel_capacity_exceeded');
    expect(err).toBeDefined();
    expect(err?.nodeId).toBe('p1');
  });
});
