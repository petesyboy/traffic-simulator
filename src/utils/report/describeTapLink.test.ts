import { describe, it, expect } from 'vitest';
import { describeTapPhysicalLink } from './describeTapLink';
import { NODE_TYPES } from '../../constants/nodeTypes';
import type { CustomNode } from '../../store/types';
import type { Edge } from '@xyflow/react';

const node = (id: string, type: string, data: Record<string, unknown>): CustomNode =>
  ({
    id,
    type,
    position: { x: 0, y: 0 },
    data,
  }) as CustomNode;

const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

describe('describeTapPhysicalLink', () => {
  it('describes a standalone multimode TAP with a matched optic label', () => {
    const nodes: CustomNode[] = [
      node('in1', NODE_TYPES.INPUT, {
        label: 'Core Tap 1',
        configType: 'TAP',
        tapFiberMode: 'Multimode',
        tappedLinkOptic: '10G-SFP-SR',
      }),
    ];
    const bullets = describeTapPhysicalLink(nodes[0], nodes, []);
    expect(bullets[0]).toContain('Multimode');
    expect(bullets[0]).toContain('10Gb SFP+ SR');
  });

  it('describes a standalone singlemode TAP', () => {
    const nodes: CustomNode[] = [
      node('in1', NODE_TYPES.INPUT, {
        label: 'Core Tap 1',
        configType: 'TAP',
        tapFiberMode: 'Singlemode',
        tappedLinkOptic: 'SFP-533',
      }),
    ];
    const bullets = describeTapPhysicalLink(nodes[0], nodes, []);
    expect(bullets[0]).toContain('Singlemode');
  });

  it('defaults to Multimode when tapFiberMode is unset', () => {
    const nodes: CustomNode[] = [node('in1', NODE_TYPES.INPUT, { label: 'Core Tap 1', configType: 'TAP' })];
    const bullets = describeTapPhysicalLink(nodes[0], nodes, []);
    expect(bullets[0]).toBe('Fibre: Multimode');
  });

  it('includes the tapped links count when set', () => {
    const nodes: CustomNode[] = [
      node('in1', NODE_TYPES.INPUT, { label: 'Core Tap 1', configType: 'TAP', tappedLinksCount: 3 }),
    ];
    const bullets = describeTapPhysicalLink(nodes[0], nodes, []);
    expect(bullets).toContain('Tapped links: 3');
  });

  it('names the connected chassis and lists its installed optics, deduped by SKU', () => {
    const nodes: CustomNode[] = [
      node('in1', NODE_TYPES.INPUT, { label: 'Core Tap 1', configType: 'TAP' }),
      node('hw1', NODE_TYPES.HARDWARE, {
        label: 'HC1 Chassis',
        model: 'GigaVUE-HC1',
        optics: [
          { board: 'Base', optic: 'SFP-532', qty: 1 },
          { board: 'Base', optic: 'SFP-532', qty: 1 },
          { board: 'Base', optic: 'SFP-533', qty: 2 },
        ],
      }),
    ];
    const edges = [edge('e1', 'in1', 'hw1')];
    const bullets = describeTapPhysicalLink(nodes[0], nodes, edges);
    expect(bullets).toContain('Connects into: HC1 Chassis (GigaVUE-HC1)');
    const opticsBullet = bullets.find((b) => b.startsWith('Installed optics on HC1 Chassis:'));
    expect(opticsBullet).toContain('SFP-532 ×2');
    expect(opticsBullet).toContain('SFP-533 ×2');
  });

  it('classifies a paired TAP-model hardwareNode as singlemode from its SKU', () => {
    const nodes: CustomNode[] = [
      node('hwtap1', NODE_TYPES.HARDWARE, { label: 'TAP Unit', model: 'TAP-M253T', sku: 'TAP-M253T' }),
      node('hw1', NODE_TYPES.HARDWARE, { label: 'HC1 Chassis', model: 'GigaVUE-HC1', optics: [] }),
    ];
    const edges = [edge('e1', 'hwtap1', 'hw1')];
    const bullets = describeTapPhysicalLink(nodes[0], nodes, edges);
    expect(bullets[0]).toBe('Fibre: Singlemode');
    expect(bullets).toContain('Connects into: HC1 Chassis (GigaVUE-HC1)');
  });

  it('classifies a paired TAP-model hardwareNode as multimode by default', () => {
    const nodes: CustomNode[] = [node('hwtap1', NODE_TYPES.HARDWARE, { label: 'TAP Unit', model: 'TAP-M251T' })];
    const bullets = describeTapPhysicalLink(nodes[0], nodes, []);
    expect(bullets[0]).toBe('Fibre: Multimode');
  });

  it('returns just the fibre-mode bullet with no crash when nothing else is configured', () => {
    const nodes: CustomNode[] = [node('in1', NODE_TYPES.INPUT, { label: 'Bare Tap', configType: 'TAP' })];
    const bullets = describeTapPhysicalLink(nodes[0], nodes, []);
    expect(bullets).toEqual(['Fibre: Multimode']);
  });
});
