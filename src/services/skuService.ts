/**
 * skuService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Data service layer providing decoupled, typed access to the SKU catalog.
 *
 * Exposes methods to retrieve, filter, query, and search SKUs across hardware
 * families, categories, transceivers, licenses, and accessories.
 */

import skuData from '../data/skus.json';
import { type SKUItem } from '../types/sku';

export const skuService = {
  /** Returns the full list of typed SKU items in the catalogue. */
  getAllSKUs(): SKUItem[] {
    return skuData as SKUItem[];
  },

  /** Finds an exact SKU by part number (case-insensitive). */
  getSKUByPartNumber(partNumber: string): SKUItem | undefined {
    if (!partNumber) return undefined;
    const target = partNumber.trim().toUpperCase();
    return (skuData as SKUItem[]).find((item) => item.partNumber.toUpperCase() === target);
  },

  /** Filters SKUs by category (e.g. 'Chassis', 'Module', 'Transceiver', 'License', 'TAP'). */
  getSKUsByCategory(category: string): SKUItem[] {
    if (!category) return [];
    const target = category.toLowerCase().trim();
    return (skuData as SKUItem[]).filter((item) => item.category.toLowerCase() === target);
  },

  /** Filters SKUs by product family (e.g. 'GigaVUE H Series', 'Taps and Aggregators', 'Accessories'). */
  getSKUsByFamily(family: string): SKUItem[] {
    if (!family) return [];
    const target = family.toLowerCase().trim();
    return (skuData as SKUItem[]).filter(
      (item) => item.productFamily && item.productFamily.toLowerCase().includes(target),
    );
  },

  /** Filters SKUs by product sub-family (e.g. 'GigaVUE-HC2', 'GigaVUE-TA200', 'GTAP-A'). */
  getSKUsBySubFamily(subFamily: string): SKUItem[] {
    if (!subFamily) return [];
    const target = subFamily.toLowerCase().trim();
    return (skuData as SKUItem[]).filter(
      (item) => item.productSubFamily && item.productSubFamily.toLowerCase().includes(target),
    );
  },

  /** Searches SKUs by query across part number, description, category, and product family. */
  searchSKUs(query: string): SKUItem[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return (skuData as SKUItem[]).filter(
      (item) =>
        item.partNumber.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.productFamily && item.productFamily.toLowerCase().includes(q)) ||
        (item.productSubFamily && item.productSubFamily.toLowerCase().includes(q)),
    );
  },

  /** Returns all active (non-EOS/EOL) SKUs. */
  getActiveSKUs(): SKUItem[] {
    return (skuData as SKUItem[]).filter((item) => !item.endOfSale && !item.endOfLife);
  },

  /** Returns all End-of-Sale or End-of-Life SKUs. */
  getEosEolSKUs(): SKUItem[] {
    return (skuData as SKUItem[]).filter((item) => Boolean(item.endOfSale || item.endOfLife));
  },

  /** Returns all distinct categories present in the catalog. */
  getCategories(): string[] {
    const categories = new Set<string>();
    (skuData as SKUItem[]).forEach((item) => {
      if (item.category) categories.add(item.category);
    });
    return Array.from(categories).sort();
  },
};

export default skuService;
