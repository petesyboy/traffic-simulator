import { describe, it, expect } from 'vitest';
import { resolveNodeSkus } from './skuResolver';

describe('skuResolver - resolveNodeSkus', () => {
  it('should resolve chassis SKUs for HC series in Perpetual and HTL modes', () => {
    // HC1 AC
    expect(resolveNodeSkus({ model: 'GigaVUE-HC1', powerSupply: 'AC' }, 'Perpetual')).toEqual({
      hwSku: 'GVS-HC101',
      swSku: undefined,
      advSku: undefined,
    });
    expect(resolveNodeSkus({ model: 'GigaVUE-HC1', powerSupply: 'AC' }, 'HTL')).toEqual({
      hwSku: 'GVS-HC101-HW',
      swSku: 'GVS-HC100-SW-TM',
      advSku: undefined,
    });

    // HC1-Plus DC
    expect(resolveNodeSkus({ model: 'GigaVUE-HC1-Plus', powerSupply: 'DC' }, 'Perpetual')).toEqual({
      hwSku: 'GVS-HC1P2',
      swSku: undefined,
      advSku: undefined,
    });
    expect(resolveNodeSkus({ model: 'GigaVUE-HC1-Plus', powerSupply: 'DC' }, 'HTL')).toEqual({
      hwSku: 'GVS-HC1P2-HW',
      swSku: 'GVS-HC1P-SW-TM',
      advSku: undefined,
    });

    // HC3 AC
    expect(resolveNodeSkus({ model: 'GigaVUE-HC3', powerSupply: 'AC' }, 'Perpetual')).toEqual({
      hwSku: 'GVS-HC3A1',
      swSku: undefined,
      advSku: undefined,
    });
  });

  it('should resolve chassis and software license SKUs for TA series', () => {
    // TA25E AC Full capacity
    expect(resolveNodeSkus({ model: 'GigaVUE-TA25E', powerSupply: 'AC', portCapacity: 'Full' }, 'Perpetual')).toEqual({
      hwSku: 'GVS-TAX21E',
      swSku: undefined,
      advSku: undefined,
    });

    // TA25E AC Half capacity in Perpetual
    expect(resolveNodeSkus({ model: 'GigaVUE-TA25E', powerSupply: 'AC', portCapacity: 'Half' }, 'Perpetual')).toEqual({
      hwSku: 'GVS-TAX21EA',
      swSku: undefined,
      advSku: undefined,
    });

    // TA25E DC Quarter capacity in HTL (automatically triggers advanced license)
    expect(resolveNodeSkus({ model: 'GigaVUE-TA25E', powerSupply: 'DC', portCapacity: 'Quarter' }, 'HTL')).toEqual({
      hwSku: 'GVS-TAX22E-HW',
      swSku: 'GVS-TAX20EB-SW-TM',
      advSku: 'CLS-TAX20E-SW-TM',
    });
  });

  it('should resolve advanced feature license SKUs for TA series when specified', () => {
    expect(resolveNodeSkus({ model: 'GigaVUE-TA200', powerSupply: 'AC', advancedFeatures: true }, 'Perpetual')).toEqual({
      hwSku: 'GVS-TAC21',
      swSku: undefined,
      advSku: 'CLS-TAC20',
    });

    expect(resolveNodeSkus({ model: 'GigaVUE-TA200', powerSupply: 'DC', advancedFeatures: true }, 'HTL')).toEqual({
      hwSku: 'GVS-TAC22-HW',
      swSku: 'GVS-TAC20-SW-TM',
      advSku: 'CLS-TAC20-SW-TM',
    });
  });

  it('should resolve TAPs properly and return early without SW/Advanced licenses', () => {
    expect(resolveNodeSkus({ model: 'G-TAP A-TX', tapPower: 'Individual Power Brick' }, 'Perpetual')).toEqual({
      hwSku: 'GTP-ATX01-UN',
    });

    expect(resolveNodeSkus({ model: 'G-TAP A-SF', tapPower: 'PST-GTA02 (DC Power Tray)' }, 'HTL')).toEqual({
      hwSku: 'GTP-ASF02',
    });
  });
});
