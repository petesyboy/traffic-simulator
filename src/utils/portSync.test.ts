import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { CustomNode, PortLink } from '../store/types';
import { syncPortAssignments } from './portSync';
import { generateBom, syncOpticsOnTapConnection } from './bom/bomGenerator';
import { validateConfiguration } from './bom/configValidator';

const tapNode = (id = 'tap', links = 4, optic = 'SFP-532T (10G SFP+ SR)'): CustomNode => ({
  id,
  type: 'hardwareNode',
  position: { x: 0, y: 0 },
  data: {
    label: 'G-TAP A-SF2',
    model: 'G-TAP A-SF2',
    sku: 'GTP-ASF22',
    tappedLinkAllocations: [{ qty: links, optic }],
    tappedLinksCount: links,
  },
} as CustomNode);

const ta25eNode = (id = 'ta', opticQty = 8, optic = 'SFP-532T (10G SFP+ SR)'): CustomNode => ({
  id,
  type: 'hardwareNode',
  position: { x: 0, y: 0 },
  data: {
    label: 'Core TA25E',
    model: 'GigaVUE-TA25E',
    sku: 'TA25E-BASE',
    optics: [{ board: 'Base Ports', optic, qty: opticQty }],
  },
} as CustomNode);

const linksOf = (edge: Edge): PortLink[] => (edge.data?.portLinks as PortLink[]) || [];

