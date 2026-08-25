/**
 * skuOverrides.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lets an SE refresh SKU descriptions and EOS/EOL/replacement metadata straight
 * from an uploaded worldwide price list (see priceListParser.ts + SkuUpdateModal),
 * without running scripts/parse-skus.js and rebuilding the app.
 *
 * Overrides are layered on top of the built-in single source of truth (src/data/skus.json),
 * persisted to localStorage so they survive a reload.
 *
 * Automatically maintains a backup of the previous active override set, allowing
 * the user to easily revert to the prior state or restore the original built-in catalog.
 */

import baseSkuCatalog from '../data/skus.json';
import { type SKUItem } from '../types/sku';

export interface SkuMetadataEntry {
  eos?: string;
  eol?: string;
  replacement?: string;
  unavailable?: boolean;
}

export interface PriceListRow {
  sku: string;
  description: string;
  eos?: string;
  eol?: string;
  replacement?: string;
  listPrice?: number;
  listPriceMonthly?: number;
}

export interface SkuPriceEntry {
  listPrice?: number;
  listPriceMonthly?: number;
}

export interface ApplyPriceListResult {
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  total: number;
}

interface SkuOverrideData {
  skus: Record<string, string>;
  metadata: Record<string, SkuMetadataEntry>;
  prices?: Record<string, SkuPriceEntry>;
  sourceFileName: string;
  updatedAt: string;
}

const STORAGE_KEY = 'fm-simulator-sku-overrides';
const STORAGE_KEY_BACKUP = 'fm-simulator-sku-overrides-backup';

// Generate base flat mappings from the single source of truth (src/data/skus.json)
const baseSkus: Record<string, string> = {};
const baseMetadata: Record<string, SkuMetadataEntry> = {};
const basePrices: Record<string, SkuPriceEntry> = {};

(baseSkuCatalog as SKUItem[]).forEach((item) => {
  const key = item.partNumber.toUpperCase();
  baseSkus[key] = item.description;
  if (item.listPrice !== undefined || item.listPriceMonthly !== undefined) {
    basePrices[key] = {
      listPrice: item.listPrice,
      listPriceMonthly: item.listPriceMonthly,
    };
  }
  if (item.endOfSale || item.endOfLife || item.eosReplacementSku) {
    baseMetadata[key] = {
      eos: item.endOfSale || '',
      eol: item.endOfLife || '',
      replacement: item.eosReplacementSku ? item.eosReplacementSku.toUpperCase() : '',
    };
  }
});

function loadStoredOverrides(key: string): SkuOverrideData | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.skus || !parsed.metadata) return null;
    return parsed as SkuOverrideData;
  } catch {
    return null;
  }
}

let overrides: SkuOverrideData | null = loadStoredOverrides(STORAGE_KEY);
let backupOverrides: SkuOverrideData | null = loadStoredOverrides(STORAGE_KEY_BACKUP);

export function getSkuOverrideInfo(): { sourceFileName: string; updatedAt: string; count: number } | null {
  if (!overrides) return null;
  return {
    sourceFileName: overrides.sourceFileName,
    updatedAt: overrides.updatedAt,
    count: Object.keys(overrides.skus).length,
  };
}

export function getBackupOverrideInfo(): { sourceFileName: string; updatedAt: string; count: number } | null {
  if (!backupOverrides) return null;
  return {
    sourceFileName: backupOverrides.sourceFileName,
    updatedAt: backupOverrides.updatedAt,
    count: Object.keys(backupOverrides.skus).length,
  };
}

export function getMergedSkus(): Record<string, string> {
  return overrides ? { ...baseSkus, ...overrides.skus } : baseSkus;
}

export function getMergedSkusMetadata(): Record<string, SkuMetadataEntry> {
  return overrides ? { ...baseMetadata, ...overrides.metadata } : baseMetadata;
}

export function getMergedSkuPrices(): Record<string, SkuPriceEntry> {
  return overrides?.prices ? { ...basePrices, ...overrides.prices } : basePrices;
}

/** Clears all overrides and restores the built-in single source of truth. */
export function clearSkuOverrides(): void {
  if (overrides) {
    backupOverrides = overrides;
    try {
      localStorage.setItem(STORAGE_KEY_BACKUP, JSON.stringify(backupOverrides));
    } catch {
      // Ignore quota error
    }
  }
  overrides = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable
  }
}

/** Reverts to the previous backup override set. */
export function revertToPreviousOverrides(): boolean {
  if (!backupOverrides) return false;
  const temp = overrides;
  overrides = backupOverrides;
  backupOverrides = temp;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    if (backupOverrides) {
      localStorage.setItem(STORAGE_KEY_BACKUP, JSON.stringify(backupOverrides));
    } else {
      localStorage.removeItem(STORAGE_KEY_BACKUP);
    }
  } catch {
    // Storage unavailable
  }
  return true;
}

/** Applies newly uploaded price list rows on top of existing SKUs and creates a backup. */
export function applyPriceListRows(rows: PriceListRow[], sourceFileName: string): ApplyPriceListResult {
  if (overrides) {
    backupOverrides = overrides;
    try {
      localStorage.setItem(STORAGE_KEY_BACKUP, JSON.stringify(backupOverrides));
    } catch {
      // Ignore quota error
    }
  }

  const nextSkus = { ...getMergedSkus() };
  const nextMetadata = { ...getMergedSkusMetadata() };
  const nextPrices = { ...getMergedSkuPrices() };

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const row of rows) {
    const sku = row.sku.trim().toUpperCase();
    const desc = row.description.trim();
    if (!sku || !desc) {
      skipped++;
      continue;
    }

    let finalDesc = desc;
    if (row.eos && !/\(EOS\b/i.test(finalDesc)) {
      finalDesc += ` (EOS ${row.eos})`;
    }

    if (nextSkus[sku] === undefined) {
      nextSkus[sku] = finalDesc;
      added++;
    } else if (nextSkus[sku] !== finalDesc) {
      nextSkus[sku] = finalDesc;
      updated++;
    } else {
      unchanged++;
    }

    if (row.eos || row.eol || row.replacement) {
      nextMetadata[sku] = {
        eos: row.eos || '',
        eol: row.eol || '',
        replacement: row.replacement ? row.replacement.toUpperCase() : '',
      };
    }

    if (row.listPrice !== undefined || row.listPriceMonthly !== undefined) {
      nextPrices[sku] = {
        listPrice: row.listPrice,
        listPriceMonthly: row.listPriceMonthly,
      };
    }
  }

  const uploadedSkuSet = new Set(rows.map((r) => r.sku.trim().toUpperCase()).filter(Boolean));

  // If a full price list was uploaded, retain historical SKUs and mark unmentioned active ones as Discontinued
  if (uploadedSkuSet.size > 20) {
    for (const [sku] of Object.entries(nextSkus)) {
      if (!uploadedSkuSet.has(sku)) {
        if (!nextMetadata[sku]) {
          nextMetadata[sku] = {
            eos: 'Discontinued (Removed from Price List)',
            unavailable: true,
          };
        } else if (!nextMetadata[sku].eos && !nextMetadata[sku].eol) {
          nextMetadata[sku].eos = 'Discontinued (Removed from Price List)';
          nextMetadata[sku].unavailable = true;
        }
      }
    }
  }

  overrides = {
    skus: nextSkus,
    metadata: nextMetadata,
    prices: nextPrices,
    sourceFileName,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Storage unavailable
  }

  return { added, updated, unchanged, skipped, total: rows.length };
}
