import { describe, it, expect } from 'vitest';
import { resolveOpticSku, getSkus } from './skuUtils';
import { SUPPORTED_TAP_OPTICS } from '../../constants/nodeTypes';

describe('resolveOpticSku', () => {
  it('resolves every SUPPORTED_TAP_OPTICS picker value to a SKU that actually exists', () => {
    const skus = getSkus();
    for (const { value } of SUPPORTED_TAP_OPTICS) {
      const resolved = resolveOpticSku(value, '');
      expect(skus[resolved], `${value} resolved to "${resolved}", which is not a real SKU`).toBeDefined();
    }
  });

  it('never returns the raw picker value verbatim (the reported bug)', () => {
    expect(resolveOpticSku('10G-SFP-SR', '')).toBe('SFP-532');
    expect(resolveOpticSku('10G-SFP-LR', '')).toBe('SFP-533');
  });

  it('resolves the legacy descriptive-phrase strings used by ToolNodePanel to real SKUs', () => {
    const skus = getSkus();
    const legacyPhrases = [
      '1G Copper',
      '1G Multimode SX',
      '1G Singlemode LX',
      '10G Multimode SR',
      '10G Singlemode LR',
      '25G Multimode SR',
      '25G Singlemode LR',
      '40G Multimode SR4',
      '40G Singlemode LR4',
      '100G Multimode SR4',
      '100G Singlemode LR4',
    ];
    for (const phrase of legacyPhrases) {
      const resolved = resolveOpticSku(phrase, '');
      expect(skus[resolved], `"${phrase}" resolved to "${resolved}", which is not a real SKU`).toBeDefined();
    }
  });
});
