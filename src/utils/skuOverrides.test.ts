import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  applyPriceListRows,
  clearSkuOverrides,
  getMergedSkus,
  getMergedSkusMetadata,
  getSkuOverrideInfo,
} from './skuOverrides';
import baseSkus from '../constants/skus.json';

/** This sandbox's Node localStorage global is a non-functional stub (no getItem/
 *  setItem/removeItem), unlike a real browser - stub in a working in-memory one so
 *  the persistence-related assertions below actually exercise something. */
function installFakeLocalStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  });
}

describe('skuOverrides', () => {
  beforeEach(() => {
    installFakeLocalStorage();
    clearSkuOverrides();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the bundled catalogue untouched when nothing has been uploaded', () => {
    expect(getSkuOverrideInfo()).toBeNull();
    expect(getMergedSkus()).toEqual(baseSkus);
  });

  it('adds a brand new SKU and reports it as added', () => {
    const result = applyPriceListRows(
      [{ sku: 'ZZZ-999T', description: 'Made-up test transceiver' }],
      'price-list.xlsx',
    );
    expect(result).toEqual({ added: 1, updated: 0, unchanged: 0, skipped: 0, total: 1 });
    expect(getMergedSkus()['ZZZ-999T']).toBe('Made-up test transceiver');
  });

  it('reports an existing SKU whose description changed as updated', () => {
    const existingSku = Object.keys(baseSkus)[0];
    const result = applyPriceListRows(
      [{ sku: existingSku, description: 'A brand new description' }],
      'price-list.xlsx',
    );
    expect(result.updated).toBe(1);
    expect(getMergedSkus()[existingSku]).toBe('A brand new description');
  });

  it('reports an existing SKU with an identical description as unchanged', () => {
    const existingSku = Object.keys(baseSkus)[0];
    const existingDesc = (baseSkus as Record<string, string>)[existingSku];
    const result = applyPriceListRows([{ sku: existingSku, description: existingDesc }], 'price-list.xlsx');
    expect(result.unchanged).toBe(1);
  });

  it('skips rows missing a SKU or description', () => {
    const result = applyPriceListRows(
      [
        { sku: '', description: 'No SKU here' },
        { sku: 'ABC-123', description: '' },
        { sku: 'GOOD-1', description: 'Fine' },
      ],
      'price-list.xlsx',
    );
    expect(result).toEqual({ added: 1, updated: 0, unchanged: 0, skipped: 2, total: 3 });
  });

  it('uppercases SKUs and suffixes the description with an EOS date', () => {
    applyPriceListRows([{ sku: 'lower-case-1', description: 'Widget', eos: '2027-01-01' }], 'price-list.xlsx');
    expect(getMergedSkus()['LOWER-CASE-1']).toBe('Widget (EOS 2027-01-01)');
  });

  it('does not double-tag a description that already ends with a human-formatted EOS note in a different format than the EOS column', () => {
    // Real-world case: some legacy SKUs' own Detailed Description text already
    // says "(EOS Dec 31, 2022)" while the structured EOS column holds the same
    // date as an ISO string ("2022-12-31") - a naive substring match misses
    // this and appends a redundant second tag.
    applyPriceListRows(
      [{ sku: 'LEGACY-1', description: 'Old widget (EOS Dec 31, 2022)', eos: '2022-12-31' }],
      'price-list.xlsx',
    );
    expect(getMergedSkus()['LEGACY-1']).toBe('Old widget (EOS Dec 31, 2022)');
  });

  it('records EOS/EOL/replacement metadata only when at least one is present', () => {
    applyPriceListRows(
      [
        { sku: 'META-1', description: 'Has metadata', eol: '2026-01-01', replacement: 'meta-2' },
        { sku: 'META-3', description: 'No metadata' },
      ],
      'price-list.xlsx',
    );
    expect(getMergedSkusMetadata()['META-1']).toEqual({ eos: '', eol: '2026-01-01', replacement: 'META-2' });
    expect(getMergedSkusMetadata()['META-3']).toBeUndefined();
  });

  it('accumulates across two uploads instead of discarding the first', () => {
    applyPriceListRows([{ sku: 'FIRST-1', description: 'First upload' }], 'a.xlsx');
    applyPriceListRows([{ sku: 'SECOND-1', description: 'Second upload' }], 'b.xlsx');
    const merged = getMergedSkus();
    expect(merged['FIRST-1']).toBe('First upload');
    expect(merged['SECOND-1']).toBe('Second upload');
  });

  it('persists to localStorage and survives being re-read', () => {
    applyPriceListRows([{ sku: 'PERSIST-1', description: 'Persisted SKU' }], 'price-list.xlsx');
    const raw = localStorage.getItem('fm-simulator-sku-overrides');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).skus['PERSIST-1']).toBe('Persisted SKU');
  });

  it('exposes source file name and count via getSkuOverrideInfo', () => {
    applyPriceListRows(
      [
        { sku: 'INFO-1', description: 'A' },
        { sku: 'INFO-2', description: 'B' },
      ],
      'gigamon-worldwide-price-list.xlsx',
    );
    const info = getSkuOverrideInfo();
    expect(info?.sourceFileName).toBe('gigamon-worldwide-price-list.xlsx');
    expect(info?.count).toBeGreaterThanOrEqual(2);
  });

  it('reverts to the bundled catalogue when cleared', () => {
    applyPriceListRows([{ sku: 'TEMP-1', description: 'Temporary' }], 'price-list.xlsx');
    expect(getSkuOverrideInfo()).not.toBeNull();

    clearSkuOverrides();

    expect(getSkuOverrideInfo()).toBeNull();
    expect(getMergedSkus()).toEqual(baseSkus);
    expect(localStorage.getItem('fm-simulator-sku-overrides')).toBeNull();
  });
});
