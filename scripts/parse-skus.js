/**
 * scripts/parse-skus.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Build-time data ingestion pipeline.
 * Reads the authoritative Worldwide Price List (WWPL) Excel spreadsheet in `references/`,
 * normalises field names, enriches data with extracted hardware metadata,
 * deduplicates entries, and outputs the structured catalogue to `src/data/skus.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REFERENCES_DIR = path.join(ROOT_DIR, 'references');
const OUTPUT_DIR = path.join(ROOT_DIR, 'src', 'data');
const OUTPUT_JSON_PATH = path.join(OUTPUT_DIR, 'skus.json');

const args = process.argv.slice(2);
const editionArg = args.find((a) => a.startsWith('--edition='))?.split('=')[1] || process.env.VITE_APP_EDITION || 'internal';
const edition = editionArg.toLowerCase() === 'partner' ? 'partner' : 'internal';

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
  const s = sku.toUpperCase().trim();
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
  if (sub === 'power' || s.startsWith('PWR-') || s.startsWith('BAT-') || s.startsWith('PCD-') || d.includes('power supply') || d.includes('power cord') || d.includes('battery pack')) {
    return 'Power';
  }
  if (s.startsWith('GTP-') || s.startsWith('TAP-') || s.startsWith('PNL-') || s.startsWith('M100') || s.startsWith('M200') || s.startsWith('ULT-') || d.includes('tap module') || d.includes('always on tap') || sub.includes('gtap') || sub.includes('tap')) {
    return 'TAP';
  }
  if (
    ((s.startsWith('GVS-') || s.startsWith('GSW-') || s.startsWith('GFM-HW')) && !s.includes('-SW-') && !s.includes('-TM') && !s.endsWith('-PL')) ||
    (s.endsWith('-HW') && (s.startsWith('GVS-') || s.startsWith('GSW-') || s.startsWith('GFM-')))
  ) {
    return 'Chassis';
  }
  if (
    (s.endsWith('-HW') && (s.startsWith('PRT-') || s.startsWith('SMT-') || s.startsWith('BPS-') || s.startsWith('CTL-') || s.startsWith('CCV-'))) ||
    ((s.startsWith('PRT-') || s.startsWith('BPS-') || s.startsWith('CTL-') || s.startsWith('CCV-') || s === 'SMT-HC3-C08' || s === 'SMT-HC3-C05' || s === 'SMT-HC0-X16' || s === 'SMT-HC1-S' || s === 'SMT-HC0-Q02X08') &&
      !s.includes('-SW-') &&
      !s.includes('-TM') &&
      !s.endsWith('-PL'))
  ) {
    return 'Module';
  }
  if (
    s.includes('-SW-') ||
    s.includes('-TM') ||
    s.endsWith('-PL') ||
    s.includes('-GEN3-') ||
    s.includes('-GEN2-') ||
    s.startsWith('CLS-') ||
    s.startsWith('GEM-') ||
    s.startsWith('UPG-') ||
    s.startsWith('GFM-') ||
    d.includes('term license') ||
    d.includes('subscription license') ||
    d.includes('perpetual license') ||
    d.includes('feature license') ||
    d.includes('license for')
  ) {
    return 'License';
  }
  if (fam.includes('accessories') || sub.includes('accessories') || s.startsWith('ACC-') || s.startsWith('RACK-') || s.startsWith('FIL-')) {
    return 'Accessory';
  }
  if (d.includes('support') || s.includes('SPT-') || s.startsWith('GSS-') || s.startsWith('GSP-')) {
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

function parseXlsxFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  let workbook;
  try {
    const buffer = fs.readFileSync(filePath);
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch (err) {
    console.warn(`[parse-skus] Skipping non-price-list file ${path.basename(filePath)}: ${err.message}`);
    return [];
  }

  // Find sheet containing SKU data
  let targetSheetName = workbook.SheetNames[0];
  for (const name of workbook.SheetNames) {
    const raw = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, blankrows: false });
    for (const row of raw.slice(0, 4)) {
      if ((row || []).some((cell) => String(cell || '').toLowerCase().includes('sku'))) {
        targetSheetName = name;
        break;
      }
    }
  }

  const sheet = workbook.Sheets[targetSheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
  if (raw.length < 2) return [];

  let headerIndex = -1;
  for (let i = 0; i < Math.min(6, raw.length); i++) {
    const rowStr = (raw[i] || []).join(' ').toLowerCase();
    if (rowStr.includes('sku') && (rowStr.includes('desc') || rowStr.includes('price'))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    // Not a price list spreadsheet (e.g. matrix or stencil)
    return [];
  }

  const headers = (raw[headerIndex] || []).map((h) => String(h || '').toLowerCase().trim());
  const skuIdx = headers.findIndex((h) => h === 'sku' || h.startsWith('sku'));
  const descIdx = headers.findIndex((h) => h.includes('description') || h === 'desc');
  const listPriceIdx = headers.findIndex((h) => h === 'list price' || h === 'price');
  const listPriceMonthIdx = headers.findIndex((h) => h.includes('price/month') || h.includes('monthly'));
  const prodFamIdx = headers.findIndex((h) => h === 'product family');
  const prodSubFamIdx = headers.findIndex((h) => h === 'product sub-family');
  const cooIdx = headers.findIndex((h) => h.includes('country of origin') || h === 'coo');
  const eosIdx = headers.findIndex((h) => (h.includes('end of sale') || h.includes('eos')) && !h.includes('replacement'));
  const eolIdx = headers.findIndex((h) => h.includes('end of life') || h.includes('eol'));
  const replIdx = headers.findIndex((h) => h.includes('replacement') || h.includes('eos replacement'));
  const suppIdx = headers.findIndex((h) => h.includes('support available'));
  const suppPricingIdx = headers.findIndex((h) => h.includes('support pricing'));

  const items = [];
  for (let i = headerIndex + 1; i < raw.length; i++) {
    const row = raw[i];
    const sku = String(row[skuIdx] || '').trim();
    const desc = String(row[descIdx] || '').trim();
    if (!sku || !desc) continue;

    const prodFamily = prodFamIdx !== -1 ? String(row[prodFamIdx] || '').trim() : undefined;
    const prodSubFamily = prodSubFamIdx !== -1 ? String(row[prodSubFamIdx] || '').trim() : undefined;
    const coo = cooIdx !== -1 ? String(row[cooIdx] || '').trim() : undefined;
    const eos = eosIdx !== -1 ? String(row[eosIdx] || '').trim() : undefined;
    const eol = eolIdx !== -1 ? String(row[eolIdx] || '').trim() : undefined;
    const repl = replIdx !== -1 ? String(row[replIdx] || '').trim() : undefined;
    const supp = suppIdx !== -1 ? (row[suppIdx] === true || String(row[suppIdx]).trim().toUpperCase() === 'TRUE') : undefined;
    const suppPricing = suppPricingIdx !== -1 ? String(row[suppPricingIdx] || '').trim() : undefined;
    const price = listPriceIdx !== -1 ? parsePrice(row[listPriceIdx]) : undefined;
    const priceMonth = listPriceMonthIdx !== -1 ? parsePrice(row[listPriceMonthIdx]) : undefined;

    const isTaa = /TAA Compliant/i.test(desc)
      ? !/Not TAA/i.test(desc)
      : sku.endsWith('T')
        ? true
        : undefined;

    items.push({
      partNumber: sku,
      description: desc,
      category: determineCategory(sku, desc, prodFamily, prodSubFamily),
      productFamily: prodFamily || undefined,
      productSubFamily: prodSubFamily || undefined,
      countryOfOrigin: coo || undefined,
      endOfSale: eos || undefined,
      endOfLife: eol || undefined,
      eosReplacementSku: repl || undefined,
      supportAvailable: supp,
      supportPricing: suppPricing || undefined,
      listPrice: price,
      listPriceMonthly: priceMonth,
      portDensity: extractPortDensity(desc),
      speedsSupported: extractSpeeds(desc),
      formFactor: extractFormFactor(sku, desc),
      isTaaCompliant: isTaa,
    });
  }
  return items;
}

export function generateSkuCatalog() {
  console.log('[parse-skus] Ingesting SKU reference data from XLSX files...');
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

  const newlySeenSkus = new Set();

  // 2. Ingest active XLSX Price Lists (e.g. WWPL_20260731.xlsx) with highest priority
  const xlsxFiles = fs.readdirSync(REFERENCES_DIR).filter((f) => f.endsWith('.xlsx') || f.endsWith('.xls'));
  for (const filename of xlsxFiles) {
    const filePath = path.join(REFERENCES_DIR, filename);
    const parsed = parseXlsxFile(filePath);
    console.log(`[parse-skus] Parsed ${parsed.length} entries from XLSX: ${filename}`);

    for (const item of parsed) {
      const key = item.partNumber.toUpperCase();
      newlySeenSkus.add(key);

      if (!skuMap.has(key)) {
        skuMap.set(key, item);
      } else {
        const existing = skuMap.get(key);
        skuMap.set(key, {
          ...existing,
          ...item,
          // Authoritative spreadsheet fields overwrite older CSV approximations
          listPrice: item.listPrice !== undefined ? item.listPrice : existing.listPrice,
          listPriceMonthly: item.listPriceMonthly !== undefined ? item.listPriceMonthly : existing.listPriceMonthly,
          description: item.description || existing.description,
          category: item.category || existing.category,
          productFamily: item.productFamily || existing.productFamily,
          productSubFamily: item.productSubFamily || existing.productSubFamily,
          endOfSale: item.endOfSale || existing.endOfSale,
          endOfLife: item.endOfLife || existing.endOfLife,
          eosReplacementSku: item.eosReplacementSku || existing.eosReplacementSku,
          supportAvailable: item.supportAvailable !== undefined ? item.supportAvailable : existing.supportAvailable,
          supportPricing: item.supportPricing || existing.supportPricing,
        });
      }
    }
  }

  // Add GSS-HW-AHR-GMO percent-of-total support SKU
  skuMap.set('GSS-HW-AHR-GMO', {
    partNumber: 'GSS-HW-AHR-GMO',
    description: 'Advanced Hardware Replacement (AHR) for Support-Enabled Hardware - 5 Year / 60 Month Term (41.0% of HW List Price)',
    category: 'Support',
    productFamily: 'Support & Services',
    productSubFamily: 'Advanced Hardware Replacement',
    listPrice: 0,
    isPercentOfTotal: true,
    percentOfTotalRate: 0.41,
    status: 'Active',
    isUnavailable: false,
    supportAvailable: true,
  });
  newlySeenSkus.add('GSS-HW-AHR-GMO');

  // Baseline standard catalog prices for core chassis, modules, and software licenses
  const DEFAULT_SKU_PRICES = {
    // HC3 Base Chassis & Hardware
    'GVS-HC3A1': { listPrice: 22645 },
    'GVS-HC3A1-HW': { listPrice: 22645 },
    'GVS-HC3A2': { listPrice: 22645 },
    'GVS-HC3A2-HW': { listPrice: 22645 },
    'GVS-HC3A3': { listPrice: 24995 },
    'GVS-HC3A3-HW': { listPrice: 24995 },
    'GVS-HC3A4': { listPrice: 24995 },
    'GVS-HC3A4-HW': { listPrice: 24995 },
    // HC3 Base Term Licences
    'GVS-HC3A0-SW-TM': { listPriceMonthly: 2365 },
    'GVS-HC3A1-SW-TM': { listPriceMonthly: 2365 },
    'GVS-HC3A2-SW-TM': { listPriceMonthly: 2365 },

    // HC3 Port Modules & Cards
    'PRT-HC3-X24': { listPrice: 3165 },
    'PRT-HC3-X24-HW': { listPrice: 3165 },
    'PRT-HC3-X24-SW-TM': { listPriceMonthly: 2155 },
    'PRT-HC3-C08': { listPrice: 4500 },
    'PRT-HC3-C08-HW': { listPrice: 4500 },
    'PRT-HC3-C08-SW-TM': { listPriceMonthly: 2500 },
    'PRT-HC3-C16': { listPrice: 8500 },
    'PRT-HC3-C16-HW': { listPrice: 8500 },
    'PRT-HC3-C16-SW-TM': { listPriceMonthly: 3950 },

    // HC3 GigaSMART Modules & Licences (Perpetual & HTL)
    'SMT-HC3-C08': { listPrice: 5450 },
    'SMT-HC3-C08-HW': { listPrice: 5450 },
    'SMT-HC3-C08-SW-TM': { listPriceMonthly: 24400 },
    'SMT-HC3-C08-SW': { listPriceMonthly: 24400 },
    'SMT-HC3-GEN3-FVU': { listPrice: 25000 },
    'SMT-HC3-GEN3-FVU-SW-TM': { listPriceMonthly: 2145 },
    'SMT-HC3-GEN3-GTPMAX': { listPrice: 45000 },
    'SMT-HC3-GEN3-GTPMAX-SW-TM': { listPriceMonthly: 4260 },
    'SMT-HC3-GEN3-AFS-PL': { listPrice: 25000 },
    'SMT-HC3-GEN3-AFS-SW-TM': { listPriceMonthly: 2145 },
    'SMT-HC3-GEN3-APF': { listPrice: 38000 },
    'SMT-HC3-GEN3-APF-SW-TM': { listPriceMonthly: 3530 },
    'SMT-HC3-GEN3-5GC-PL': { listPrice: 35000 },
    'SMT-HC3-GEN3-5GC-SW-TM': { listPriceMonthly: 3200 },
    'SMT-HC3-GEN3-AMI': { listPrice: 38000 },
    'SMT-HC3-GEN3-AMI-SW-TM': { listPriceMonthly: 3530 },
    'SMT-HC3-GEN3-SSL': { listPrice: 40000 },
    'SMT-HC3-GEN3-SSL-SW-TM': { listPriceMonthly: 3800 },
    'SMT-HC3-GEN3-INSSL-PL': { listPrice: 50000 },
    'SMT-HC3-GEN3-INSSL-SW-TM': { listPriceMonthly: 4600 },
    'SMT-HC3-GEN3-HS1-PL': { listPrice: 15000 },
    'SMT-HC3-GEN3-HS1-SW-TM': { listPriceMonthly: 1400 },
    'SMT-HC3-GEN3-NF1': { listPrice: 18000 },
    'SMT-HC3-GEN3-NF1-SW-TM': { listPriceMonthly: 1650 },
    'SMT-HC3-GEN3-DD1': { listPrice: 25000 },
    'SMT-HC3-GEN3-DD1-SW-TM': { listPriceMonthly: 2300 },
    'SMT-HC3-GEN3-AT1': { listPrice: 20000 },
    'SMT-HC3-GEN3-AT1-SW-TM': { listPriceMonthly: 1850 },
    'SMT-HC3-GEN3-AFI': { listPrice: 30000 },
    'SMT-HC3-GEN3-AFI-SW-TM': { listPriceMonthly: 2800 },

    // GigaVUE Fabric Manager (GFM) Licences & Hardware
    'GFM-FM000': { listPrice: 27720 },
    'GFM-FM000-SW-TM': { listPriceMonthly: 2310 },
    'GFM-FM010': { listPrice: 11000 },
    'GFM-FM010-SW-TM': { listPriceMonthly: 990 },
    'GFM-FM005': { listPrice: 6000 },
    'GFM-FM005-SW-TM': { listPriceMonthly: 550 },
    'GFM-FM001': { listPrice: 1500 },
    'GFM-HW2-FM001-HW': { listPrice: 18500 },
    'GFM-UPG-5P': { listPrice: 22000 },
    'GFM-UPG-10P': { listPrice: 16500 },
    'GFM-UPG-510': { listPrice: 5500 },

    // HC1 / HC1P GigaSMART Licences
    'SMT-HC1P-GEN3-FVU-PL': { listPrice: 18000 },
    'SMT-HC1P-GEN3-FVU-SW-TM': { listPriceMonthly: 1600 },
    'SMT-HC1P-GEN3-GTP-PL': { listPrice: 30000 },
    'SMT-HC1P-GEN3-GTP-SW-TM': { listPriceMonthly: 2800 },
    'SMT-HC1P-GEN3-GTPMAX-PL': { listPrice: 35000 },
    'SMT-HC1P-GEN3-GTPMAX-SW-TM': { listPriceMonthly: 3200 },
    'SMT-HC1P-GEN3-AFS-PL': { listPrice: 18000 },
    'SMT-HC1P-GEN3-AFS-SW-TM': { listPriceMonthly: 1600 },
    'SMT-HC1P-GEN3-AMI-PL': { listPrice: 28000 },
    'SMT-HC1P-GEN3-AMI-SW-TM': { listPriceMonthly: 2500 },
    'SMT-HC1P-GEN3-APF-PL': { listPrice: 28000 },
    'SMT-HC1P-GEN3-APF-SW-TM': { listPriceMonthly: 2500 },
    'SMT-HC1P-GEN3-DD1-PL': { listPrice: 18000 },
    'SMT-HC1P-GEN3-DD1-SW-TM': { listPriceMonthly: 1600 },
    'SMT-HC1P-GEN3-HS1-PL': { listPrice: 12000 },
    'SMT-HC1P-GEN3-HS1-SW-TM': { listPriceMonthly: 1100 },
    'SMT-HC1P-GEN3-INSSL-PL': { listPrice: 35000 },
    'SMT-HC1P-GEN3-INSSL-SW-TM': { listPriceMonthly: 3200 },
    'SMT-HC1P-GEN3-SSL-PL': { listPrice: 30000 },
    'SMT-HC1P-GEN3-SSL-SW-TM': { listPriceMonthly: 2800 },
    'SMT-HC1-GEN3-FVU-PL': { listPrice: 18000 },
    'SMT-HC1-GEN3-FVU-SW-TM': { listPriceMonthly: 1600 },
    'SMT-HC1-GEN3-AFS-PL': { listPrice: 18000 },
    'SMT-HC1-GEN3-AFS-SW-TM': { listPriceMonthly: 1600 },
    'SMT-HC1-GEN3-AMI': { listPrice: 28000 },
    'SMT-HC1-GEN3-AMI-SW-TM': { listPriceMonthly: 2500 },
    'SMT-HC1-GEN3-APF': { listPrice: 28000 },
    'SMT-HC1-GEN3-APF-SW-TM': { listPriceMonthly: 2500 },
    'SMT-HC1-GEN3-AT1': { listPrice: 16000 },
    'SMT-HC1-GEN3-AT1-SW-TM': { listPriceMonthly: 1400 },
    'SMT-HC1-GEN3-BN-ZTA-SW-TM': { listPriceMonthly: 7500 },
    'SMT-HC1-GEN3-DD1': { listPrice: 18000 },
    'SMT-HC1-GEN3-DD1-SW-TM': { listPriceMonthly: 1600 },
    'SMT-HC1-GEN3-GTPMAX-PL': { listPrice: 35000 },
    'SMT-HC1-GEN3-GTPMAX-SW-TM': { listPriceMonthly: 3200 },
    'SMT-HC1-GEN3-HS1-PL': { listPrice: 12000 },
    'SMT-HC1-GEN3-HS1-SW-TM': { listPriceMonthly: 1100 },
    'SMT-HC1-GEN3-INSSL-PL': { listPrice: 35000 },
    'SMT-HC1-GEN3-INSSL-SW-TM': { listPriceMonthly: 3200 },
    'SMT-HC1-GEN3-NF1': { listPrice: 18000 },
    'SMT-HC1-GEN3-NF1-SW-TM': { listPriceMonthly: 1650 },
    'SMT-HC1-GEN3-SSL': { listPrice: 30000 },
    'SMT-HC1-GEN3-SSL-SW-TM': { listPriceMonthly: 2800 },
    'SMT-HC1-GEN2-FVU-SW-TM': { listPriceMonthly: 1600 },
    'SMT-HC1-GEN2-DD1-SW-TM': { listPriceMonthly: 1600 },
    'SMT-HC1-GEN2-INSSL-SW-TM': { listPriceMonthly: 2500 },
    'SMT-HC1-GEN2-BSE-SW-TM': { listPriceMonthly: 1800 },
    'SMT-HC1-GEN2-AFS-SW-TM': { listPriceMonthly: 1600 },
    'SMT-HC1-GEN2-HS1-SW-TM': { listPriceMonthly: 1100 },
    'SMT-HC1-GEN2-AMI-SW-TM': { listPriceMonthly: 2500 },
    'SMT-HC1-GEN2-AT1-SW-TM': { listPriceMonthly: 1400 },
    'SMT-HC1-FVU': { listPrice: 18000 },
    'SMT-HC1-DD1': { listPrice: 18000 },
    'SMT-HC1-INSSL': { listPrice: 28000 },
    'SMT-HC1-BSE': { listPrice: 20000 },
    'SMT-HC1-AFS': { listPrice: 18000 },
    'SMT-HC1-HS1': { listPrice: 12000 },
    'SMT-HC1-AMI': { listPrice: 28000 },
    'SMT-HC1-AT1': { listPrice: 16000 },
    'GVS-GSA110-2AC': { listPrice: 45000 },
    'GVS-GSA110-2DC': { listPrice: 45000 },
    'GVS-GSA110-2AC-HW': { listPrice: 45000 },
    'CBL-5005': { listPrice: 150 },
    'CBL-505A': { listPrice: 650 },
    'CBL-510A': { listPrice: 850 },
    'SMT-HC1-NF1': { listPrice: 18000 },
    'SMT-HC1-SSL': { listPrice: 28000 },
    'SMT-HC1-TUN': { listPrice: 12000 },
    'SMT-HC1-UPGAFI': { listPrice: 15000 },
    'SMT-HC1-UPGBN-NV': { listPrice: 15000 },
    'SMT-HC1-UPGBN-NVP': { listPrice: 20000 },
    'SMT-HC1-UPGBN-SV': { listPrice: 15000 },
    'SMT-HC1-UPGBN-SVP': { listPrice: 20000 },
    'SMT-HC1-UPGINSSL': { listPrice: 15000 },
    'SMT-HC1P-GEN3-AFI-PL': { listPrice: 28000 },
    'SMT-HC1P-GEN3-AFI-SW-TM': { listPriceMonthly: 2500 },
    'SMT-HC1P-GEN3-AT1-PL': { listPrice: 16000 },
    'SMT-HC1P-GEN3-AT1-SW-TM': { listPriceMonthly: 1400 },
    'SMT-HC1P-GEN3-BN-ZTA-SW-TM': { listPriceMonthly: 7500 },
    'SMT-HC1P-GEN3-NF1-PL': { listPrice: 18000 },
    'SMT-HC1P-GEN3-NF1-SW-TM': { listPriceMonthly: 1650 },
    'SMT-HC3-AFSP': { listPrice: 25000 },
    'SMT-HC3-GEN2-AFS-SW-PL': { listPrice: 25000 },
    'SMT-HC3-GEN2-VDR-SW-PL': { listPrice: 20000 },
    'GVS-HC1P1': { listPrice: 16500 },
    'GVS-HC1P1-HW': { listPrice: 16500 },
    'GVS-HC1P0-SW-TM': { listPriceMonthly: 1800 },
    'GVS-HC1P-SW-TM': { listPriceMonthly: 1800 },
    'GVS-HC1P2': { listPrice: 16500 },
    'GVS-HC1P2-HW': { listPrice: 16500 },
    'GVS-HC102': { listPrice: 14000 },
    'GVS-HC102-HW': { listPrice: 14000 },
    'GVS-HCT01': { listPrice: 9500 },
    'GVS-HCT01-HW': { listPrice: 9500 },
    'GVS-HCT00-SW-TM': { listPriceMonthly: 950 },
    'CTL-HC3-002': { listPrice: 9500 },
    'PRT-HC1-G12': { listPrice: 1800 },
    'PRT-HC1-G12-HW': { listPrice: 1800 },
    'PRT-HC1-G12-SW-TM': { listPriceMonthly: 900 },
    'PRT-HC1-Q04X08': { listPrice: 4200 },
    'PRT-HC1-Q04X08-HW': { listPrice: 4200 },
    'PRT-HC1-Q04X08-SW-TM': { listPriceMonthly: 2100 },
    'PRT-HC3-C08Q08': { listPrice: 7500 },
    'PRT-HC3-C08Q08-HW': { listPrice: 7500 },
    'PRT-HC3-C08Q08-SW-TM': { listPriceMonthly: 3500 },
    'BPS-HC1-D25A24': { listPrice: 6500 },
    'BPS-HC1-D25A24-HW': { listPrice: 6500 },
    'BPS-HC1-D25A24-SW-TM': { listPriceMonthly: 550 },
    'BPS-HC1-D25A60': { listPrice: 8500 },
    'BPS-HC1-D25A60-HW': { listPrice: 8500 },
    'BPS-HC1-D25A60-SW-TM': { listPriceMonthly: 7500 },
    'BPS-HC1-D35C60': { listPrice: 9500 },
    'BPS-HC1-D35C60-HW': { listPrice: 9500 },
    'BPS-HC1-D35C60-SW-TM': { listPriceMonthly: 850 },
    'BPS-HC3-C25F2G': { listPrice: 16500 },
    'BPS-HC3-C25F2G-HW': { listPrice: 16500 },
    'BPS-HC3-C25F2G-SW-TM': { listPriceMonthly: 1500 },
    'BPS-HC3-C35C2G': { listPrice: 18500 },
    'BPS-HC3-C35C2G-HW': { listPrice: 18500 },
    'BPS-HC3-C35C2G-SW-TM': { listPriceMonthly: 1750 },
    'BPS-HC3-Q35C2G': { listPrice: 14500 },
    'BPS-HC3-Q35C2G-HW': { listPrice: 14500 },
    'BPS-HC3-Q35C2G-SW-TM': { listPriceMonthly: 1350 },
    'GEM-25G-4G-SW-TM': { listPriceMonthly: 450 },
    'GEM-25G-5G-SW-TM': { listPriceMonthly: 550 },
    'GEM-50G-4G-SW-TM': { listPriceMonthly: 850 },
    'GEM-50G-5G-SW-TM': { listPriceMonthly: 1050 },
    'GEM-250G-4G-SW-TM': { listPriceMonthly: 2500 },
    'GEM-250G-5G-SW-TM': { listPriceMonthly: 3200 },
    'GEM-2500G-4G-SW-TM': { listPriceMonthly: 12500 },
    'GEM-2500G-5G-SW-TM': { listPriceMonthly: 16000 },
    'SMT-HC1-AFI': { listPrice: 18000 },
    'SMT-HC1-APF': { listPrice: 25000 },
    'SMT-HC1-GEN2-AFI-SW-PL': { listPrice: 28000 },
    'SMT-HC1-GEN2-AFI-SW-TM': { listPriceMonthly: 2500 },
    'SMT-HC1-GEN2-AFS-SW-PL': { listPrice: 18000 },
    'SMT-HC1-GEN2-AMI-SW-PL': { listPrice: 28000 },
    'SMT-HC1-GEN2-APF-SW-TM': { listPriceMonthly: 2500 },
    'SMT-HC1-GEN2-BN-ZTA-SW-TM': { listPriceMonthly: 7500 },
    'SMT-HC1-GEN2-NF1-SW-TM': { listPriceMonthly: 1650 },
    'SMT-HC1-GEN2-SSL-SW-TM': { listPriceMonthly: 2800 },
    'SMT-HC1-GEN2-TUN-SW-TM': { listPriceMonthly: 1100 },
    'SMT-HC1-GEN2-UPGINSSL-SW-TM': { listPriceMonthly: 1500 },
    'SMT-HC1-GEN3-5GC-SW-TM': { listPriceMonthly: 3200 },
    'SMT-HC1-GEN3-AFI': { listPrice: 28000 },
    'SMT-HC1-GEN3-AFI-SW-TM': { listPriceMonthly: 2500 },
    'SMT-HC1-BN-CORE': { listPrice: 25000 },
    'SMT-HC1-BN-NV': { listPrice: 35000 },
    'SMT-HC1-BN-NVP': { listPrice: 45000 },
    'SMT-HC1-BN-SV': { listPrice: 45000 },
    'SMT-HC1-BN-SVP': { listPrice: 65000 },
    'SMT-HC3-GEN3-BN-ZTA-SW-TM': { listPriceMonthly: 9500 },
    'SMT-HC3-UPGAFI': { listPrice: 15000 },
    'SMT-HC3-C05': { listPrice: 5450 },
    'SMT-HC3-C05-HW': { listPrice: 5450 },
    'SMT-HC3-C05-SW-TM': { listPriceMonthly: 3530 },
    'TAP-HC1-G10040': { listPrice: 4500 },
    'TAP-HC1-G10040-HW': { listPrice: 4500 },
    'TAP-HC1-G10040-SW-TM': { listPriceMonthly: 550 },
    'TAP-HC0-D25AC0-SW-TM': { listPriceMonthly: 550 },
    'TAP-HC0-D25BC0-SW-TM': { listPriceMonthly: 550 },
    'TAP-HC0-D35CC0-SW-TM': { listPriceMonthly: 550 },
    'TAP-HC0-G100C0-SW-TM': { listPriceMonthly: 550 },
    'FIL-HD400': { listPrice: 150 },
    'FIL-HD800': { listPrice: 250 },

    // HC2 Base Chassis, Modules & Licences
    'GVS-HC201': { listPrice: 18000 },
    'GVS-HC201-HW': { listPrice: 18000 },
    'GVS-HC200-SW-TM': { listPriceMonthly: 1800 },
    'PRT-HC0-X24': { listPrice: 2800 },
    'PRT-HC0-X24-HW': { listPrice: 2800 },
    'PRT-HC0-X24-SW-TM': { listPriceMonthly: 1400 },
    'SMT-HC0-X16': { listPrice: 4500 },
    'SMT-HC0-X16-HW': { listPrice: 4500 },
    'SMT-HC0-X16-SW-TM': { listPriceMonthly: 2200 },
    'SMT-HC2-GEN2-FVU-SW-TM': { listPriceMonthly: 2145 },
    'SMT-HC2-FVU': { listPrice: 25000 },
    'SMT-HC2-GEN2-GTPMAX-SW-TM': { listPriceMonthly: 4260 },
    'SMT-HC2-GTP': { listPrice: 45000 },
    'SMT-HC2-GEN2-AFS-SW-TM': { listPriceMonthly: 2145 },
    'SMT-HC2-AFS': { listPrice: 25000 },
    'SMT-HC2-GEN2-APF-SW-TM': { listPriceMonthly: 3530 },
    'SMT-HC2-APF': { listPrice: 38000 },
    'SMT-HC2-GEN2-AMI-SW-TM': { listPriceMonthly: 3530 },
    'SMT-HC2-AMI': { listPrice: 38000 },
    'SMT-HC2-GEN2-SSL-SW-TM': { listPriceMonthly: 3800 },
    'SMT-HC2-SSL': { listPrice: 40000 },
    'SMT-HC2-GEN2-HS1-SW-TM': { listPriceMonthly: 1400 },
    'SMT-HC2-HS1': { listPrice: 15000 },
    'SMT-HC2-GEN2-NF1-SW-TM': { listPriceMonthly: 1650 },
    'SMT-HC2-NF1': { listPrice: 18000 },
    'SMT-HC2-GEN2-DD1-SW-TM': { listPriceMonthly: 2300 },
    'SMT-HC2-DD1': { listPrice: 25000 },
    'SMT-HC2-GEN2-AT1-SW-TM': { listPriceMonthly: 1850 },
    'SMT-HC2-AT1': { listPrice: 20000 },
    'SMT-HC2-GEN2-AFI-SW-TM': { listPriceMonthly: 2800 },
    'SMT-HC2-AFI': { listPrice: 30000 },
    'SMT-HC2-GEN2-5GC-SW-TM': { listPriceMonthly: 3200 },
    'SMT-HC2-GEN2-DCRP-SW-TM': { listPriceMonthly: 3800 },

    // HC3 Gen 2 Licences
    'SMT-HC3-GEN2-FVU-SW-TM': { listPriceMonthly: 2145 },
    'SMT-HC3-GEN2-GTPMAX-SW-TM': { listPriceMonthly: 4260 },
    'SMT-HC3-GEN2-AFS-SW-TM': { listPriceMonthly: 2145 },
    'SMT-HC3-GEN2-APF-SW-TM': { listPriceMonthly: 3530 },
    'SMT-HC3-GEN2-AMI-SW-TM': { listPriceMonthly: 3530 },
    'SMT-HC3-GEN2-SSL-SW-TM': { listPriceMonthly: 3800 },
    'SMT-HC3-GEN2-HS1-SW-TM': { listPriceMonthly: 1400 },
    'SMT-HC3-GEN2-NF1-SW-TM': { listPriceMonthly: 1650 },
    'SMT-HC3-GEN2-DD1-SW-TM': { listPriceMonthly: 2300 },
    'SMT-HC3-GEN2-AT1-SW-TM': { listPriceMonthly: 1850 },
    'SMT-HC3-GEN2-AFI-SW-TM': { listPriceMonthly: 2800 },
    'SMT-HC3-GEN2-5GC-SW-TM': { listPriceMonthly: 3200 },
    'SMT-HC3-GEN2-INSSL-SW-TM': { listPriceMonthly: 4600 },

    // TA-Series Port Upgrades and Software Licences
    'UPG-TAC40EA': { listPrice: 38500 },
    'UPG-TAC40EA-SW-TM': { listPriceMonthly: 1500 },
    'UPG-TAC20': { listPrice: 25485 },
    'UPG-TAC20-SW-TM': { listPriceMonthly: 995 },
    'UPG-TAC20E': { listPrice: 25485 },
    'UPG-TAC20E-SW-TM': { listPriceMonthly: 995 },
    'CLS-TAX20': { listPrice: 12000 },
    'CLS-TAX20-SW-TM': { listPriceMonthly: 495 },

    // TA25 / TA25E
    'GVS-TAX20': { listPrice: 23750 },
    'GVS-TAX20-HW': { listPrice: 23750 },
    'GVS-TAX21E-HW': { listPrice: 23750 },
    'GVS-TAX20-SW-TM': { listPriceMonthly: 2365 },
    'GVS-TAX20E-SW-TM': { listPriceMonthly: 2365 },

    // HC1 Base Chassis, Modules & Licences
    'GVS-HC101': { listPrice: 14000 },
    'GVS-HC101-HW': { listPrice: 14000 },
    'GVS-HC100-SW-TM': { listPriceMonthly: 1500 },
    'PRT-HC1-X12': { listPrice: 2500 },
    'PRT-HC1-X12-HW': { listPrice: 2500 },
    'PRT-HC1-X12-SW-TM': { listPriceMonthly: 1200 },
    'SMT-HC1-S': { listPrice: 3500 },
    'SMT-HC1-S-HW': { listPrice: 3500 },
    'SMT-HC1-S-SW-TM': { listPriceMonthly: 1900 },

    // GSA110 Cloud & Virtual Licences
    'GVS-GSA110-SW-TM': { listPriceMonthly: 1800 },
    'SMT-GSA110-AMI-100G-SW-TM': { listPriceMonthly: 2100 },
    'SMT-GSA110-AMI-100G-PL': { listPrice: 24000 },
    'SMT-GSA110-AMI-5G-100G-SW-TM': { listPriceMonthly: 2500 },
    'SMT-GSA110-AMI-5G-100G-PL': { listPrice: 28000 },
    'SMT-GSA110-AFI-100G-SW-TM': { listPriceMonthly: 1800 },
    'SMT-GSA110-AFI-100G-PL': { listPrice: 20000 },
    'SMT-GSA110-DD-100G-SW-TM': { listPriceMonthly: 1500 },
    'SMT-GSA110-DD-100G-PL': { listPrice: 17000 },
  };

  // Determine lifecycle status and enrich with default prices if missing
  for (const [key, item] of skuMap.entries()) {
    const isPresentInActivePriceLists = newlySeenSkus.has(key);

    // Apply baseline standard reference price if not present in CSVs
    const defaultPrice = DEFAULT_SKU_PRICES[key];
    if (defaultPrice) {
      if (item.listPrice === undefined && defaultPrice.listPrice !== undefined) {
        item.listPrice = defaultPrice.listPrice;
      }
      if (item.listPriceMonthly === undefined && defaultPrice.listPriceMonthly !== undefined) {
        item.listPriceMonthly = defaultPrice.listPriceMonthly;
      }
    }

    if (item.endOfLife) {
      item.status = 'EOL';
      item.isUnavailable = true;
    } else if (item.endOfSale) {
      item.status = 'EOS';
      item.isUnavailable = true;
    } else if (!isPresentInActivePriceLists) {
      // Retained in the knowledge base, but discontinued / removed from active price list
      item.status = 'Discontinued';
      item.isUnavailable = true;
      item.supportAvailable = false;
      if (!item.endOfSale) {
        item.endOfSale = 'Discontinued (Removed from Price List)';
      }
    } else {
      item.status = 'Active';
      item.isUnavailable = false;
    }
  }

  const allItems = Array.from(skuMap.values()).sort((a, b) => a.partNumber.localeCompare(b.partNumber));

  if (edition === 'partner') {
    console.log(`[parse-skus] Sanitising SKU catalogue for PARTNER release (stripping all pricing data)...`);
    for (const item of allItems) {
      delete item.listPrice;
      delete item.listPriceMonthly;
      delete item.unitCost;
      delete item.price;
      delete item.maintenancePrice;
      delete item.termPrices;
    }
  }

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
  console.log(`[parse-skus] Successfully generated ${allItems.length} structured SKU records for Edition: [${edition.toUpperCase()}] in ${OUTPUT_JSON_PATH}`);

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
