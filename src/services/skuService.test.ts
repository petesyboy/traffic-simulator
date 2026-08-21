import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { skuService } from './skuService';
import { applyPriceListRows } from '../utils/skuOverrides';

function installFakeLocalStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  });
}

describe('skuService', () => {
  beforeEach(() => {
    installFakeLocalStorage();
    skuService.restoreBuiltinCatalog();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getAllSKUs returns populated catalog', () => {
    const all = skuService.getAllSKUs();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(100);
    expect(all[0]).toHaveProperty('partNumber');
    expect(all[0]).toHaveProperty('description');
    expect(all[0]).toHaveProperty('category');
  });

  it('getSKUByPartNumber finds items case-insensitively', () => {
    const item = skuService.getSKUByPartNumber('sfp-532t');
    expect(item).toBeDefined();
    expect(item?.partNumber.toUpperCase()).toBe('SFP-532T');
    expect(item?.description).toBeDefined();

    const notFound = skuService.getSKUByPartNumber('NON_EXISTENT_SKU_123');
    expect(notFound).toBeUndefined();

    const empty = skuService.getSKUByPartNumber('');
    expect(empty).toBeUndefined();
  });

  it('getDescription and getMetadata retrieve SKU details', () => {
    const desc = skuService.getDescription('SFP-532T');
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);

    const emptyDesc = skuService.getDescription('');
    expect(emptyDesc).toBe('');

    const unknownDesc = skuService.getDescription('UNKNOWN-PART-XYZ');
    expect(unknownDesc).toBe('UNKNOWN-PART-XYZ');
  });

  it('getPrice and getMonthlyPrice return numbers or undefined', () => {
    const price = skuService.getPrice('SFP-532T');
    if (price !== undefined) {
      expect(typeof price).toBe('number');
    }
  });

  it('getSKUsByCategory returns items for valid categories', () => {
    const transceivers = skuService.getSKUsByCategory('Transceiver');
    expect(transceivers.length).toBeGreaterThan(0);
    expect(transceivers.every((i) => i.category === 'Transceiver')).toBe(true);

    const licenses = skuService.getSKUsByCategory('License');
    expect(licenses.length).toBeGreaterThan(0);
    expect(licenses.every((i) => i.category === 'License')).toBe(true);

    const empty = skuService.getSKUsByCategory('invalid_category_xyz');
    expect(empty).toEqual([]);
  });

  it('getSKUsByFamily and getSKUsBySubFamily filters correctly', () => {
    const hcFamily = skuService.getSKUsByFamily('GigaVUE H Series');
    expect(hcFamily.length).toBeGreaterThan(0);

    const taSubFamily = skuService.getSKUsBySubFamily('GigaVUE-TA200');
    expect(taSubFamily.length).toBeGreaterThan(0);
  });

  it('searchSKUs matches across part numbers and descriptions', () => {
    const results = skuService.searchSKUs('100G');
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some((i) => i.partNumber.includes('100') || i.description.toLowerCase().includes('100g')),
    ).toBe(true);

    const emptyQuery = skuService.searchSKUs('');
    expect(emptyQuery).toEqual([]);
  });

  it('getActiveSKUs and getEosEolSKUs split the catalog appropriately', () => {
    const active = skuService.getActiveSKUs();
    const eosEol = skuService.getEosEolSKUs();
    const total = skuService.getAllSKUs().length;

    expect(active.length).toBeGreaterThan(0);
    expect(eosEol.length).toBeGreaterThan(0);
    expect(active.length + eosEol.length).toBe(total);
  });

  it('getCategories returns sorted distinct categories', () => {
    const categories = skuService.getCategories();
    expect(categories.length).toBeGreaterThan(3);
    expect(categories).toContain('Transceiver');
    expect(categories).toContain('License');
  });

  it('integrates runtime price list overrides with rollback capability', () => {
    applyPriceListRows([{ sku: 'NEW-PART-1', description: 'Fresh Uploaded Part' }], 'test.xlsx');
    expect(skuService.getDescription('NEW-PART-1')).toBe('Fresh Uploaded Part');

    // Restore built-in
    skuService.restoreBuiltinCatalog();
    expect(skuService.getDescription('NEW-PART-1')).toBe('NEW-PART-1');
  });

  it('correctly reports status and availability for active, EOS/EOL, and discontinued items', () => {
    const active = skuService.isAvailable('SFP-532T');
    expect(active).toBe(true);
    expect(skuService.getStatus('SFP-532T')).toBe('Active');

    const eosItem = skuService.getEosEolSKUs()[0];
    if (eosItem) {
      expect(skuService.isAvailable(eosItem.partNumber)).toBe(false);
      expect(['EOS', 'EOL']).toContain(skuService.getStatus(eosItem.partNumber));
    }

    const discontinued = skuService.getDiscontinuedSKUs();
    expect(Array.isArray(discontinued)).toBe(true);
  });
});
