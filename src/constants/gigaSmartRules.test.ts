import { describe, it, expect } from 'vitest';
import { areActionsCompatible } from './gigaSmartRules';

describe('areActionsCompatible', () => {
  // Regression: per Gigamon's KB, GTPMAX and FlowVUE are separate feature
  // entitlements that can both be licensed on the same Gen3 GigaSMART card -
  // GTP flow sampling (0-100%) and GTP whitelisting specifically require
  // both to be enabled together. The matrix used to refuse this combination
  // outright.
  it.each([
    'GTP Flow Filtering',
    'GTP Whitelisting',
    'GTP Flow Sampling',
  ])('allows IP FlowVUE to combine with %s', (gtpAction) => {
    expect(areActionsCompatible('IP FlowVUE', gtpAction)).toEqual({ compatible: true });
    expect(areActionsCompatible(gtpAction, 'IP FlowVUE')).toEqual({ compatible: true });
  });

  it('still refuses genuinely incompatible combinations (e.g. AMI with Masking)', () => {
    const result = areActionsCompatible('Application Metadata Intelligence', 'Masking');
    expect(result.compatible).toBe(false);
  });
});
