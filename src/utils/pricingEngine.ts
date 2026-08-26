/**
 * pricingEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Commercial pricing calculation engine for bills of materials and ad-hoc SKUs.
 *
 * Supports:
 * - Granular category discounting (all software, optics, chassis, modules, support)
 * - Selective line-item discount toggles and custom overrides
 * - One-click complete optics exclusion
 * - Term multiplier calculations for subscription/term licences
 * - Financial summary aggregation and CSV export
 */

import { skuService } from '../services/skuService';
import type { BomRow } from './bom/bomGenerator';

export type QuoteCategory =
  | 'Software'
  | 'Optic'
  | 'Chassis'
  | 'Module'
  | 'TAP'
  | 'Support'
  | 'Accessory'
  | 'Other';

export interface DiscountCategoryConfig {
  global: number;
  software: number;
  optics: number;
  chassis: number;
  modules: number;
  taps: number;
  support: number;
  accessories: number;
}

export const DEFAULT_DISCOUNT_CONFIG: DiscountCategoryConfig = {
  global: 0,
  software: 0,
  optics: 0,
  chassis: 0,
  modules: 0,
  taps: 0,
  support: 0,
  accessories: 0,
};

export interface QuoteLineItem {
  id: string;
  sku: string;
  description: string;
  type: string;
  category: QuoteCategory;
  qty: number;
  termMonths?: number;
  unitListPrice: number;
  isMonthlyPrice: boolean;
  applyDiscount: boolean;
  discountOverride?: number;
  isCustomOrAdHoc?: boolean;
  site?: string;
  nodeId?: string;
  note?: string;
  linkType?: 'tap-termination';
}

export interface CalculatedLineItem extends QuoteLineItem {
  effectiveDiscountPercent: number;
  effectiveUnitList: number;
  extendedListPrice: number;
  discountAmount: number;
  extendedNetPrice: number;
  unitNetPrice: number;
}

export interface CategorySummary {
  category: QuoteCategory;
  itemCount: number;
  totalQty: number;
  listPrice: number;
  discountAmount: number;
  netPrice: number;
}

export interface QuoteSummary {
  items: CalculatedLineItem[];
  allLineCount: number;
  activeLineCount: number;
  totalQty: number;
  totalListPrice: number;
  totalDiscountAmount: number;
  totalNetPrice: number;
  effectiveDiscountPercent: number;
  categoryBreakdown: Record<QuoteCategory, CategorySummary>;
  opticsExcluded: boolean;
  freePowerCords: boolean;
  spanOnlyMode: boolean;
}

/**
 * Exact set of eligible TA and HC power cords:
 * PCD-00003 — EU plug
 * PCD-00005 — UK plug
 * PCD-00007 — AU plug
 * PCD-00009 — JP plug
 * PCD-000R3 — Right-angle EU plug
 * PCD-000R5 — Right-angle UK plug
 * PCD-000R7 — Right-angle AU plug
 * PCD-000R9 — Right-angle JP plug
 */
export const ELIGIBLE_POWER_CORD_SKUS: ReadonlySet<string> = new Set([
  'PCD-00003',
  'PCD-00005',
  'PCD-00007',
  'PCD-00009',
  'PCD-000R3',
  'PCD-000R5',
  'PCD-000R7',
  'PCD-000R9',
]);

/** Checks if a SKU represents one of the 8 eligible TA/HC power cords. */
export function isEligiblePowerCord(sku: string): boolean {
  const s = (sku || '').toUpperCase().trim();
  return ELIGIBLE_POWER_CORD_SKUS.has(s);
}

/** Checks if a SKU or description represents an AC or DC power cord. */
export function isPowerCord(sku: string, description: string = ''): boolean {
  const s = (sku || '').toUpperCase().trim();
  const d = (description || '').toLowerCase();
  return isEligiblePowerCord(s) || s.startsWith('PCD-') || d.includes('power cord');
}

/** Checks if a SKU or description represents a TAP, tray, or breakout panel. */
export function isTapOrTray(sku: string, category: string = '', description: string = ''): boolean {
  const s = (sku || '').toUpperCase().trim();
  const c = (category || '').toLowerCase();
  const d = (description || '').toLowerCase();
  return (
    c === 'tap' ||
    s.startsWith('GTP-') ||
    s.startsWith('TAP-') ||
    s.startsWith('PNL-') ||
    s.startsWith('M100') ||
    s.startsWith('M200') ||
    s.startsWith('ULT-') ||
    d.includes('tap') ||
    d.includes('breakout panel') ||
    d.includes('rack mount tray')
  );
}

