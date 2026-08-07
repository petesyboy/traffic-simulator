/**
 * skuOverrides.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lets an SE refresh SKU descriptions and EOS/EOL/replacement metadata straight
 * from an uploaded worldwide price list (see priceListParser.ts + SkuUpdateModal),
 * without running scripts/parse_skus.py and rebuilding the app.
 *
 * Overrides are a full snapshot (base catalogue + everything uploaded so far),
 * persisted to localStorage so they survive a reload. They're per-browser, not
 * part of a saved project - deliberately excluded from the save-slot/JSON export
 * payload in settingsSlice.ts.
 */
import baseSkus from '../constants/skus.json';
import baseMetadata from '../constants/skus_metadata.json';

export interface SkuMetadataEntry {
  eos?: string;
  eol?: string;
  replacement?: string;
}

export interface PriceListRow {
  sku: string;
  description: string;
  eos?: string;
  eol?: string;
  replacement?: string;
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
  sourceFileName: string;
  updatedAt: string;
}

const STORAGE_KEY = 'fm-simulator-sku-overrides';

function loadStoredOverrides(): SkuOverrideData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.skus || !parsed.metadata) return null;
    return parsed as SkuOverrideData;
  } catch {
    return null;
  }
}

let overrides: SkuOverrideData | null = loadStoredOverrides();

export function getSkuOverrideInfo(): { sourceFileName: string; updatedAt: string; count: number } | null {
  if (!overrides) return null;
  return {
    sourceFileName: overrides.sourceFileName,
    updatedAt: overrides.updatedAt,
    count: Object.keys(overrides.skus).length,
  };
}

export function getMergedSkus(): Record<string, string> {
  const base = baseSkus as Record<string, string>;
  return overrides ? { ...base, ...overrides.skus } : base;
}

export function getMergedSkusMetadata(): Record<string, SkuMetadataEntry> {
  const base = baseMetadata as Record<string, SkuMetadataEntry>;
  return overrides ? { ...base, ...overrides.metadata } : base;
}

export function clearSkuOverrides(): void {
  overrides = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable - the in-memory override is already cleared above.
  }
}

/** Mirrors scripts/parse_skus.py's merge logic: load what's there, apply new rows on top. */
export function applyPriceListRows(rows: PriceListRow[], sourceFileName: string): ApplyPriceListResult {
  const nextSkus = { ...getMergedSkus() };
  const nextMetadata = { ...getMergedSkusMetadata() };

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
    if (row.eos && !finalDesc.toLowerCase().includes(row.eos.toLowerCase())) {
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
  }

  overrides = {
    skus: nextSkus,
    metadata: nextMetadata,
    sourceFileName,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Quota exceeded or storage unavailable - overrides still apply for this session.
  }

  return { added, updated, unchanged, skipped, total: rows.length };
}
