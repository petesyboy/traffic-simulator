import { describe, it, expect } from 'vitest';
import { areActionsCompatible } from './gigaSmartRules';

describe('areActionsCompatible', () => {
  it('refuses single-engine incompatible combinations with an actionable prompt to add a GigaSMART engine', () => {
    const resultHC3 = areActionsCompatible(
      'Application Metadata Intelligence',
      'Masking',
      1,
      'GigaVUE-HC3',
      [],
    );
    expect(resultHC3.compatible).toBe(false);
    expect(resultHC3.reason).toContain('SMT-HC3-C08 or SMT-HC3-C05');

    const resultHC1 = areActionsCompatible(
      'GTP Flow Filtering',
      'Header Stripping',
      1,
      'GigaVUE-HC1',
      [],
    );
    expect(resultHC1.compatible).toBe(false);
    expect(resultHC1.reason).toContain('SMT-HC1-S');
  });

  it('allows previously incompatible operations to run when 2 or more GigaSMART engines are installed', () => {
    const result = areActionsCompatible(
      'GTP Flow Filtering',
      'Header Stripping',
      2,
      'GigaVUE-HC3',
      ['SMT-HC3-C08', 'SMT-HC3-C05'],
    );
    expect(result.compatible).toBe(true);
    expect(result.multiEngine).toBe(true);

    // Exact user scenario: De-Dup and GTP Flow Sampling on HC3 with 2x SMT-HC3-C0800 cards
    const resultUserCase = areActionsCompatible(
      'Deduplication',
      'GTP Flow Sampling',
      undefined,
      'GigaVUE-HC3',
      ['SMT-HC3-C0800', 'SMT-HC3-C0800'],
    );
    expect(resultUserCase.compatible).toBe(true);
    expect(resultUserCase.multiEngine).toBe(true);
  });

  it('correctly validates supported combinations within a single GSOP according to the official matrix', () => {
    expect(areActionsCompatible('Masking', 'De-Dup').compatible).toBe(true);
    expect(areActionsCompatible('De-Dup', 'Packet Slicing').compatible).toBe(true);
    expect(areActionsCompatible('Load Balancing (Stateful)', 'GTP Flow Filtering').compatible).toBe(true);
    expect(areActionsCompatible('IP FlowVUE', 'Advanced Flow Slicing').compatible).toBe(true);
  });
});