/** Determines quote category from SKU, BOM type, and catalogue metadata. */
export function mapBomTypeToQuoteCategory(type: string, sku: string, description: string = ''): QuoteCategory {
  const s = (sku || '').toUpperCase().trim();
  const t = (type || '').toLowerCase();
  const d = (description || '').toLowerCase();

  // 1. Optics & Transceivers
  if (
    t === 'optic' ||
    s.startsWith('SFP-') ||
    s.startsWith('QSF-') ||
    s.startsWith('Q28-') ||
    s.startsWith('QDD-') ||
    s.startsWith('QSB-') ||
    s.startsWith('CBL-') ||
    s.startsWith('OPT-') ||
    d.includes('transceiver') ||
    d.includes('active fiber cable') ||
    d.includes('direct attach copper')
  ) {
    return 'Optic';
  }

  // 2. Power cords & Accessories
  if (isEligiblePowerCord(s) || isPowerCord(s, d)) {
    return 'Other';
  }

  // 3. TAPs, Breakout Panels & Trays
  if (
    t === 'tap' ||
    s.startsWith('GTP-') ||
    s.startsWith('TAP-') ||
    s.startsWith('PNL-') ||
    s.startsWith('M100') ||
    s.startsWith('M200') ||
    s.startsWith('ULT-') ||
    d.includes('tap module') ||
    d.includes('breakout panel') ||
    d.includes('rack mount tray')
  ) {
    return 'TAP';
  }

  // 4. Hardware Chassis (must evaluate BEFORE software because description mentions "Must pair with... Software License")
  if (
    t === 'chassis' ||
    ((s.startsWith('GVS-') || s.startsWith('GSW-') || s.startsWith('GFM-HW')) && !s.includes('-SW-') && !s.includes('-TM') && !s.endsWith('-PL')) ||
    (s.endsWith('-HW') && (s.startsWith('GVS-') || s.startsWith('GSW-') || s.startsWith('GFM-')))
  ) {
    return 'Chassis';
  }

  // 5. Hardware Modules & Control Cards (physical line cards and base modules only, e.g. PRT-, BPS-, CTL-, SMT-HC3-C08-HW, SMT-HC3-C08)
  if (
    (s.endsWith('-HW') && (s.startsWith('PRT-') || s.startsWith('SMT-') || s.startsWith('BPS-') || s.startsWith('CTL-') || s.startsWith('CCV-'))) ||
    ((s.startsWith('PRT-') || s.startsWith('BPS-') || s.startsWith('CTL-') || s.startsWith('CCV-') || s === 'SMT-HC3-C08' || s === 'SMT-HC3-C05' || s === 'SMT-HC0-X16' || s === 'SMT-HC1-S' || s === 'SMT-HC0-Q02X08') &&
      !s.includes('-SW-') &&
      !s.includes('-TM') &&
      !s.endsWith('-PL')) ||
    t === 'module'
  ) {
    return 'Module';
  }

  // 6. Software Licences (GigaSMART feature licenses, term software, capacity licenses)
  if (
    t === 'license' ||
    t === 'software' ||
    s.includes('-SW-') ||
    s.includes('-TM') ||
    s.endsWith('-PL') ||
    s.includes('-GEN3-') ||
    s.includes('-GEN2-') ||
    s.startsWith('CLS-') ||
    s.startsWith('GEM-') ||
    s.startsWith('VUE-') ||
    s.startsWith('UPG-') ||
    s.startsWith('GFM-') ||
    d.includes('term license') ||
    d.includes('subscription license') ||
    d.includes('perpetual license') ||
    d.includes('feature license') ||
    d.includes('license for')
  ) {
    return 'Software';
  }

  // 7. Standalone Support & Maintenance (e.g. SPT-)
  if (
    t === 'support' ||
    s.startsWith('SPT-') ||
    (d.includes('support') && !s.includes('-SW-') && !s.includes('-TM')) ||
    d.includes('maintenance')
  ) {
    return 'Support';
  }

  if (
    t === 'module' ||
    s.startsWith('BPS-') ||
    s.startsWith('PRT-') ||
    s.startsWith('SMT-') ||
    s.startsWith('CCV-') ||
    s.startsWith('CTL-') ||
    d.includes('module') ||
    d.includes('control card')
  ) {
    return 'Module';
  }

  if (
    t === 'accessory' ||
    s.startsWith('FAN-') ||
    s.startsWith('PWR-') ||
    s.startsWith('BAT-') ||
    s.startsWith('RACK-') ||
    s.startsWith('ACC-') ||
    d.includes('power supply') ||
    d.includes('fan assembly') ||
    d.includes('battery')
  ) {
    return 'Accessory';
  }

  return 'Other';
}

