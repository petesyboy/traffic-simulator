/**
 * scripts/parse-skus.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Build-time data ingestion pipeline.
 * Reads all reference CSV files in `references/`, normalizes field names,
 * enriches data with extracted hardware metadata, deduplicates entries,
 * and outputs the structured catalog to `src/data/skus.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REFERENCES_DIR = path.join(ROOT_DIR, 'references');
const OUTPUT_DIR = path.join(ROOT_DIR, 'src', 'data');
const OUTPUT_JSON_PATH = path.join(OUTPUT_DIR, 'skus.json');

const CSV_FILES = [
  'SKU-List.csv',
  'SKU-List-HC.csv',
  'SKU-List-TapsAndTAs.csv',
  'SKU-List-Accessoriess.csv',
];

/** Parses a standard CSV line handling quotes and escaped quotes. */
function parseCsvLine(text) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/** Parses numeric currency string (e.g. " $6,365.00 " -> 6365). */
function parsePrice(val) {
  if (!val) return undefined;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  if (!cleaned) return undefined;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

/** Determines category from SKU and metadata. */
function determineCategory(sku, desc, prodFamily, prodSubFamily) {
  const s = sku.toUpperCase();
  const sub = (prodSubFamily || '').toLowerCase();
  const fam = (prodFamily || '').toLowerCase();
  const d = (desc || '').toLowerCase();

  if (sub === 'transceivers' || s.startsWith('SFP-') || s.startsWith('QSF-') || s.startsWith('Q28-') || s.startsWith('QDD-') || s.startsWith('QSB-') || s.startsWith('OPT-')) {
    return 'Transceiver';
  }
  if (sub === 'cables' || s.startsWith('CBL-') || d.includes('cable') || d.includes('direct attach copper')) {
    return 'Cable';
  }
  if (sub === 'fans' || s.startsWith('FAN-') || d.includes('fan assembly') || d.includes('fan tray')) {
    return 'Fan';
  }
  if (sub === 'power' || s.startsWith('PWR-') || s.startsWith('BAT-') || d.includes('power supply') || d.includes('battery pack')) {
    return 'Power';
  }
  if (s.includes('-SW-') || s.includes('-TM') || s.startsWith('CLS-') || s.startsWith('GEM-') || d.includes('term license') || d.includes('perpetual license') || d.includes('software license') || d.includes('license for')) {
    return 'License';
  }
  if (s.startsWith('GTP-') || s.startsWith('TAP-') || s.startsWith('PNL-') || d.includes('tap module') || d.includes('always on tap') || sub.includes('gtap') || sub.includes('tap')) {
    return 'TAP';
  }
  if (s.startsWith('BPS-') || s.startsWith('PRT-') || (s.startsWith('SMT-') && !s.includes('-SW-')) || s.startsWith('CCV') || d.includes('module') || d.includes('combo module')) {
    return 'Module';
  }
  if (s.startsWith('GVS-') || sub.includes('gigavue-hc') || sub.includes('gigavue-ta') || d.includes('chassis') || d.includes('node')) {
    return 'Chassis';
  }
  if (fam.includes('accessories') || sub.includes('accessories') || s.startsWith('ACC-') || s.startsWith('RACK-')) {
    return 'Accessory';
  }
  if (d.includes('support') || s.includes('SPT-')) {
    return 'Support';
  }
  return 'Other';
}

/** Extracts supported speeds mentioned in description. */
function extractSpeeds(desc) {
  const speeds = [];
  const speedPatterns = [
    { pattern: /\b100\s*M(?:b|bps)?\b/i, speed: '100M' },
    { pattern: /\b1\s*G(?:b|bE|bps)?\b|\b1000\s*M(?:b|bps)?\b/i, speed: '1G' },
    { pattern: /\b10\s*G(?:b|bE|bps)?\b/i, speed: '10G' },
    { pattern: /\b25\s*G(?:b|bE|bps)?\b/i, speed: '25G' },
    { pattern: /\b40\s*G(?:b|bE|bps)?\b/i, speed: '40G' },
    { pattern: /\b100\s*G(?:b|bE|bps)?\b/i, speed: '100G' },
    { pattern: /\b400\s*G(?:b|bE|bps)?\b/i, speed: '400G' },
  ];
  for (const { pattern, speed } of speedPatterns) {
    if (pattern.test(desc) && !speeds.includes(speed)) {
      speeds.push(speed);
    }
  }
  return speeds.length > 0 ? speeds : undefined;
}

/** Extracts port density/count from description if present. */
function extractPortDensity(desc) {
  const match = desc.match(/(\d+)\s*(?:x\s*)?(?:10G|25G|40G|100G|400G|1G|SFP\+|SFP28|QSFP\+|QSFP28|QSFP-DD|cages|ports|pairs|links)/i);
  if (match) {
    const count = parseInt(match[1], 10);
    if (count > 0 && count <= 128) return count;
  }
  return undefined;
}

/** Extracts form factor from description or SKU. */
function extractFormFactor(sku, desc) {
  if (/QSFP-DD/i.test(desc) || /QDD-/i.test(sku)) return 'QSFP-DD';
  if (/QSFP28/i.test(desc) || /Q28-/i.test(sku)) return 'QSFP28';
  if (/QSFP\+/i.test(desc) || /QSF-/i.test(sku)) return 'QSFP+';
  if (/SFP28/i.test(desc)) return 'SFP28';
  if (/SFP\+/i.test(desc)) return 'SFP+';
  if (/SFP/i.test(desc)) return 'SFP';
  if (/14U/i.test(desc)) return '14U';
  if (/4U/i.test(desc)) return '4U';
  if (/2U/i.test(desc)) return '2U';
  if (/1U/i.test(desc)) return '1U';
  return undefined;
}

function parseCsvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[parse-skus] Warning: File not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Line 1 is often title/metadata (EFFECTIVE DATE...). Find the header row.
  let headerIndex = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].toLowerCase().includes('sku') && lines[i].toLowerCase().includes('description')) {
      headerIndex = i;
      break;
    }
  }

  const headers = parseCsvLine(lines[headerIndex]).map((h) => h.toLowerCase().trim());
  const skuIdx = headers.findIndex((h) => h === 'sku' || h.startsWith('sku'));
  const descIdx = headers.findIndex((h) => h.includes('description') || h === 'desc');
  const listPriceIdx = headers.findIndex((h) => h === 'list price');
  const listPriceMonthIdx = headers.findIndex((h) => h.includes('price/month') || h.includes('monthly'));
  const prodFamIdx = headers.findIndex((h) => h === 'product family');
  const prodSubFamIdx = headers.findIndex((h) => h === 'product sub-family');
  const cooIdx = headers.findIndex((h) => h.includes('country of origin') || h === 'coo');
  const eosIdx = headers.findIndex((h) => h.includes('end of sale') || h === 'eos');
  const eolIdx = headers.findIndex((h) => h.includes('end of life') || h === 'eol');
  const replIdx = headers.findIndex((h) => h.includes('replacement') || h.includes('eos replacement'));
  const suppIdx = headers.findIndex((h) => h.includes('support available'));

  if (skuIdx === -1 || descIdx === -1) {
    console.warn(`[parse-skus] Warning: Could not find SKU/Description in ${filePath}`);
    return [];
  }

  const items = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const row = parseCsvLine(rawLine);
    const sku = (row[skuIdx] || '').trim();
    const desc = (row[descIdx] || '').trim();

    if (!sku || !desc) continue;

    const prodFamily = prodFamIdx !== -1 ? (row[prodFamIdx] || '').trim() : undefined;
    const prodSubFamily = prodSubFamIdx !== -1 ? (row[prodSubFamIdx] || '').trim() : undefined;
    const coo = cooIdx !== -1 ? (row[cooIdx] || '').trim() : undefined;
    const eos = eosIdx !== -1 ? (row[eosIdx] || '').trim() : undefined;
    const eol = eolIdx !== -1 ? (row[eolIdx] || '').trim() : undefined;
    const repl = replIdx !== -1 ? (row[replIdx] || '').trim() : undefined;
    const supp = suppIdx !== -1 ? (row[suppIdx] || '').trim().toUpperCase() : undefined;
    const price = listPriceIdx !== -1 ? parsePrice(row[listPriceIdx]) : undefined;
    const priceMonth = listPriceMonthIdx !== -1 ? parsePrice(row[listPriceMonthIdx]) : undefined;

    const isTaa = /TAA Compliant/i.test(desc)
      ? !/Not TAA/i.test(desc)
      : sku.endsWith('T')
        ? true
        : undefined;

    const item = {
      partNumber: sku,
      description: desc,
      category: determineCategory(sku, desc, prodFamily, prodSubFamily),
      productFamily: prodFamily || undefined,
      productSubFamily: prodSubFamily || undefined,
      countryOfOrigin: coo || undefined,
      endOfSale: eos || undefined,
      endOfLife: eol || undefined,
      eosReplacementSku: repl || undefined,
      supportAvailable: supp === 'TRUE' ? true : supp === 'FALSE' ? false : undefined,
      listPrice: price,
      listPriceMonthly: priceMonth,
      portDensity: extractPortDensity(desc),
      speedsSupported: extractSpeeds(desc),
      formFactor: extractFormFactor(sku, desc),
      isTaaCompliant: isTaa,
    };

    items.push(item);
  }

  return items;
}