describe('syncPortAssignments', () => {
  it('allocates two chassis ports per tapped link - 4 links become 8 ports', () => {
    const nodes = [tapNode(), ta25eNode()];
    const edges: Edge[] = [{ id: 'e1', source: 'tap', target: 'ta' }];

    const links = linksOf(syncPortAssignments(nodes, edges)[0]);

    expect(links).toHaveLength(8);
    // Each tapped link contributes a north and a south feed.
    expect(links.map(l => l.sourcePortId)).toEqual([
      'L1-N', 'L1-S', 'L2-N', 'L2-S', 'L3-N', 'L3-S', 'L4-N', 'L4-S',
    ]);
    // ...landing on eight consecutive SFP cages on the chassis.
    expect(links.map(l => l.targetPortId)).toEqual([
      '1/1/x1', '1/1/x2', '1/1/x3', '1/1/x4', '1/1/x5', '1/1/x6', '1/1/x7', '1/1/x8',
    ]);
    // Every allocated port reports the optic actually fitted to it.
    expect(links.every(l => l.opticSku?.startsWith('SFP-532T'))).toBe(true);
  });

  it('picks a QSFP cage when the TAP is running 100G optics', () => {
    const nodes = [tapNode('tap', 2, 'Q28-502T (100G QSFP28 SR4)'), ta25eNode('ta', 4, 'Q28-502T (100G QSFP28 SR4)')];
    const edges: Edge[] = [{ id: 'e1', source: 'tap', target: 'ta' }];

    const links = linksOf(syncPortAssignments(nodes, edges)[0]);
    expect(links).toHaveLength(4);
    expect(links.map(l => l.targetPortId)).toEqual(['1/1/c1', '1/1/c2', '1/1/c3', '1/1/c4']);
  });

  it('does not hand the same port to two different links', () => {
    const nodes = [tapNode('tapA', 2), tapNode('tapB', 2), ta25eNode()];
    const edges: Edge[] = [
      { id: 'e1', source: 'tapA', target: 'ta' },
      { id: 'e2', source: 'tapB', target: 'ta' },
    ];

    const synced = syncPortAssignments(nodes, edges);
    const allTargets = synced.flatMap(e => linksOf(e).map(l => l.targetPortId));

    expect(allTargets).toHaveLength(8);
    expect(new Set(allTargets).size).toBe(8);
  });

  it('keeps a pinned assignment through a re-sync after the graph changes', () => {
    const nodes = [tapNode('tap', 1), ta25eNode()];
    const edges: Edge[] = [{ id: 'e1', source: 'tap', target: 'ta' }];

    const first = syncPortAssignments(nodes, edges);
    // Pin the first link onto a port well away from the auto-allocated x1.
    const pinned: Edge[] = first.map(e => ({
      ...e,
      data: {
        ...e.data,
        portLinks: linksOf(e).map((l, i) => (i === 0 ? { ...l, targetPortId: '1/1/x40', pinned: true } : l)),
      },
    }));

    const withExtraNode = [...nodes, ta25eNode('ta2')];
    const resynced = syncPortAssignments(withExtraNode, pinned);

    expect(linksOf(resynced[0])[0].targetPortId).toBe('1/1/x40');
    expect(linksOf(resynced[0])[0].pinned).toBe(true);
  });

  it('routes an auto link around a port another link has pinned', () => {
    const nodes = [tapNode('tap', 2), ta25eNode()];

    const pinnedEdges: Edge[] = [{
      id: 'e1',
      source: 'tap',
      target: 'ta',
      data: { portLinks: [{ sourcePortId: 'L1-N', targetPortId: '1/1/x2', pinned: true }] },
    }];

    const links = linksOf(syncPortAssignments(nodes, pinnedEdges)[0]);
    const targets = links.map(l => l.targetPortId);

    expect(targets).toContain('1/1/x2');
    // x2 is spoken for, so auto allocation must skip over it.
    expect(targets.filter(t => t === '1/1/x2')).toHaveLength(1);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('returns the identical array reference when nothing changed', () => {
    const nodes = [tapNode(), ta25eNode()];
    const edges: Edge[] = [{ id: 'e1', source: 'tap', target: 'ta' }];

    const first = syncPortAssignments(nodes, edges);
    const second = syncPortAssignments(nodes, first);

    // Re-render safety: an unchanged sync must not churn the store.
    expect(second).toBe(first);
  });

  it('preserves unrelated edge data rather than clobbering it', () => {
    const nodes = [tapNode('tap', 1), ta25eNode()];
    const edges: Edge[] = [{ id: 'e1', source: 'tap', target: 'ta', data: { parallelIndex: 0, totalParallel: 1 } }];

    const synced = syncPortAssignments(nodes, edges);
    expect(synced[0].data?.parallelIndex).toBe(0);
    expect(synced[0].data?.totalParallel).toBe(1);
    expect(linksOf(synced[0])).toHaveLength(2);
  });

  it('allocates nothing for a purely logical edge between non-chassis nodes', () => {
    const nodes: CustomNode[] = [
      { id: 'gs', type: 'gigaSmartNode', position: { x: 0, y: 0 }, data: { actionType: 'Deduplication' } } as CustomNode,
      { id: 'tool', type: 'toolNode', position: { x: 0, y: 0 }, data: { configType: 'Packet Tool' } } as CustomNode,
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'gs', target: 'tool' }];

    expect(linksOf(syncPortAssignments(nodes, edges)[0])).toHaveLength(0);
  });

  it('still consumes a chassis port when the far end is a leaf tool with no ports', () => {
    const nodes: CustomNode[] = [
      ta25eNode(),
      { id: 'tool', type: 'toolNode', position: { x: 0, y: 0 }, data: { label: 'Splunk', configType: 'Metadata Tool' } } as CustomNode,
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'ta', target: 'tool' }];

    const links = linksOf(syncPortAssignments(nodes, edges)[0]);

    // The chassis end burns a real port; the tool end has none to record.
    expect(links).toHaveLength(1);
    expect(links[0].sourcePortId).toBe('1/1/x1');
    expect(links[0].targetPortId).toBe('');
  });

  it('stops allocating once the chassis physically runs out of cages', () => {
    // 30 tapped links would need 60 SFP ports; a TA25E only has 48.
    const nodes = [tapNode('tap', 30), ta25eNode('ta', 48)];
    const edges: Edge[] = [{ id: 'e1', source: 'tap', target: 'ta' }];

    const links = linksOf(syncPortAssignments(nodes, edges)[0]);
    expect(links).toHaveLength(48);
    expect(new Set(links.map(l => l.targetPortId)).size).toBe(48);
  });
});