/** Resolves effective discount % for a specific item given the category discount configuration. */
export function resolveLineDiscount(
  item: QuoteLineItem,
  config: DiscountCategoryConfig,
  freePowerCords: boolean = false,
): number {
  if (freePowerCords && isEligiblePowerCord(item.sku)) {
    return 100;
  }

  if (!item.applyDiscount) return 0;
  if (item.discountOverride !== undefined && Number.isFinite(item.discountOverride)) {
    return Math.max(0, Math.min(100, item.discountOverride));
  }

  let catDiscount = 0;
  switch (item.category) {
    case 'Software':
      catDiscount = config.software;
      break;
    case 'Optic':
      catDiscount = config.optics;
      break;
    case 'Chassis':
      catDiscount = config.chassis;
      break;
    case 'Module':
      catDiscount = config.modules;
      break;
    case 'TAP':
      catDiscount = config.taps;
      break;
    case 'Support':
      catDiscount = config.support;
      break;
    case 'Accessory':
      catDiscount = config.accessories;
      break;
    case 'Other':
    default:
      catDiscount = config.global;
      break;
  }

  // If a specific category discount was entered (> 0), prefer it; otherwise fallback to global discount
  const finalDiscount = catDiscount > 0 ? catDiscount : config.global;
  return Math.max(0, Math.min(100, finalDiscount || 0));
}

/** Computes financial figures for a single line item. */
export function calculateLineFinancials(
  item: QuoteLineItem,
  config: DiscountCategoryConfig,
  freePowerCords: boolean = false,
  spanOnlyMode: boolean = false,
): CalculatedLineItem {
  const isMonthly =
    item.isMonthlyPrice ||
    (item.category === 'Software' && (item.sku.includes('-SW-TM') || item.sku.endsWith('-TM')));

  // In SPAN-only mode, TAP termination links require only 1 optic per link instead of 2 (halve optic
  // quantity) - but only for optics actually tagged as terminating a TAP link. Other 'Optic' category
  // rows (chassis-to-chassis uplinks, GigaSMART/module board optics, tool ingest optics) are unrelated
  // to the TAP<->SPAN conversion and must pass through at full quantity.
  const effectiveQty =
    spanOnlyMode && item.linkType === 'tap-termination'
      ? Math.max(1, Math.ceil((item.qty || 0) / 2))
      : (item.qty || 0);

  const term = isMonthly && item.termMonths && item.termMonths > 0 ? item.termMonths : 1;
  const effectiveUnitList = (item.unitListPrice || 0) * (isMonthly ? term : 1);
  const extendedListPrice = effectiveUnitList * effectiveQty;

  const effectiveDiscountPercent = resolveLineDiscount(item, config, freePowerCords);
  const discountAmount = extendedListPrice * (effectiveDiscountPercent / 100);
  const extendedNetPrice = Math.max(0, extendedListPrice - discountAmount);
  const unitNetPrice = effectiveQty > 0 ? extendedNetPrice / effectiveQty : 0;

  return {
    ...item,
    qty: effectiveQty,
    effectiveDiscountPercent,
    effectiveUnitList,
    extendedListPrice,
    discountAmount,
    extendedNetPrice,
    unitNetPrice,
  };
}

