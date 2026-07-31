import { describe, it, expect } from 'vitest';
import skus from './skus.json';
import {
  getCompatibleTapOptics,
  getTapTerminationClass,
  isTapOpticCompatible,
} from './tapOpticRules';

const skuSet = skus as Record<string, string>;

describe('getTapTerminationClass', () => {
  it('classifies the LC module TAPs by fibre type', () => {
    expect(getTapTerminationClass('TAP-M251T', 'TAP-M251T')).toBe('multimode-lc');
    expect(getTapTerminationClass('TAP-M253T', 'TAP-M253T')).toBe('singlemode-lc');
    // Singlemode ULT shares the M253T range; multimode ULT is capped at 25G.
    expect(getTapTerminationClass('TAP-M253ULT', 'TAP-M253ULT')).toBe('singlemode-lc');
    expect(getTapTerminationClass('TAP-M251ULT', 'TAP-M251ULT')).toBe('multimode-lc-ult');
  });

  it('classifies the BiDi tap separately', () => {
    expect(getTapTerminationClass('TAP-M506T', 'TAP-M506T')).toBe('bidi');
  });

  it('leaves TAPs it does not govern alone', () => {
    expect(getTapTerminationClass('G-TAP A-SF2', 'GTP-ASF22')).toBeUndefined();
    expect(getTapTerminationClass('G-TAP A-TX2', 'GTP-ATX21')).toBeUndefined();
    expect(getTapTerminationClass('GigaVUE-TA25E', 'TA25E-BASE')).toBeUndefined();
  });
});

describe('TAP-M251T (multimode LC)', () => {
  const optics = getCompatibleTapOptics('TAP-M251T', 'TAP-M251T');
  const skusOf = optics.map(o => o.sku);

  it('offers the multimode SX/SR range at 1/10/25G', () => {
    expect(skusOf).toEqual(expect.arrayContaining([
      'SFP-502', 'SFP-502T', 'SFP-532', 'SFP-532T', 'SFP-552', 'SFP-552T',
    ]));
    expect(skusOf).toEqual(expect.arrayContaining(['SFP-532-20P', 'SFP-532T-20P']));
  });

  it('uses SWDM4 - not SR4 - for 40G and 100G multimode over LC', () => {
    expect(optics.find(o => o.speed === '40G')?.sku).toBe('QSF-508');
    expect(optics.find(o => o.speed === '100G')?.sku).toBe('Q28-508');
    expect(optics.filter(o => o.speed === '40G' || o.speed === '100G').every(o => o.standard === 'SWDM4')).toBe(true);
  });

  it('excludes singlemode, MPO and BiDi parts', () => {
    // Singlemode LR/LX would not light on an 830-940nm multimode tap.
    expect(skusOf).not.toContain('SFP-533');
    expect(skusOf).not.toContain('Q28-503T');
    // MPO connectors are not a direct LC termination.
    expect(skusOf).not.toContain('QSF-506');
    expect(skusOf).not.toContain('Q28-506');
    // QSB BiDi parts belong to the M506T.
    expect(skusOf.some(s => s.startsWith('QSB-'))).toBe(false);
  });

  it('rejects an incompatible optic and accepts a valid one', () => {
    expect(isTapOpticCompatible('TAP-M251T', 'TAP-M251T', 'Q28-508')).toBe(true);
    expect(isTapOpticCompatible('TAP-M251T', 'TAP-M251T', 'Q28-508 (100G SWDM4)')).toBe(true);
    expect(isTapOpticCompatible('TAP-M251T', 'TAP-M251T', 'Q28-503T')).toBe(false);
    expect(isTapOpticCompatible('TAP-M251T', 'TAP-M251T', 'QSB-523T')).toBe(false);
  });
});

describe('TAP-M253T (singlemode LC)', () => {
  const optics = getCompatibleTapOptics('TAP-M253T', 'TAP-M253T');
  const skusOf = optics.map(o => o.sku);

  it('offers the full singlemode LC range', () => {
    expect(skusOf).toEqual(expect.arrayContaining([
      'SFP-503', 'SFP-503T', 'SFP-533', 'SFP-533T', 'SFP-534', 'SFP-534T', 'SFP-553T',
      'QSF-503T', 'QSF-504', 'Q28-503', 'Q28-503T', 'Q28-504', 'Q28-504T',
      'Q28-511T', 'Q28-513', 'Q28-514',
    ]));
  });

  it('omits SFP-553 and QSF-503, superseded by their TAA variants', () => {
    expect(skusOf).not.toContain('SFP-553');
    expect(skusOf).not.toContain('QSF-503');
    expect(skusOf).toContain('SFP-553T');
    expect(skusOf).toContain('QSF-503T');
  });

  it('excludes multimode, MPO and BiDi parts', () => {
    expect(skusOf).not.toContain('SFP-532T');
    expect(skusOf).not.toContain('Q28-508');
    expect(skusOf).not.toContain('QSF-506T');
    expect(skusOf.some(s => s.startsWith('QSB-'))).toBe(false);
  });
});

