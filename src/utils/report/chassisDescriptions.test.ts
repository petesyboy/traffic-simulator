import { describe, it, expect } from 'vitest';
import { describeChassisPurpose } from './chassisDescriptions';

describe('describeChassisPurpose', () => {
  it.each([
    ['GigaVUE-TA25E', 'TA25E'],
    ['GigaVUE-TA200', 'TA200'],
    ['GigaVUE-TA200E', 'TA200'],
    ['GigaVUE-TA400', 'TA400'],
    ['GigaVUE-TA400E', 'TA400'],
    ['GigaVUE-HC1', 'HC1'],
    ['GigaVUE-HC1-Plus', 'HC1-Plus'],
    ['GigaVUE-HC3', 'HC3'],
    ['GigaVUE-HCT', 'HCT'],
  ])('returns a description mentioning %s for model %s', (model, expectedMention) => {
    const text = describeChassisPurpose(model);
    expect(text).toBeTruthy();
    expect(text).toContain(expectedMention);
  });

  it('distinguishes HC1-Plus from plain HC1', () => {
    expect(describeChassisPurpose('GigaVUE-HC1-Plus')).toContain('HC1-Plus');
    expect(describeChassisPurpose('GigaVUE-HC1')).not.toContain('HC1-Plus');
  });

  it('distinguishes HCT from HC1/HC3', () => {
    const text = describeChassisPurpose('GigaVUE-HCT');
    expect(text).toContain('top-of-rack');
  });

  it('returns undefined for a tap tray, tap unit, or unrecognised model', () => {
    expect(describeChassisPurpose('TAP-M100T')).toBeUndefined();
    expect(describeChassisPurpose('TAP-M251T')).toBeUndefined();
    expect(describeChassisPurpose('SomeOtherThing')).toBeUndefined();
  });

  it('returns undefined when no model is given', () => {
    expect(describeChassisPurpose(undefined)).toBeUndefined();
  });
});