/** Generates initial quote items array from BOM rows. */
export function createQuoteItemsFromBom(bomRows: BomRow[], defaultTermDuration: number = 12): QuoteLineItem[] {
  return bomRows.map((row, idx) => {
    const skuItem = skuService.getSKUByPartNumber(row.sku);
    const category = mapBomTypeToQuoteCategory(row.type, row.sku, row.description || skuItem?.description);

    const isTermSku = row.sku.includes('-SW-TM') || row.sku.endsWith('-TM');
    const isMonthly = Boolean(
      isTermSku ||
        (row.term &&
          parseInt(row.term, 10) > 0 &&
          skuItem?.listPriceMonthly !== undefined &&
          skuItem.listPriceMonthly > 0 &&
          !skuItem?.listPrice),
    );

    let unitListPrice = 0;
    if (isMonthly && skuItem?.listPriceMonthly !== undefined && skuItem.listPriceMonthly > 0) {
      unitListPrice = skuItem.listPriceMonthly;
    } else if (skuItem?.listPrice !== undefined && skuItem.listPrice > 0) {
      unitListPrice = skuItem.listPrice;
    } else if (skuItem?.listPriceMonthly !== undefined) {
      unitListPrice = skuItem.listPriceMonthly;
    } else if (skuItem?.listPrice !== undefined) {
      unitListPrice = skuItem.listPrice;
    }

    const termMonths = isMonthly ? (row.term ? parseInt(row.term, 10) : defaultTermDuration) : undefined;

    return {
      id: `bom-${row.sku}-${idx}`,
      sku: row.sku,
      description: row.description || skuItem?.description || row.sku,
      type: row.type,
      category,
      qty: row.qty,
      termMonths,
      unitListPrice,
      isMonthlyPrice: isMonthly,
      applyDiscount: true,
      site: row.site,
      nodeId: row.nodeId,
      note: row.note,
      linkType: row.linkType,
    };
  });
}