describe('TAP-M251ULT (multimode LC, unidirectional)', () => {
  const optics = getCompatibleTapOptics('TAP-M251ULT', 'TAP-M251ULT');
  const skusOf = optics.map(o => o.sku);

  it('offers the multimode SX/SR range up to 25G', () => {
    expect(skusOf).toEqual(expect.arrayContaining([
      'SFP-502', 'SFP-502T', 'SFP-532', 'SFP-532T', 'SFP-552', 'SFP-552T',
    ]));
  });

  it('stops at 25G, unlike the M251T', () => {
    // The ULT documentation describes M251ULT as 1/10/25G; older pricing text
    // claiming 40/100G is deliberately not followed.
    expect(optics.every(o => o.speed === '1G' || o.speed === '10G' || o.speed === '25G')).toBe(true);
    expect(skusOf).not.toContain('QSF-508');
    expect(skusOf).not.toContain('Q28-508');
    // ...whereas the standard M251T does carry them.
    expect(getCompatibleTapOptics('TAP-M251T', 'TAP-M251T').map(o => o.sku)).toContain('Q28-508');
  });

  it('rejects the 40/100G SWDM4 parts its non-ULT sibling accepts', () => {
    expect(isTapOpticCompatible('TAP-M251ULT', 'TAP-M251ULT', 'Q28-508')).toBe(false);
    expect(isTapOpticCompatible('TAP-M251ULT', 'TAP-M251ULT', 'SFP-552T')).toBe(true);
  });
});

describe('TAP-M253ULT (singlemode LC, unidirectional)', () => {
  const skusOf = getCompatibleTapOptics('TAP-M253ULT', 'TAP-M253ULT').map(o => o.sku);

  it('shares the full singlemode LC range with the M253T', () => {
    expect(skusOf).toEqual(getCompatibleTapOptics('TAP-M253T', 'TAP-M253T').map(o => o.sku));
    expect(skusOf).toEqual(expect.arrayContaining(['SFP-503T', 'SFP-533T', 'SFP-553T', 'QSF-503T', 'Q28-503T', 'Q28-514']));
  });

  it('offers nothing above 100G on a TA25E, whatever the module supports', () => {
    // The module itself reaches 400G, but a TA25/TA25E has no QSFP-DD cage.
    const onTa25e = getCompatibleTapOptics('TAP-M253ULT', 'TAP-M253ULT', 'GigaVUE-TA25E');
    expect(onTa25e.some(o => o.speed === '400G')).toBe(false);
  });
});

describe('chassis narrowing', () => {
  it('drops 1/10/25G options on QSFP-only chassis', () => {
    const onTa200 = getCompatibleTapOptics('TAP-M253T', 'TAP-M253T', 'GigaVUE-TA200').map(o => o.sku);
    expect(onTa200).not.toContain('SFP-533T');
    expect(onTa200).toContain('Q28-503T');
  });

  it('keeps SFP and QSFP options on a TA25E, which has both cage types', () => {
    const onTa25e = getCompatibleTapOptics('TAP-M251T', 'TAP-M251T', 'GigaVUE-TA25E').map(o => o.sku);
    expect(onTa25e).toContain('SFP-532T');
    expect(onTa25e).toContain('Q28-508');
  });

  it('never offers 400G on a TA25/TA25E, which has no QSFP-DD cages', () => {
    const onTa25e = getCompatibleTapOptics('TAP-M253T', 'TAP-M253T', 'GigaVUE-TA25E');
    expect(onTa25e.some(o => o.speed === '400G')).toBe(false);
    expect(onTa25e.some(o => o.sku.startsWith('QDD-'))).toBe(false);
  });
});

describe('catalogue integrity', () => {
  it('every optic in the matrix is a real SKU', () => {
    const all = [
      ...getCompatibleTapOptics('TAP-M251T', 'TAP-M251T'),
      ...getCompatibleTapOptics('TAP-M253T', 'TAP-M253T'),
      ...getCompatibleTapOptics('TAP-M506T', 'TAP-M506T'),
    ];
    const unknown = all.map(o => o.sku).filter(s => !skuSet[s]);
    expect(unknown).toEqual([]);
  });

  it('flags the TAA variants correctly', () => {
    const mm = getCompatibleTapOptics('TAP-M251T', 'TAP-M251T');
    expect(mm.find(o => o.sku === 'SFP-532T')?.taa).toBe(true);
    expect(mm.find(o => o.sku === 'SFP-532')?.taa).toBe(false);
    expect(mm.find(o => o.sku === 'SFP-532T-20P')?.taa).toBe(true);
    // QSF-508 and Q28-508 are non-TAA-only options.
    expect(mm.find(o => o.sku === 'QSF-508')?.taa).toBe(false);
    expect(mm.find(o => o.sku === 'Q28-508')?.taa).toBe(false);
  });
});
