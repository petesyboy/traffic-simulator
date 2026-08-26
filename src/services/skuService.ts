/**
 * skuService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Data service layer providing decoupled, typed access to the SKU catalog.
 *
 * Serves as the Single Source of Truth across the application for:
 * - Part number descriptions and pricing
 * - Lifecycle status (EOS, EOL, and replacement part numbers)
 * - Transceiver and hardware categorisation
 * - Active runtime overrides with rollback / backup support
 */

import baseSkuData from '../data/skus.json';
import { type SKUItem } from '../types/sku';
import {
  getMergedSkus,
  getMergedSkusMetadata,
  getMergedSkuPrices,
  getSkuOverrideInfo,
  getBackupOverrideInfo,
  clearSkuOverrides,
  revertToPreviousOverrides,
  type SkuMetadataEntry,
} from '../utils/skuOverrides';

export const skuService = {
  /** Returns the full list of typed SKU items in the catalogue, augmented with active overrides. */
  getAllSKUs(): SKUItem[] {
    const mergedDescriptions = getMergedSkus();
    const mergedMeta = getMergedSkusMetadata();
    const mergedPrices = getMergedSkuPrices();
    const map = new Map<string, SKUItem>();

    // 1. Load base items
    (baseSkuData as SKUItem[]).forEach((item) => {
      const key = item.partNumber.toUpperCase();
      map.set(key, { ...item });
    });

    // 2. Overlay any updated descriptions, metadata, or prices
    for (const [key, desc] of Object.entries(mergedDescriptions)) {
      const existing = map.get(key);
      const meta = mergedMeta[key];
      const price = mergedPrices[key];
      if (existing) {
        existing.description = desc;
        if (meta) {
          if (meta.eos) existing.endOfSale = meta.eos;
          if (meta.eol) existing.endOfLife = meta.eol;
          if (meta.replacement) existing.eosReplacementSku = meta.replacement;
        }
        if (price) {
          if (price.listPrice !== undefined) existing.listPrice = price.listPrice;
          if (price.listPriceMonthly !== undefined) existing.listPriceMonthly = price.listPriceMonthly;
        }
      } else {
        map.set(key, {
          partNumber: key,
          description: desc,
          category: 'Other',
          endOfSale: meta?.eos,
          endOfLife: meta?.eol,
          eosReplacementSku: meta?.replacement,
          listPrice: price?.listPrice,
          listPriceMonthly: price?.listPriceMonthly,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.partNumber.localeCompare(b.partNumber));
  },

  /** Finds an exact SKU by part number (case-insensitive with normalized variant fallback). */
  getSKUByPartNumber(partNumber: string): SKUItem | undefined {
    if (!partNumber) return undefined;
    let target = partNumber.trim().toUpperCase();
    let desc = getMergedSkus()[target];
    let base = (baseSkuData as SKUItem[]).find((item) => item.partNumber.toUpperCase() === target);

    // Fallback normalization for common typo variants (e.g. -SWTM <-> -SW-TM, -SW <-> -SW-TM)
    if (!desc && !base) {
      if (target.endsWith('-SWTM')) {
        const alt = target.replace(/-SWTM$/, '-SW-TM');
        if (getMergedSkus()[alt] || (baseSkuData as SKUItem[]).some((i) => i.partNumber.toUpperCase() === alt)) {
          target = alt;
          desc = getMergedSkus()[target];
          base = (baseSkuData as SKUItem[]).find((item) => item.partNumber.toUpperCase() === target);
        }
      } else if (target.endsWith('-SW-TM')) {
        const alt = target.replace(/-SW-TM$/, '-SWTM');
        if (getMergedSkus()[alt] || (baseSkuData as SKUItem[]).some((i) => i.partNumber.toUpperCase() === alt)) {
          target = alt;
          desc = getMergedSkus()[target];
          base = (baseSkuData as SKUItem[]).find((item) => item.partNumber.toUpperCase() === target);
        }
      } else if (target.endsWith('-SW')) {
        const alt = target.replace(/-SW$/, '-SW-TM');
        if (getMergedSkus()[alt] || (baseSkuData as SKUItem[]).some((i) => i.partNumber.toUpperCase() === alt)) {
          target = alt;
          desc = getMergedSkus()[target];
          base = (baseSkuData as SKUItem[]).find((item) => item.partNumber.toUpperCase() === target);
        }
      }
    }

    const meta = getMergedSkusMetadata()[target];
    const price = getMergedSkuPrices()[target];

    if (!desc && !base) return undefined;

    const isUnavailable = Boolean(meta?.unavailable || meta?.eos || meta?.eol || base?.isUnavailable || base?.endOfSale || base?.endOfLife);
    const status: 'Active' | 'EOS' | 'EOL' | 'Discontinued' | 'Unavailable' =
      (meta?.eol || base?.endOfLife)
        ? 'EOL'
        : (meta?.eos || base?.endOfSale)
          ? 'EOS'
          : (meta?.unavailable || base?.isUnavailable)
            ? 'Discontinued'
            : 'Active';

    return {
      partNumber: target,
      description: desc || base?.description || target,
      category: base?.category || 'Other',
      status,
      isUnavailable,
      productFamily: base?.productFamily,
      productSubFamily: base?.productSubFamily,
      countryOfOrigin: base?.countryOfOrigin,
      endOfSale: meta?.eos || base?.endOfSale,
      endOfLife: meta?.eol || base?.endOfLife,
      eosReplacementSku: meta?.replacement || base?.eosReplacementSku,
      supportAvailable: isUnavailable ? false : (base?.supportAvailable ?? true),
      listPrice: price?.listPrice !== undefined ? price.listPrice : base?.listPrice,
      listPriceMonthly: price?.listPriceMonthly !== undefined ? price.listPriceMonthly : base?.listPriceMonthly,
      portDensity: base?.portDensity,
      speedsSupported: base?.speedsSupported,
      formFactor: base?.formFactor,
      isTaaCompliant: base?.isTaaCompliant,
    };
  },

  /** Retrieves the display description for a given SKU. */
  getDescription(partNumber: string): string {
    if (!partNumber) return '';
    const target = partNumber.trim().toUpperCase();
    return getMergedSkus()[target] || target;
  },

  /** Retrieves the lifecycle metadata (EOS, EOL, replacement, unavailable) for a SKU. */
  getMetadata(partNumber: string): SkuMetadataEntry | undefined {
    if (!partNumber) return undefined;
    const target = partNumber.trim().toUpperCase();
    return getMergedSkusMetadata()[target];
  },

  /** Checks whether a SKU is active and available for quotation. */
  isAvailable(partNumber: string): boolean {
    const item = this.getSKUByPartNumber(partNumber);
    if (!item) return false;
    return !item.isUnavailable && item.status === 'Active';
  },

  /** Returns the current availability lifecycle status for a SKU. */
  getStatus(partNumber: string): 'Active' | 'EOS' | 'EOL' | 'Discontinued' | 'Unavailable' {
    const item = this.getSKUByPartNumber(partNumber);
    return item?.status || 'Unavailable';
  },

  /** Retrieves the list price for a SKU if known. */
  getPrice(partNumber: string): number | undefined {
    const item = this.getSKUByPartNumber(partNumber);
    return item?.listPrice;
  },

  /** Retrieves the monthly list price for a SKU if known. */
  getMonthlyPrice(partNumber: string): number | undefined {
    const item = this.getSKUByPartNumber(partNumber);
    return item?.listPriceMonthly;
  },

  /** Filters SKUs by category (e.g. 'Chassis', 'Module', 'Transceiver', 'License', 'TAP'). */
  getSKUsByCategory(category: string): SKUItem[] {
    if (!category) return [];
    const target = category.toLowerCase().trim();
    return this.getAllSKUs().filter((item) => item.category.toLowerCase() === target);
  },

  /** Filters SKUs by product family (e.g. 'GigaVUE H Series', 'Taps and Aggregators', 'Accessories'). */
  getSKUsByFamily(family: string): SKUItem[] {
    if (!family) return [];
    const target = family.toLowerCase().trim();
    return this.getAllSKUs().filter(
      (item) => item.productFamily && item.productFamily.toLowerCase().includes(target),
    );
  },

  /** Filters SKUs by product sub-family (e.g. 'GigaVUE-HC2', 'GigaVUE-TA200', 'GTAP-A'). */
  getSKUsBySubFamily(subFamily: string): SKUItem[] {
    if (!subFamily) return [];
    const target = subFamily.toLowerCase().trim();
    return this.getAllSKUs().filter(
      (item) => item.productSubFamily && item.productSubFamily.toLowerCase().includes(target),
    );
  },

  /** Searches SKUs by query across part number, description, category, and product family. */
  searchSKUs(query: string): SKUItem[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return this.getAllSKUs().filter(
      (item) =>
        item.partNumber.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.productFamily && item.productFamily.toLowerCase().includes(q)) ||
        (item.productSubFamily && item.productSubFamily.toLowerCase().includes(q)),
    );
  },

  /** Returns all active, currently orderable SKUs. */
  getActiveSKUs(): SKUItem[] {
    return this.getAllSKUs().filter((item) => !item.endOfSale && !item.endOfLife && !item.isUnavailable);
  },

  /** Returns all End-of-Sale or End-of-Life SKUs. */
  getEosEolSKUs(): SKUItem[] {
    return this.getAllSKUs().filter((item) => Boolean(item.endOfSale || item.endOfLife));
  },

  /** Returns all historical SKUs that are discontinued or removed from active price lists. */
  getDiscontinuedSKUs(): SKUItem[] {
    return this.getAllSKUs().filter((item) => Boolean(item.isUnavailable || item.status === 'Discontinued'));
  },

  /** Returns all distinct categories present in the catalog. */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.getAllSKUs().forEach((item) => {
      if (item.category) categories.add(item.category);
    });
    return Array.from(categories).sort();
  },

  /** Restores the built-in single source of truth price list. */
  restoreBuiltinCatalog(): void {
    clearSkuOverrides();
  },

  /** Reverts to the previous backup price list if one was superseded. */
  revertToPreviousCatalog(): boolean {
    return revertToPreviousOverrides();
  },

  /** Information about the active price list upload if one is loaded. */
  getActiveOverrideInfo() {
    return getSkuOverrideInfo();
  },

  /** Information about the backup price list if available. */
  getBackupOverrideInfo() {
    return getBackupOverrideInfo();
  },
};

export default skuService;