/** Builds an ad-hoc quote line item for any SKU selected from the catalogue. */
export function createAdHocQuoteItem(sku: string, qty: number = 1, termDuration: number = 12): QuoteLineItem {
  const skuItem = skuService.getSKUByPartNumber(sku);
  const description = skuItem?.description || sku;
  const category = mapBomTypeToQuoteCategory(skuItem?.category || 'Other', sku, description);

  const isMonthly = Boolean(
    sku.includes('-SW-TM') ||
      sku.endsWith('-TM') ||
      (skuItem?.listPriceMonthly !== undefined && skuItem.listPriceMonthly > 0 && !skuItem?.listPrice),
  );

  let unitListPrice = 0;
  if (isMonthly && skuItem?.listPriceMonthly !== undefined && skuItem.listPriceMonthly > 0) {
    unitListPrice = skuItem.listPriceMonthly;
  } else if (skuItem?.listPrice !== undefined && skuItem.listPrice > 0) {
    unitListPrice = skuItem.listPrice;
  } else if (skuItem?.listPriceMonthly !== undefined) {
    unitListPrice = skuItem.listPriceMonthly;
  } else if (skuItem?.listPrice !== undefined) {
    unitListPrice = skuItem.listPrice;
  }

  return {
    id: `adhoc-${sku}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sku: sku.toUpperCase().trim(),
    description,
    type: skuItem?.category || 'Other',
    category,
    qty: Math.max(1, qty),
    termMonths: isMonthly ? termDuration : undefined,
    unitListPrice,
    isMonthlyPrice: isMonthly,
    applyDiscount: true,
    isCustomOrAdHoc: true,
  };
}

/**
 * Maps an SKU to its matching Perpetual SKU if converting to Perpetual,
 * or matching HTL SKU if converting to HTL.
 */
export function resolveLicenseModeSku(
  currentSku: string,
  targetMode: 'HTL' | 'Perpetual',
): string {
  const upper = currentSku.toUpperCase().trim();

  if (targetMode === 'Perpetual') {
    // 1. If ends with -SW-TM, try finding perpetual counterpart
    if (upper.endsWith('-SW-TM')) {
      const base = upper.replace(/-SW-TM$/i, '');
      // Try -PL variant first (e.g. SMT-HC1P-GEN3-FVU-PL, SMT-HC3-GEN3-AFS-PL, SMT-GSA110-AMI-100G-PL)
      const plCandidate = `${base}-PL`;
      if (skuService.getSKUByPartNumber(plCandidate)) {
        return plCandidate;
      }
      // Try base without -SW-TM (e.g. SMT-HC3-GEN3-FVU, SMT-HC3-GEN3-GTPMAX, SMT-HC3-GEN3-APF, UPG-TAC40EA, UPG-TAC20, CLS-TAX20)
      if (skuService.getSKUByPartNumber(base)) {
        return base;
      }
      // Try mapping hardware/chassis prefix if base was like GVS-HC3A0 -> GVS-HC3A1
      if (base.endsWith('-HW')) {
        const pureBase = base.replace(/-HW$/i, '');
        if (skuService.getSKUByPartNumber(pureBase)) return pureBase;
      }
      return base;
    }
    // 2. If ends with -HW, check if base module/chassis without -HW exists in perpetual
    if (upper.endsWith('-HW')) {
      const base = upper.replace(/-HW$/i, '');
      if (skuService.getSKUByPartNumber(base)) {
        return base;
      }
    }
    // Already perpetual or hardware/accessory/optic
    return upper;
  }

  // targetMode === 'HTL'
  if (targetMode === 'HTL') {
    // 1. If ends with -PL, replace with -SW-TM
    if (upper.endsWith('-PL')) {
      const htlCandidate = upper.replace(/-PL$/i, '-SW-TM');
      if (skuService.getSKUByPartNumber(htlCandidate)) {
        return htlCandidate;
      }
      return htlCandidate;
    }
    // 2. If already ends with -SW-TM or -HW, keep as is
    if (upper.endsWith('-SW-TM') || upper.endsWith('-HW')) {
      return upper;
    }
    // 3. Try appending -SW-TM (e.g. SMT-HC3-GEN3-FVU -> SMT-HC3-GEN3-FVU-SW-TM)
    const swTmCandidate = `${upper}-SW-TM`;
    if (skuService.getSKUByPartNumber(swTmCandidate)) {
      return swTmCandidate;
    }
    return upper;
  }

  return upper;
}

/**
 * Converts a single QuoteLineItem between HTL and Perpetual mode,
 * preserving all manual customizations (quantities, discount overrides, ad-hoc status).
 */
export function convertQuoteItemLicenseMode(
  item: QuoteLineItem,
  targetMode: 'HTL' | 'Perpetual',
  targetTermMonths: number = 12,
): QuoteLineItem {
  const targetSku = resolveLicenseModeSku(item.sku, targetMode);
  const isSkuChanged = targetSku !== item.sku;
  const skuRecord = skuService.getSKUByPartNumber(targetSku) || skuService.getSKUByPartNumber(item.sku);

  const isMonthly = Boolean(
    targetMode === 'HTL' &&
      (targetSku.includes('-SW-TM') ||
        targetSku.endsWith('-TM') ||
        (skuRecord?.listPriceMonthly !== undefined && skuRecord.listPriceMonthly > 0 && !skuRecord?.listPrice)),
  );

  let unitListPrice = item.unitListPrice;
  if (isSkuChanged || isMonthly !== item.isMonthlyPrice) {
    if (isMonthly) {
      if (skuRecord?.listPriceMonthly !== undefined && skuRecord.listPriceMonthly > 0) {
        unitListPrice = skuRecord.listPriceMonthly;
      }
    } else {
      // Perpetual mode or non-monthly item
      if (skuRecord?.listPrice !== undefined && skuRecord.listPrice > 0) {
        unitListPrice = skuRecord.listPrice;
      }
    }
  }

  const category = mapBomTypeToQuoteCategory(
    skuRecord?.category || item.category,
    targetSku,
    skuRecord?.description || item.description,
  );

  return {
    ...item,
    sku: targetSku,
    description: isSkuChanged && skuRecord?.description ? skuRecord.description : item.description,
    category,
    isMonthlyPrice: isMonthly,
    termMonths: isMonthly ? (item.termMonths || targetTermMonths) : undefined,
    unitListPrice,
  };
}

/**
 * Converts an entire list of quote line items (including custom / ad-hoc items)
 * when switching between HTL and Perpetual, preserving user edits and ad-hoc additions.
 */
export function convertQuoteItemsLicenseMode(
  prevItems: QuoteLineItem[],
  newBomItems: QuoteLineItem[],
  targetMode: 'HTL' | 'Perpetual',
  targetTermMonths: number = 12,
): QuoteLineItem[] {
  // 1. Separate ad-hoc items and BOM items from prevItems
  const prevAdHocItems = prevItems.filter((it) => it.isCustomOrAdHoc);

  // 2. Convert each ad-hoc item to the target license mode
  const convertedAdHocItems = prevAdHocItems.map((item) =>
    convertQuoteItemLicenseMode(item, targetMode, targetTermMonths),
  );

  // 3. For new BOM items, preserve any user custom discountOverrides or quantity overrides from matching previous BOM items
  const prevBomMap = new Map<string, QuoteLineItem>();
  for (const prev of prevItems) {
    if (!prev.isCustomOrAdHoc) {
      prevBomMap.set(prev.id, prev);
      prevBomMap.set(prev.sku, prev);
      // Also map without suffix
      const baseSku = prev.sku.replace(/-SW-TM$/i, '').replace(/-HW$/i, '').replace(/-PL$/i, '');
      prevBomMap.set(baseSku, prev);
    }
  }

  const mergedBomItems = newBomItems.map((newItem) => {
    const baseNew = newItem.sku.replace(/-SW-TM$/i, '').replace(/-HW$/i, '').replace(/-PL$/i, '');
    const prev = prevBomMap.get(newItem.id) || prevBomMap.get(newItem.sku) || prevBomMap.get(baseNew);
    if (prev) {
      return {
        ...newItem,
        discountOverride: prev.discountOverride,
        applyDiscount: prev.applyDiscount,
      };
    }
    return newItem;
  });

  return [...mergedBomItems, ...convertedAdHocItems];
}

const CATEGORY_LIST: QuoteCategory[] = [
  'Software',
  'Chassis',
  'Module',
  'Optic',
  'TAP',
  'Support',
  'Accessory',
  'Other',
];

/** Aggregates all financial calculations, category breakdowns, and totals. */
export function calculateQuoteSummary(
  items: QuoteLineItem[],
  config: DiscountCategoryConfig,
  excludeOptics: boolean,
  freePowerCords: boolean = false,
  spanOnlyMode: boolean = false,
): QuoteSummary {
  // 1. If SPAN-only mode is active, filter out all TAPs, trays, and breakout panels
  let activeRawItems = spanOnlyMode ? items.filter((i) => !isTapOrTray(i.sku, i.category, i.description)) : items;

  // 2. If optics are excluded, filter out all optics
  if (excludeOptics) {
    activeRawItems = activeRawItems.filter((i) => i.category !== 'Optic');
  }

  // 3. Compute line financials (which halves optic quantities if spanOnlyMode is true and applies 100% discount on power cords if freePowerCords is true)
  const calculatedItems = activeRawItems.map((item) =>
    calculateLineFinancials(item, config, freePowerCords, spanOnlyMode),
  );

  const categoryBreakdown = CATEGORY_LIST.reduce(
    (acc, cat) => {
      acc[cat] = {
        category: cat,
        itemCount: 0,
        totalQty: 0,
        listPrice: 0,
        discountAmount: 0,
        netPrice: 0,
      };
      return acc;
    },
    {} as Record<QuoteCategory, CategorySummary>,
  );

  let totalQty = 0;
  let totalListPrice = 0;
  let totalDiscountAmount = 0;
  let totalNetPrice = 0;

  calculatedItems.forEach((item) => {
    totalQty += item.qty;
    totalListPrice += item.extendedListPrice;
    totalDiscountAmount += item.discountAmount;
    totalNetPrice += item.extendedNetPrice;

    const cat = categoryBreakdown[item.category] || categoryBreakdown['Other'];
    cat.itemCount += 1;
    cat.totalQty += item.qty;
    cat.listPrice += item.extendedListPrice;
    cat.discountAmount += item.discountAmount;
    cat.netPrice += item.extendedNetPrice;
  });

  const effectiveDiscountPercent = totalListPrice > 0 ? (totalDiscountAmount / totalListPrice) * 100 : 0;

  return {
    items: calculatedItems,
    allLineCount: items.length,
    activeLineCount: calculatedItems.length,
    totalQty,
    totalListPrice,
    totalDiscountAmount,
    totalNetPrice,
    effectiveDiscountPercent,
    categoryBreakdown,
    opticsExcluded: excludeOptics,
    freePowerCords,
    spanOnlyMode,
  };
}

/** Formats a numeric currency amount nicely. */
export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);
}

/** Exports quote line items and financial totals to a structured CSV file. */
export function exportQuoteToCsv(
  items: QuoteLineItem[],
  config: DiscountCategoryConfig,
  excludeOptics: boolean,
  freePowerCords: boolean = false,
  spanOnlyMode: boolean = false,
  scenarioName?: string,
): void {
  const summary = calculateQuoteSummary(items, config, excludeOptics, freePowerCords, spanOnlyMode);

  const escapeCsv = (str: string) => `"${String(str ?? '').replace(/"/g, '""')}"`;

  const headers = [
    'Category',
    'SKU',
    'Description',
    'Qty',
    'Term (Months)',
    'Unit List Price',
    'Ext List Price',
    'Discount %',
    'Discount Amount',
    'Ext Net Price',
    'Site / Location',
    'Notes',
  ].join(',');

  const rows = summary.items.map((i) =>
    [
      escapeCsv(i.category),
      escapeCsv(i.sku),
      escapeCsv(i.description),
      i.qty,
      i.termMonths || '',
      i.unitListPrice.toFixed(2),
      i.extendedListPrice.toFixed(2),
      i.effectiveDiscountPercent.toFixed(1) + '%',
      i.discountAmount.toFixed(2),
      i.extendedNetPrice.toFixed(2),
      escapeCsv(i.site || 'Global / Unassigned'),
      escapeCsv(i.note || (i.isCustomOrAdHoc ? 'Ad-hoc SKU' : '')),
    ].join(','),
  );

  const summaryRows = [
    '',
    `Total Extended List Price,,,,,${summary.totalListPrice.toFixed(2)}`,
    `Total Discount Savings,,,,,${summary.totalDiscountAmount.toFixed(2)},(${summary.effectiveDiscountPercent.toFixed(1)}% Overall Discount)`,
    `Total Commercial Net Investment,,,,,${summary.totalNetPrice.toFixed(2)}`,
    '',
    'IMPORTANT DISCLAIMER & NON-BINDING NOTICE: This document and the associated figures represent an indicative illustrative order of magnitude quotation generated as an informal engineering and budgetary aid. It is strictly non-binding and non-contractual. Gigamon is under no obligation to honour indicated quantities configurations part numbers list prices or discount rates. Official binding proposals and terms must be obtained directly through formal Gigamon sales channels and authorised partners.',
  ];

  const csvContent = [headers, ...rows, ...summaryRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanName = scenarioName ? scenarioName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Quote';
  a.download = `Commercial_Quote_${cleanName}.csv`;
  a.click();
}

