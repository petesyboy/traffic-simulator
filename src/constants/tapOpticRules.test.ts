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
    // ULT and non-ULT variants share their optic range on both fibre types.
    expect(getTapTerminationClass('TAP-M253ULT', 'TAP-M253ULT')).toBe('singlemode-lc');
    expect(getTapTerminationClass('TAP-M251ULT', 'TAP-M251ULT')).toBe('multimode-lc');
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
    // Singlemode has no business on a multimode tap.
    expect(isTapOpticCompatible('TAP-M251T', 'TAP-M251T', 'Q28-503T')).toBe(false);
    // QSB-521 is not one of the documented BiDi-link alternatives.
    expect(isTapOpticCompatible('TAP-M251T', 'TAP-M251T', 'QSB-521')).toBe(false);
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
  const skusOf = getCompatibleTapOptics('TAP-M251ULT', 'TAP-M251ULT').map(o => o.sku);

  it('carries the same 1/10/25/40/100G range as the M251T', () => {
    // An older Hardware Guide table shows M251ULT as 1/10/25G only; the current
    // product description and newer training material include 40/100G SWDM4.
    expect(skusOf).toEqual(getCompatibleTapOptics('TAP-M251T', 'TAP-M251T').map(o => o.sku));
    expect(skusOf).toEqual(expect.arrayContaining([
      'SFP-502', 'SFP-502T', 'SFP-532', 'SFP-532T', 'SFP-552', 'SFP-552T', 'QSF-508', 'Q28-508',
    ]));
  });

  it('uses SWDM4 rather than MPO SR4 at 40G and 100G', () => {
    // QSF-502 / Q28-502 are MPO and are not direct terminations for an LC tap.
    expect(skusOf).not.toContain('QSF-502');
    expect(skusOf).not.toContain('Q28-502');
    expect(isTapOpticCompatible('TAP-M251ULT', 'TAP-M251ULT', 'Q28-508')).toBe(true);
    expect(isTapOpticCompatible('TAP-M251ULT', 'TAP-M251ULT', 'Q28-502T')).toBe(false);
  });

  it('accepts the receive-only BiDi parts for a BiDi network link without offering them', () => {
    // Whether the monitored link is BiDi is a property of the link, not the TAP,
    // so these are valid if chosen but are not the default suggestion.
    ['QSB-501', 'QSB-523T', 'QSB-531'].forEach(sku => {
      expect(isTapOpticCompatible('TAP-M251ULT', 'TAP-M251ULT', sku)).toBe(true);
      expect(skusOf).not.toContain(sku);
    });
  });

  it('still refuses BiDi parts on a singlemode tap', () => {
    expect(isTapOpticCompatible('TAP-M253ULT', 'TAP-M253ULT', 'QSB-523T')).toBe(false);
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
