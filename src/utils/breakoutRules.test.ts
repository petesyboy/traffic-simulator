import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { CustomNode, HardwareNodeData } from '../store/types';
import { getChassisPorts } from './ports';
import {
  isParallelBreakoutOptic,
  getBreakoutLaneSpeed,
  getBreakoutLcOptics,
  panelFiberType,
  boardFeedsBreakoutPanel,
} from './breakoutRules';

describe('isParallelBreakoutOptic', () => {
  it('accepts parallel-fibre standards', () => {
    expect(isParallelBreakoutOptic('QSF-502 (40G QSFP+ SR4)')).toBe(true);
    expect(isParallelBreakoutOptic('QSF-506 (40G QSFP+ PSM4)')).toBe(true);
    expect(isParallelBreakoutOptic('Q28-502T (100G QSFP28 SR4)')).toBe(true);
    expect(isParallelBreakoutOptic('Q28-506 (100G QSFP28 PLR4)')).toBe(true);
    expect(isParallelBreakoutOptic('QDD-511 (400G QSFP-DD DR4)')).toBe(true);
    expect(isParallelBreakoutOptic('QDD-512 (400G QSFP-DD DR4+)')).toBe(true);
    expect(isParallelBreakoutOptic('QDD-501 (400G QSFP-DD SR4)')).toBe(true);
  });

  it('rejects single-lambda optics even though several are otherwise valid optics elsewhere', () => {
    expect(isParallelBreakoutOptic('Q28-503T (100G QSFP28 LR4)')).toBe(false);
    expect(isParallelBreakoutOptic('Q28-513 (100G QSFP28 CWDM4)')).toBe(false);
    expect(isParallelBreakoutOptic('Q28-514 (100G QSFP28 FR1)')).toBe(false);
    expect(isParallelBreakoutOptic('Q28-511T (100G QSFP28 DR1)')).toBe(false);
    expect(isParallelBreakoutOptic('QDD-503 (400G QSFP-DD LR4)')).toBe(false);
    expect(isParallelBreakoutOptic('QDD-514 (400G QSFP-DD FR4)')).toBe(false);
    expect(isParallelBreakoutOptic('Q28-508 (100G QSFP28 SWDM4)')).toBe(false);
  });

  it('does not confuse a single-lane SR/DR with its parallel SR4/DR4 sibling', () => {
    expect(isParallelBreakoutOptic('Q28-515 (100G QSFP28 SR)')).toBe(false);
    expect(isParallelBreakoutOptic('SFP-532 (10G SFP+ SR)')).toBe(false);
  });
});

describe('getBreakoutLaneSpeed', () => {
  it('maps parent speed to lane speed', () => {
    expect(getBreakoutLaneSpeed('40G')).toBe('10G');
    expect(getBreakoutLaneSpeed('100G')).toBe('25G');
    expect(getBreakoutLaneSpeed('400G')).toBe('100G');
  });
});

describe('getBreakoutLcOptics', () => {
  it('40G multimode -> 10G SR', () => {
    expect(getBreakoutLcOptics('QSF-502 (40G QSFP+ SR4)')).toEqual([
      'SFP-532 (10G SFP+ SR)',
      'SFP-532T (10G SFP+ SR)',
    ]);
  });
  it('40G singlemode -> 10G LR', () => {
    expect(getBreakoutLcOptics('QSF-506 (40G QSFP+ PSM4)')).toEqual([
      'SFP-533 (10G SFP+ LR)',
      'SFP-533T (10G SFP+ LR)',
    ]);
  });
  it('100G multimode -> 25G SR', () => {
    expect(getBreakoutLcOptics('Q28-502T (100G QSFP28 SR4)')).toEqual([
      'SFP-552 (25G SFP28 SR)',
      'SFP-552T (25G SFP28 SR)',
    ]);
  });
  it('100G singlemode -> 25G LR', () => {
    expect(getBreakoutLcOptics('Q28-506 (100G QSFP28 PLR4)')).toEqual(['SFP-553T (25G SFP28 LR)']);
  });
  it('400G multimode -> single-lane 100G QSFP28 SR', () => {
    expect(getBreakoutLcOptics('QDD-501 (400G QSFP-DD SR4)')).toEqual(['Q28-515 (100G QSFP28 SR)']);
  });
  it('400G singlemode -> single-lane 100G QSFP28 DR1/FR1', () => {
    expect(getBreakoutLcOptics('QDD-511 (400G QSFP-DD DR4)')).toEqual([
      'Q28-511T (100G QSFP28 DR1)',
      'Q28-514 (100G QSFP28 FR1)',
    ]);
    expect(getBreakoutLcOptics('QDD-512 (400G QSFP-DD DR4+)')).toEqual([
      'Q28-511T (100G QSFP28 DR1)',
      'Q28-514 (100G QSFP28 FR1)',
    ]);
  });
});

