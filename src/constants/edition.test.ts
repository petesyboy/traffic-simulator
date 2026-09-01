import { describe, it, expect } from 'vitest';
import { APP_EDITION, isInternalEdition, isPartnerEdition } from './edition';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

describe('Edition constants & helpers', () => {
  it('defaults to internal edition or matches current APP_EDITION', () => {
    expect(['internal', 'partner']).toContain(APP_EDITION);
    if (APP_EDITION === 'internal') {
      expect(isInternalEdition()).toBe(true);
      expect(isPartnerEdition()).toBe(false);
    } else {
      expect(isPartnerEdition()).toBe(true);
      expect(isInternalEdition()).toBe(false);
    }
  });

  it('sanitises all SKU list prices and monetary fields when parsed in partner mode', () => {
    const rootDir = path.resolve(__dirname, '../..');
    const skuJsonPath = path.join(rootDir, 'src', 'data', 'skus.json');

    // Generate in partner mode
    execSync('node scripts/parse-skus.js --edition=partner', { cwd: rootDir });
    const partnerSkus = JSON.parse(fs.readFileSync(skuJsonPath, 'utf-8'));

    expect(partnerSkus.length).toBeGreaterThan(500);
    // Verify that NO SKU item in partner mode contains list prices or monthly prices
    for (const item of partnerSkus) {
      expect(item.listPrice).toBeUndefined();
      expect(item.listPriceMonthly).toBeUndefined();
      expect(item.unitCost).toBeUndefined();
      expect(item.price).toBeUndefined();
      expect(item.maintenancePrice).toBeUndefined();
      expect(item.termPrices).toBeUndefined();
    }

    // Restore internal dataset
    execSync('node scripts/parse-skus.js --edition=internal', { cwd: rootDir });
    const internalSkus = JSON.parse(fs.readFileSync(skuJsonPath, 'utf-8'));
    const pricedItems = internalSkus.filter((item: any) => item.listPrice !== undefined || item.listPriceMonthly !== undefined);
    expect(pricedItems.length).toBeGreaterThan(100);
  });
});
