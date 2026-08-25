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

  if (
    t === 'license' ||
    t === 'software' ||
    s.includes('-SW-') ||
    s.includes('-TM') ||
    s.startsWith('CLS-') ||
    s.startsWith('GEM-') ||
    s.startsWith('VUE-') ||
    d.includes('license') ||
    d.includes('licence') ||
    d.includes('term license')
  ) {
    return 'Software';
  }

  if (t === 'support' || s.startsWith('SPT-') || d.includes('support') || d.includes('maintenance')) {
    return 'Support';
  }

  if (
    t === 'chassis' ||
    s.startsWith('GVS-') ||
    s.startsWith('GSW-') ||
    d.includes('chassis') ||
    d.includes('node') ||
    d.includes('traffic aggregator')
  ) {
    return 'Chassis';
  }

  if (
    t === 'tap' ||
    s.startsWith('GTP-') ||
    s.startsWith('TAP-') ||
    s.startsWith('PNL-') ||
    s.startsWith('M100') ||
    s.startsWith('M200') ||
    s.startsWith('ULT-') ||
    d.includes('tap') ||
    d.includes('breakout panel') ||
    d.includes('rack mount tray')
  ) {
    return 'TAP';
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

  const term = item.termMonths && item.termMonths > 0 ? item.termMonths : 1;
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

    const isMonthly = Boolean(
      skuItem?.listPriceMonthly !== undefined ||
        row.sku.includes('-SW-TM') ||
        row.sku.endsWith('-TM') ||
        (row.term && parseInt(row.term, 10) > 0),
    );

    let unitListPrice = 0;
    if (isMonthly && skuItem?.listPriceMonthly !== undefined) {
      unitListPrice = skuItem.listPriceMonthly;
    } else if (skuItem?.listPrice !== undefined) {
      unitListPrice = skuItem.listPrice;
    }

    const termMonths = row.term ? parseInt(row.term, 10) : defaultTermDuration;

    return {
      id: `bom-${row.sku}-${idx}`,
      sku: row.sku,
      description: row.description || skuItem?.description || row.sku,
      type: row.type,
      category,
      qty: row.qty,
      termMonths: isMonthly ? termMonths : undefined,
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
    skuItem?.listPriceMonthly !== undefined || sku.includes('-SW-TM') || sku.endsWith('-TM'),
  );

  let unitListPrice = 0;
  if (isMonthly && skuItem?.listPriceMonthly !== undefined) {
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
