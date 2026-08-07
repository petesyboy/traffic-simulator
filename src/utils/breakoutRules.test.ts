import { describe, it, expect } from 'vitest';
import {
  isParallelBreakoutOptic,
  getBreakoutLaneSpeed,
  getBreakoutLcOptics,
  panelFiberType,
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