describe('module TAP optics (TAP-M251T)', () => {
  const chassis = (model = 'GigaVUE-TA25E'): CustomNode => ({
    id: 'ch', type: 'hardwareNode', position: { x: 0, y: 0 },
    data: { label: 'Core', model, sku: 'TA25E-BASE' },
  } as CustomNode);

  const m251t = (data: Record<string, unknown>): CustomNode => ({
    id: 'tap', type: 'hardwareNode', position: { x: 0, y: 0 },
    data: { label: 'M251T', model: 'TAP-M251T', sku: 'TAP-M251T', ...data },
  } as CustomNode);

  const edges: Edge[] = [{ id: 'e1', source: 'tap', target: 'ch' }];

  it('installs chassis QSFP optics for a 100G-configured module TAP', () => {
    const nodes = [m251t({ tappedLinkAllocations: [{ qty: 2, optic: 'Passive Optical Splitter (Multimode)', toolOptic: '100G-QSFP28-SR4' }] }), chassis()];
    const synced = syncOpticsOnTapConnection(nodes, edges);
    const optics = (synced.find(n => n.id === 'ch')!.data.optics as { optic: string; qty: number }[]);

    // 2 tapped links x 2 ports each = 4 x 100G transceivers on the chassis.
    expect(optics).toHaveLength(1);
    expect(optics[0].optic).toContain('Q28-502T');
    expect(optics[0].qty).toBe(4);

    const bom = generateBom(nodes, edges, 'HTL', '12');
    expect(bom.find(r => r.sku === 'Q28-502T')?.qty).toBe(4);
  });

  it('never emits a bogus "PassiveT" SKU when the splitter label has no tool optic', () => {
    // The passive splitter label is descriptive, not a part number - it used to
    // resolve to "Passive" and reach the BOM as "PassiveT".
    const nodes = [m251t({ tappedLinkAllocations: [{ qty: 2, optic: 'Passive Optical Splitter (Multimode)' }] }), chassis()];
    const bom = generateBom(nodes, syncOpticsOnTapConnection(nodes, edges) && edges, 'HTL', '12');

    expect(bom.find(r => r.sku === 'PassiveT')).toBeUndefined();
    expect(bom.find(r => r.sku === 'Passive')).toBeUndefined();
    // Falls back to a real multimode transceiver for the chassis end instead.
    expect(bom.find(r => r.sku === 'SFP-532T')?.qty).toBe(4);
  });

  it('produces nothing but flags a clear warning when the TAP has no links configured', () => {
    // Exactly what the sidebar palette drops.
    const nodes = [m251t({ tappedLinksCount: 0, tappedLinkAllocations: [] }), chassis()];

    const synced = syncOpticsOnTapConnection(nodes, edges);
    expect(synced.find(n => n.id === 'ch')!.data.optics).toBeUndefined();
    expect(generateBom(nodes, edges, 'HTL', '12').filter(r => r.type === 'Optic')).toHaveLength(0);

    // ...but the silence is explained rather than left as a mystery.
    const errors = validateConfiguration(nodes, edges);
    const warning = errors.find(e => e.type === 'tap_not_configured');
    expect(warning).toBeDefined();
    expect(warning?.nodeId).toBe('tap');
    expect(warning?.message).toContain('no tapped links configured');
  });

  it('rejects a singlemode optic on the multimode M251T', () => {
    const nodes = [m251t({ tappedLinkAllocations: [{ qty: 2, optic: 'Passive Optical Splitter (Multimode)', toolOptic: 'Q28-503T' }] }), chassis()];
    const err = validateConfiguration(nodes, edges).find(e => e.type === 'tap_optic_incompatible');

    expect(err).toBeDefined();
    expect(err?.message).toContain('Q28-503T');
    // The message names the valid alternatives on this chassis.
    expect(err?.message).toContain('Q28-508');
  });

  it('allows a documented Rx-only BiDi part, for tapping a BiDi network link', () => {
    const nodes = [m251t({ tappedLinkAllocations: [{ qty: 1, optic: 'Passive Optical Splitter (Multimode)', toolOptic: 'QSB-523T' }] }), chassis()];
    expect(validateConfiguration(nodes, edges).find(e => e.type === 'tap_optic_incompatible')).toBeUndefined();
  });

  it('still rejects a BiDi part that is not one of the documented alternatives', () => {
    const nodes = [m251t({ tappedLinkAllocations: [{ qty: 1, optic: 'Passive Optical Splitter (Multimode)', toolOptic: 'QSB-521' }] }), chassis()];
    expect(validateConfiguration(nodes, edges).find(e => e.type === 'tap_optic_incompatible')).toBeDefined();
  });

  it('accepts the SWDM4 multimode optic the M251T actually terminates into', () => {
    const nodes = [m251t({ tappedLinkAllocations: [{ qty: 2, optic: 'Passive Optical Splitter (Multimode)', toolOptic: 'Q28-508' }] }), chassis()];
    expect(validateConfiguration(nodes, edges).find(e => e.type === 'tap_optic_incompatible')).toBeUndefined();
  });

  it('leaves an A-SF2 alone, since the matrix does not govern it', () => {
    const asf: CustomNode = {
      id: 'tap', type: 'hardwareNode', position: { x: 0, y: 0 },
      data: { label: 'A-SF2', model: 'G-TAP A-SF2', sku: 'GTP-ASF22', tappedLinkAllocations: [{ qty: 1, optic: '10G-SFP-SR' }] },
    } as CustomNode;
    expect(validateConfiguration([asf, chassis()], edges).find(e => e.type === 'tap_optic_incompatible')).toBeUndefined();
  });

  it('raises no such warning once the TAP is configured', () => {
    const nodes = [m251t({ tappedLinkAllocations: [{ qty: 2, optic: 'Passive Optical Splitter (Multimode)', toolOptic: '100G-QSFP28-SR4' }] }), chassis()];
    expect(validateConfiguration(nodes, edges).find(e => e.type === 'tap_not_configured')).toBeUndefined();
  });

  it('allocates real chassis ports for a configured module TAP', () => {
    const nodes = [
      m251t({ tappedLinkAllocations: [{ qty: 2, optic: 'Passive Optical Splitter (Multimode)', toolOptic: '100G-QSFP28-SR4' }] }),
      { id: 'ch', type: 'hardwareNode', position: { x: 0, y: 0 },
        data: { label: 'Core', model: 'GigaVUE-TA25E', optics: [{ board: 'Base Ports', optic: 'Q28-502T (100G QSFP28 SR4)', qty: 4 }] } } as CustomNode,
    ];
    const links = linksOf(syncPortAssignments(nodes, edges)[0]);

    expect(links).toHaveLength(4);
    expect(links.map(l => l.targetPortId)).toEqual(['1/1/c1', '1/1/c2', '1/1/c3', '1/1/c4']);
  });
});