export function generateSkuCatalog() {
  console.log('[parse-skus] Ingesting SKU reference data from CSV files...');
  const skuMap = new Map();

  // 1. Seed with base master catalogue entries if available
  const SEED_FILE = path.join(OUTPUT_DIR, 'skus.seed.json');
  if (fs.existsSync(SEED_FILE)) {
    try {
      const seedData = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
      const seedSkus = seedData.skus || {};
      const seedMeta = seedData.metadata || {};
      for (const [sku, desc] of Object.entries(seedSkus)) {
        const key = sku.toUpperCase();
        const meta = seedMeta[key];
        skuMap.set(key, {
          partNumber: key,
          description: desc,
          category: determineCategory(key, desc),
          endOfSale: meta?.eos || undefined,
          endOfLife: meta?.eol || undefined,
          eosReplacementSku: meta?.replacement || undefined,
          portDensity: extractPortDensity(desc),
          speedsSupported: extractSpeeds(desc),
          formFactor: extractFormFactor(key, desc),
          isTaaCompliant: /TAA Compliant/i.test(desc) ? true : key.endsWith('T') ? true : undefined,
        });
      }
      console.log(`[parse-skus] Pre-seeded ${skuMap.size} master entries`);
    } catch (e) {
      console.warn(`[parse-skus] Could not read seed file: ${e.message}`);
    }
  }

  for (const filename of CSV_FILES) {
    const filePath = path.join(REFERENCES_DIR, filename);
    const parsed = parseCsvFile(filePath);
    console.log(`[parse-skus] Parsed ${parsed.length} entries from ${filename}`);

    for (const item of parsed) {
      const key = item.partNumber.toUpperCase();
      if (!skuMap.has(key)) {
        skuMap.set(key, item);
      } else {
        // Merge attributes to create the richest possible record
        const existing = skuMap.get(key);
        const merged = {
          ...existing,
          ...item,
          // Preserve any non-undefined fields
          listPrice: item.listPrice !== undefined ? item.listPrice : existing.listPrice,
          listPriceMonthly: item.listPriceMonthly !== undefined ? item.listPriceMonthly : existing.listPriceMonthly,
          productFamily: item.productFamily || existing.productFamily,
          productSubFamily: item.productSubFamily || existing.productSubFamily,
          countryOfOrigin: item.countryOfOrigin || existing.countryOfOrigin,
          endOfSale: item.endOfSale || existing.endOfSale,
          endOfLife: item.endOfLife || existing.endOfLife,
          eosReplacementSku: item.eosReplacementSku || existing.eosReplacementSku,
          portDensity: item.portDensity || existing.portDensity,
          speedsSupported: item.speedsSupported || existing.speedsSupported,
          formFactor: item.formFactor || existing.formFactor,
          isTaaCompliant: item.isTaaCompliant !== undefined ? item.isTaaCompliant : existing.isTaaCompliant,
        };
        skuMap.set(key, merged);
      }
    }
  }

  const allItems = Array.from(skuMap.values()).sort((a, b) => a.partNumber.localeCompare(b.partNumber));

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Retain a backup of the previous single source of truth if it exists
  const BACKUP_JSON_PATH = path.join(OUTPUT_DIR, 'skus.backup.json');
  if (fs.existsSync(OUTPUT_JSON_PATH)) {
    try {
      fs.copyFileSync(OUTPUT_JSON_PATH, BACKUP_JSON_PATH);
      console.log(`[parse-skus] Backed up previous SKU catalogue to ${BACKUP_JSON_PATH}`);
    } catch (e) {
      console.warn(`[parse-skus] Could not write backup file: ${e.message}`);
    }
  }

  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(allItems, null, 2), 'utf-8');
  console.log(`[parse-skus] Successfully generated ${allItems.length} structured SKU records in ${OUTPUT_JSON_PATH}`);

  // Automatically keep legacy flat dictionaries (src/constants/skus.json & skus_metadata.json) in sync
  const CONSTANTS_DIR = path.join(ROOT_DIR, 'src', 'constants');
  const flatSkus = {};
  const flatMetadata = {};

  for (const item of allItems) {
    const key = item.partNumber.toUpperCase();
    flatSkus[key] = item.description;
    if (item.endOfSale || item.endOfLife || item.eosReplacementSku) {
      flatMetadata[key] = {
        eos: item.endOfSale || '',
        eol: item.endOfLife || '',
        replacement: item.eosReplacementSku ? item.eosReplacementSku.toUpperCase() : '',
      };
    }
  }

  try {
    fs.writeFileSync(path.join(CONSTANTS_DIR, 'skus.json'), JSON.stringify(flatSkus, null, 2), 'utf-8');
    fs.writeFileSync(path.join(CONSTANTS_DIR, 'skus_metadata.json'), JSON.stringify(flatMetadata, null, 2), 'utf-8');
    console.log(`[parse-skus] Synced legacy flat mappings to src/constants/`);
  } catch (e) {
    console.warn(`[parse-skus] Could not write legacy constant mappings: ${e.message}`);
  }

  return allItems;
}

// Run when executed directly
generateSkuCatalog();