describe('panelFiberType', () => {
  it('classifies by model naming convention', () => {
    expect(panelFiberType('PNL-M341T')).toBe('MM');
    expect(panelFiberType('PNL-M343T')).toBe('SM');
    expect(panelFiberType('GigaVUE-HC3')).toBeUndefined();
  });
});

describe('boardFeedsBreakoutPanel', () => {
  const hw = (data: Partial<HardwareNodeData>): HardwareNodeData => data as HardwareNodeData;
  const node = (id: string, data: Record<string, unknown>): CustomNode => ({
    id,
    type: 'hardwareNode',
    position: { x: 0, y: 0 },
    data,
  } as CustomNode);

  const chassisNode = (id: string) => node(id, { label: id, model: 'GigaVUE-TA25E', sku: 'TA25E-BASE', optics: [] });
  const panelNode = (id: string) => node(id, { label: id, model: 'PNL-M341T', sku: 'PNL-M341T' });

  const ports = getChassisPorts('GigaVUE-TA25E', hw({}));

  it('is false with no edges at all', () => {
    expect(boardFeedsBreakoutPanel('Base Ports', ports, 'c1', [chassisNode('c1')], [])).toBe(false);
  });

  it('is false when wired to a non-panel peer', () => {
    const nodes = [chassisNode('c1'), chassisNode('c2')];
    const edges = [{
      id: 'e1', source: 'c1', target: 'c2',
      data: { portLinks: [{ sourcePortId: '1/1/c1', targetPortId: '1/1/c1' }] },
    }] as unknown as Edge[];
    expect(boardFeedsBreakoutPanel('Base Ports', ports, 'c1', nodes, edges)).toBe(false);
  });

  it('is false when wired to a panel but on the LC leg, not the MPO trunk', () => {
    const nodes = [chassisNode('c1'), panelNode('p1')];
    const edges = [{
      id: 'e1', source: 'c1', target: 'p1',
      data: { portLinks: [{ sourcePortId: '1/1/c1', targetPortId: '1/1/m1/1' }] },
    }] as unknown as Edge[];
    expect(boardFeedsBreakoutPanel('Base Ports', ports, 'c1', nodes, edges)).toBe(false);
  });

  it('is true when this board has a cage wired to a panel MPO connector', () => {
    const nodes = [chassisNode('c1'), panelNode('p1')];
    const edges = [{
      id: 'e1', source: 'c1', target: 'p1',
      data: { portLinks: [{ sourcePortId: '1/1/c1', targetPortId: '1/1/m1' }] },
    }] as unknown as Edge[];
    expect(boardFeedsBreakoutPanel('Base Ports', ports, 'c1', nodes, edges)).toBe(true);
  });

  it('works regardless of which side of the edge this node is on', () => {
    const nodes = [chassisNode('c1'), panelNode('p1')];
    const edges = [{
      id: 'e1', source: 'p1', target: 'c1',
      data: { portLinks: [{ sourcePortId: '1/1/m1', targetPortId: '1/1/c1' }] },
    }] as unknown as Edge[];
    expect(boardFeedsBreakoutPanel('Base Ports', ports, 'c1', nodes, edges)).toBe(true);
  });

  it('is false for a different board on the same chassis', () => {
    const nodes = [chassisNode('c1'), panelNode('p1')];
    const edges = [{
      id: 'e1', source: 'c1', target: 'p1',
      data: { portLinks: [{ sourcePortId: '1/1/c1', targetPortId: '1/1/m1' }] },
    }] as unknown as Edge[];
    expect(boardFeedsBreakoutPanel('Some Other Board', ports, 'c1', nodes, edges)).toBe(false);
  });
});