describe('module TAP optics (TAP-M506T BiDi)', () => {
  const chassis = (): CustomNode => ({
    id: 'ch', type: 'hardwareNode', position: { x: 0, y: 0 },
    data: { label: 'Core', model: 'GigaVUE-TA25E', sku: 'TA25E-BASE' },
  } as CustomNode);

  const m506t = (toolOptic: string): CustomNode => ({
    id: 'tap', type: 'hardwareNode', position: { x: 0, y: 0 },
    data: {
      label: 'M506T', model: 'TAP-M506T', sku: 'TAP-M506T',
      tappedLinkAllocations: [{ qty: 1, optic: 'Passive Optical Splitter (Multimode)', toolOptic }],
    },
  } as CustomNode);

  const edges: Edge[] = [{ id: 'e1', source: 'tap', target: 'ch' }];

  // resolveOpticForChassis used to assume every SKU has a "T" TAA variant and
  // blindly appended one - but QSB-501/QSB-521/QSB-531 (Rx-only BiDi) have no
  // such variant, so picking any of them invented a nonexistent "QSB-521T"
  // style SKU that reached the BOM as unknown.
  it.each(['QSB-501', 'QSB-521', 'QSB-523T', 'QSB-531'])(
    'installs the real %s SKU on the chassis, never a fabricated "T" variant',
    (toolOptic) => {
      const nodes = [m506t(toolOptic), chassis()];
      const synced = syncOpticsOnTapConnection(nodes, edges);
      const optics = synced.find(n => n.id === 'ch')!.data.optics as { optic: string; qty: number }[];

      expect(optics).toHaveLength(1);
      expect(optics[0].optic).toContain(toolOptic);
      expect(optics[0].optic).not.toContain(toolOptic + 'T');

      const bom = generateBom(nodes, edges, 'HTL', '12');
      const opticRow = bom.find(r => r.type === 'Optic');
      expect(opticRow?.sku).toBe(toolOptic);
      expect(opticRow?.sku).not.toBe(toolOptic + 'T');
    },
  );
});

describe('BOM regression', () => {
  it('leaves BOM output untouched by port assignment', () => {
    const nodes = [tapNode(), ta25eNode()];
    const edges: Edge[] = [{ id: 'e1', source: 'tap', target: 'ta' }];

    // Port assignment consumes the optics the BOM already quotes; it must never
    // add, remove or re-count a line. The double-optic rule stays as it was.
    const before = generateBom(nodes, edges, 'HTL', '12');
    const after = generateBom(nodes, syncPortAssignments(nodes, edges), 'HTL', '12');

    expect(after).toEqual(before);
  });
});