/** Structured JSON payload for persistent saving and loading of customized commercial quotes. */
export interface CommercialQuoteSaveData {
  version: '1.0';
  type: 'commercial-quote';
  savedAt: string;
  scenarioName: string;
  projectLicenseMode?: string;
  defaultTermDuration?: string;
  projectRegion?: string;
  items: QuoteLineItem[];
  discountConfig: DiscountCategoryConfig;
  rawDiscountInputs?: Record<string, string>;
  excludeOptics: boolean;
  freePowerCords: boolean;
  spanOnlyMode: boolean;
  summarySnapshot?: {
    totalListPrice: number;
    totalDiscountAmount: number;
    totalNetPrice: number;
    effectiveDiscountPercent: number;
    activeLineCount: number;
    totalQty: number;
  };
}

/** Exports the current customized commercial quote as a JSON file. */
export function exportCommercialQuoteToJson(
  items: QuoteLineItem[],
  config: DiscountCategoryConfig,
  rawDiscountInputs: Record<string, string>,
  excludeOptics: boolean,
  freePowerCords: boolean,
  spanOnlyMode: boolean,
  metadata: {
    scenarioName?: string;
    projectLicenseMode?: string;
    defaultTermDuration?: string;
    projectRegion?: string;
  },
): void {
  const summary = calculateQuoteSummary(items, config, excludeOptics, freePowerCords, spanOnlyMode);

  const quoteData: CommercialQuoteSaveData = {
    version: '1.0',
    type: 'commercial-quote',
    savedAt: new Date().toISOString(),
    scenarioName: metadata.scenarioName || 'Solution',
    projectLicenseMode: metadata.projectLicenseMode,
    defaultTermDuration: metadata.defaultTermDuration,
    projectRegion: metadata.projectRegion,
    items,
    discountConfig: config,
    rawDiscountInputs,
    excludeOptics,
    freePowerCords,
    spanOnlyMode,
    summarySnapshot: {
      totalListPrice: summary.totalListPrice,
      totalDiscountAmount: summary.totalDiscountAmount,
      totalNetPrice: summary.totalNetPrice,
      effectiveDiscountPercent: summary.effectiveDiscountPercent,
      activeLineCount: summary.activeLineCount,
      totalQty: summary.totalQty,
    },
  };

  const jsonString = JSON.stringify(quoteData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanName = metadata.scenarioName
    ? metadata.scenarioName.replace(/[^a-zA-Z0-9_-]/g, '_')
    : 'Solution';
  a.download = `${cleanName}_Commercial_Quote.json`;
  a.click();
}

/** Validates and parses imported JSON string into CommercialQuoteSaveData. */
export function parseCommercialQuoteJson(jsonString: string): CommercialQuoteSaveData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON syntax: could not parse file contents.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid quote file: payload must be a valid JSON object.');
  }

  const obj = parsed as Record<string, unknown>;

  // Validate either type marker or items array presence
  if (!Array.isArray(obj.items)) {
    throw new Error('Invalid quote file: missing items array in quotation data.');
  }

  // Validate items structure
  const validatedItems: QuoteLineItem[] = obj.items.map((item: any, idx: number) => {
    if (!item.sku || typeof item.sku !== 'string') {
      throw new Error(`Invalid line item at index ${idx}: missing SKU.`);
    }
    return {
      id: String(item.id || `loaded-item-${idx}-${Date.now()}`),
      sku: String(item.sku),
      description: String(item.description || item.sku),
      type: String(item.type || item.category || 'Other'),
      category: item.category || 'Other',
      qty: Math.max(1, parseInt(item.qty, 10) || 1),
      unitListPrice: Math.max(0, parseFloat(item.unitListPrice) || 0),
      isMonthlyPrice: Boolean(item.isMonthlyPrice),
      termMonths: item.termMonths !== undefined ? parseInt(item.termMonths, 10) : undefined,
      applyDiscount: item.applyDiscount !== undefined ? Boolean(item.applyDiscount) : true,
      discountOverride: item.discountOverride !== undefined && item.discountOverride !== null ? parseFloat(item.discountOverride) : undefined,
      isCustomOrAdHoc: Boolean(item.isCustomOrAdHoc),
      site: item.site ? String(item.site) : undefined,
      note: item.note ? String(item.note) : undefined,
    };
  });

  // Validate discount config
  const rawDiscount = (obj.discountConfig as Record<string, any>) || {};
  const validatedDiscountConfig: DiscountCategoryConfig = {
    global: Math.max(0, Math.min(100, parseFloat(rawDiscount.global) || 0)),
    software: Math.max(0, Math.min(100, parseFloat(rawDiscount.software) || 0)),
    chassis: Math.max(0, Math.min(100, parseFloat(rawDiscount.chassis) || 0)),
    modules: Math.max(0, Math.min(100, parseFloat(rawDiscount.modules) || 0)),
    optics: Math.max(0, Math.min(100, parseFloat(rawDiscount.optics) || 0)),
    taps: Math.max(0, Math.min(100, parseFloat(rawDiscount.taps) || 0)),
    support: Math.max(0, Math.min(100, parseFloat(rawDiscount.support) || 0)),
    accessories: Math.max(0, Math.min(100, parseFloat(rawDiscount.accessories) || 0)),
  };

  return {
    version: '1.0',
    type: 'commercial-quote',
    savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : new Date().toISOString(),
    scenarioName: typeof obj.scenarioName === 'string' ? obj.scenarioName : 'Imported Quote',
    projectLicenseMode: typeof obj.projectLicenseMode === 'string' ? obj.projectLicenseMode : undefined,
    defaultTermDuration: typeof obj.defaultTermDuration === 'string' ? obj.defaultTermDuration : undefined,
    projectRegion: typeof obj.projectRegion === 'string' ? obj.projectRegion : undefined,
    items: validatedItems,
    discountConfig: validatedDiscountConfig,
    rawDiscountInputs: (obj.rawDiscountInputs as Record<string, string>) || {
      global: String(validatedDiscountConfig.global),
      software: String(validatedDiscountConfig.software),
      chassis: String(validatedDiscountConfig.chassis),
      modules: String(validatedDiscountConfig.modules),
      optics: String(validatedDiscountConfig.optics),
      taps: String(validatedDiscountConfig.taps),
      support: String(validatedDiscountConfig.support),
      accessories: String(validatedDiscountConfig.accessories),
    },
    excludeOptics: Boolean(obj.excludeOptics),
    freePowerCords: Boolean(obj.freePowerCords),
    spanOnlyMode: Boolean(obj.spanOnlyMode),
    summarySnapshot: obj.summarySnapshot as any,
  };
}

