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
import { saveWithFilePickerOrPrompt, type SaveFileResult } from './fileSaveHelper';
import { getStandardExportFilename } from './exportNaming';

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
  isPriceOverridden?: boolean;
  isCustomOrAdHoc?: boolean;
  site?: string;
  nodeId?: string;
  note?: string;
  linkType?: 'tap-termination';
  inclInSupport?: boolean;
}

export interface CreateQuoteItemsOptions {
  includeAhr?: boolean;
  includeFmPrime?: boolean;
  includeELearning?: boolean;
  chassisCount?: number;
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

/**
 * Analyzes English language description semantics to determine if an item is a Software Licence.
 */
export function isSoftwareLicenseDescription(description: string): boolean {
  const d = (description || '').toLowerCase().trim();
  return (
    d.startsWith('monthly subscription license') ||
    d.startsWith('monthly term license') ||
    d.startsWith('perpetual license') ||
    d.startsWith('feature license') ||
    d.startsWith('license for') ||
    d.startsWith('software license') ||
    d.startsWith('upgrade sku') ||
    d.startsWith('bundle of gigasmart applications') ||
    d.startsWith('gigasmart bundle upgrade') ||
    d.startsWith('monthly gigavue-os term license') ||
    d.startsWith('for telecommunications service providers only. perpetual license') ||
    d.includes('perpetual license for') ||
    d.includes('monthly subscription license for') ||
    d.includes('monthly term license for') ||
    d.includes('feature license per gigasmart') ||
    d.includes('license to upgrade') ||
    d.includes('software support at desired level must be purchased separately')
  );
}

/**
 * Analyzes English language description semantics to determine if an item is physical Hardware.
 */
export function isHardwareDescription(description: string): boolean {
  const d = (description || '').toLowerCase().trim();
  return (
    d.includes('hardware only') ||
    d.includes('cages') ||
    d.includes('sfp+ cages') ||
    d.includes('qsfp28 cages') ||
    d.includes('qsfp+ cages') ||
    d.startsWith('port module') ||
    d.startsWith('bypass combo module') ||
    d.startsWith('bypass module') ||
    d.startsWith('control card') ||
    d.startsWith('filter assembly') ||
    d.startsWith('fan tray') ||
    d.startsWith('rack mount') ||
    d.startsWith('gigavue-fm hardware appliance') ||
    d.startsWith('gigavue-hct chassis') ||
    d.startsWith('gigavue-hc') ||
    d.startsWith('gigavue-ta') ||
    d.startsWith('gen3 gigasmart, gigavue-hc3, module')
  );
}

/** Identifies whether a SKU is a percent-of-total support SKU (e.g. GSS-HW-AHR-GMO). */
export function isPercentOfTotalSupportSku(sku: string): boolean {
  const s = (sku || '').trim().toUpperCase();
  return s === 'GSS-HW-AHR-GMO' || s.startsWith('GSS-HW-AHR');
}

/**
 * Resolves the percentage rate for percent-of-total support SKUs.
 * GSS-HW-AHR-GMO is 41.0% (5-year / 60-month all-in AHR term: Years 1-3 @ 8%/yr = 24%, Years 4-5 @ 8.5%/yr = 17%).
 */
export function getPercentOfTotalSupportRate(sku: string): number {
  const s = (sku || '').trim().toUpperCase();
  if (s === 'GSS-HW-AHR-GMO' || s.startsWith('GSS-HW-AHR')) {
    return 0.41;
  }
  return 0;
}

/**
 * Identifies whether a line item is an eligible support-enabled hardware product (Chassis or Module).
 * In Gigamon CPQ / WWPL, percent-of-total hardware support (AHR) covers active chassis and physical modules/control cards.
 */
export function isSupportEnabledHardware(category: QuoteCategory, sku: string): boolean {
  const s = (sku || '').trim().toUpperCase();

  // Exclude non-hardware lines:
  // - AHR and other support SKUs
  // - Software subscriptions (-SW-TM, -TM) and perpetual feature licenses
  // - Professional services & training (GES-*, GSS-SVC-*)
  // - Optics / transceivers (Optic category, SFP-*, QSF-*, Q28-*, etc.)
  // - Cables (CBL-*), power cords (PCD-*), fans (FAN-*), power supplies (PWR-*), rack kits (RCK-*)
  // - Passive optical TAPs & trays (TAP category, TAP-*)
  if (
    category === 'Software' ||
    category === 'Support' ||
    category === 'Optic' ||
    category === 'TAP' ||
    category === 'Accessory' ||
    category === 'Other' ||
    s.includes('-SW-') ||
    s.includes('-TM') ||
    s.endsWith('-PL') ||
    s.startsWith('CBL-') ||
    s.startsWith('PCD-') ||
    s.startsWith('GES-') ||
    s.startsWith('GSS-') ||
    s.startsWith('FAN-') ||
    s.startsWith('PWR-') ||
    s.startsWith('RCK-') ||
    s.startsWith('TAP-') ||
    isPercentOfTotalSupportSku(s)
  ) {
    return false;
  }

  // Active hardware chassis and physical modules / control cards
  return category === 'Chassis' || category === 'Module';
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

  // 2. Power cords & Basic Power Accessories
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

  // 4. Hardware Chassis (evaluates before generic software rules)
  if (
    t === 'chassis' ||
    ((s.startsWith('GVS-') || s.startsWith('GSW-') || s.startsWith('GFM-HW')) && !s.includes('-SW-') && !s.includes('-TM') && !s.endsWith('-PL')) ||
    (s.endsWith('-HW') && (s.startsWith('GVS-') || s.startsWith('GSW-') || s.startsWith('GFM-'))) ||
    (!s.includes('-SW-') && !s.includes('-TM') && isHardwareDescription(d) && (d.includes('chassis') || d.includes('appliance')))
  ) {
    return 'Chassis';
  }

  // 5. Hardware Modules & Control Cards (physical line cards, bypass modules, and base modules)
  if (
    (s.endsWith('-HW') && (s.startsWith('PRT-') || s.startsWith('SMT-') || s.startsWith('BPS-') || s.startsWith('CTL-') || s.startsWith('CCV-'))) ||
    ((s.startsWith('PRT-') || s.startsWith('BPS-') || s.startsWith('CTL-') || s.startsWith('CCV-') || s === 'SMT-HC3-C08' || s === 'SMT-HC3-C05' || s === 'SMT-HC0-X16' || s === 'SMT-HC1-S' || s === 'SMT-HC0-Q02X08') &&
      !s.includes('-SW-') &&
      !s.includes('-TM') &&
      !s.endsWith('-PL')) ||
    (!s.includes('-SW-') && !s.includes('-TM') && !s.endsWith('-PL') && isHardwareDescription(d) && !isSoftwareLicenseDescription(d)) ||
    t === 'module'
  ) {
    return 'Module';
  }

  // 6. Software Licences (GigaSMART feature licenses, term software, capacity licenses, and license descriptions)
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
    isSoftwareLicenseDescription(d)
  ) {
    return 'Software';
  }

  // 7. Standalone Support & Maintenance (e.g. SPT-)
  if (
    t === 'support' ||
    s.startsWith('SPT-') ||
    s.startsWith('GSS-') ||
    s.startsWith('GSP-') ||
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
  eligibleHardwareListTotal?: number,
): CalculatedLineItem {
  // Always dynamically re-resolve category so loaded quote items or stale state are guaranteed 100% accurate
  const resolvedCategory = mapBomTypeToQuoteCategory(item.category || item.type, item.sku, item.description);
  const normalizedItem: QuoteLineItem = item.category !== resolvedCategory ? { ...item, category: resolvedCategory } : item;

  const isMonthly =
    normalizedItem.isMonthlyPrice ||
    (normalizedItem.category === 'Software' && (normalizedItem.sku.includes('-SW-TM') || normalizedItem.sku.endsWith('-TM')));

  // In SPAN-only mode, TAP termination links require only 1 optic per link instead of 2 (halve optic
  // quantity) - but only for optics actually tagged as terminating a TAP link. Other 'Optic' category
  // rows (chassis-to-chassis uplinks, GigaSMART/module board optics, tool ingest optics) are unrelated
  // to the TAP<->SPAN conversion and must pass through at full quantity.
  const effectiveQty =
    spanOnlyMode && normalizedItem.linkType === 'tap-termination'
      ? Math.max(1, Math.ceil((normalizedItem.qty || 0) / 2))
      : (normalizedItem.qty || 0);

  const isPercentOfTotal = isPercentOfTotalSupportSku(normalizedItem.sku);
  let dynamicUnitList = normalizedItem.unitListPrice || 0;
  let dynamicNote = normalizedItem.note;

  if (isPercentOfTotal && !normalizedItem.isPriceOverridden && eligibleHardwareListTotal !== undefined) {
    const rate = getPercentOfTotalSupportRate(normalizedItem.sku);
    const computedTotal = Math.round(eligibleHardwareListTotal * rate * 100) / 100;
    dynamicUnitList = effectiveQty > 0 ? computedTotal / effectiveQty : computedTotal;
    dynamicNote = `41.0% of Covered Hardware List Price (${formatCurrency(eligibleHardwareListTotal)})`;
  }

  const term = isMonthly && normalizedItem.termMonths && normalizedItem.termMonths > 0 ? normalizedItem.termMonths : 1;
  const effectiveUnitList = dynamicUnitList * (isMonthly ? term : 1);
  const extendedListPrice = isPercentOfTotal && !normalizedItem.isPriceOverridden && eligibleHardwareListTotal !== undefined
    ? Math.round(eligibleHardwareListTotal * getPercentOfTotalSupportRate(normalizedItem.sku) * 100) / 100
    : effectiveUnitList * effectiveQty;

  const effectiveDiscountPercent = resolveLineDiscount(normalizedItem, config, freePowerCords);
  const discountAmount = extendedListPrice * (effectiveDiscountPercent / 100);
  const extendedNetPrice = Math.max(0, extendedListPrice - discountAmount);
  const unitNetPrice = effectiveQty > 0 ? extendedNetPrice / effectiveQty : 0;

  const inclInSupport = isSupportEnabledHardware(resolvedCategory, normalizedItem.sku);

  return {
    ...normalizedItem,
    category: resolvedCategory,
    unitListPrice: dynamicUnitList,
    note: dynamicNote,
    qty: effectiveQty,
    inclInSupport,
    effectiveDiscountPercent,
    effectiveUnitList,
    extendedListPrice,
    discountAmount,
    extendedNetPrice,
    unitNetPrice,
  };
}

/** Generates initial quote items array from BOM rows, with optional CPQ service and promo additions. */
export function createQuoteItemsFromBom(
  bomRows: BomRow[],
  defaultTermDuration: number = 12,
  options: CreateQuoteItemsOptions = {},
): QuoteLineItem[] {
  const items: QuoteLineItem[] = bomRows.map((row, idx) => {
    const skuItem = skuService.getSKUByPartNumber(row.sku);
    const category = mapBomTypeToQuoteCategory(row.type, row.sku, row.description || skuItem?.description);

    const skuStr = row.sku || '';
    const isTermSku = skuStr.includes('-SW-TM') || skuStr.endsWith('-TM');
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
    const inclInSupport = isSupportEnabledHardware(category, row.sku);

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
      inclInSupport,
      site: row.site,
      nodeId: row.nodeId,
      note: row.note,
      linkType: row.linkType,
    };
  });

  // 1. Optional Advanced Hardware Replacement (GSS-HW-AHR-GMO, 60m at 41% of eligible hardware list price)
  if (options.includeAhr && !items.some((i) => i.sku === 'GSS-HW-AHR-GMO')) {
    const hasEligibleHw = items.some((i) => isSupportEnabledHardware(i.category, i.sku));
    if (hasEligibleHw) {
      items.push({
        id: `bom-ahr-${Date.now()}`,
        sku: 'GSS-HW-AHR-GMO',
        description:
          'Gigamon Advance Hardware Replacement with direct Gigamon support, available with Subscription enabled hardware products at time of product purchase.',
        type: 'Support',
        category: 'Support',
        qty: 1,
        termMonths: 60,
        unitListPrice: 0, // Dynamically computed at 41% of covered hardware
        isMonthlyPrice: false,
        applyDiscount: true,
        discountOverride: 15, // Standard CPQ 15% discount for AHR
        note: '60 months',
      });
    }
  }

  // 2. Optional GigaVUE-FM Prime 36m Promotional License (100% Discount -> $0.00 Net)
  if (options.includeFmPrime && !items.some((i) => i.sku.startsWith('GFM-FM000-SW-TM'))) {
    const term = defaultTermDuration || 36;
    const skuRecord = skuService.getSKUByPartNumber('GFM-FM000-SW-TM');
    const monthlyList = skuRecord?.listPriceMonthly || 2310.0;
    items.push({
      id: `bom-fm-prime-${Date.now()}`,
      sku: 'GFM-FM000-SW-TM',
      description:
        skuRecord?.description ||
        'Monthly term license for GigaVUE-FM Prime Edition, manage up to 1,000 Physical Visibility Fabric Nodes. Includes Bundled Elite-Plus Software Support.',
      type: 'Software',
      category: 'Software',
      qty: 1,
      termMonths: term,
      unitListPrice: monthlyList,
      isMonthlyPrice: true,
      applyDiscount: true,
      discountOverride: 100, // 100% Promotional Discount ($0 Net)
      note: `${term} months`,
    });
  }

  // 3. Optional Gigamon Academy eLearning Voucher Promo (100% Discount -> $0.00 Net)
  if (options.includeELearning && !items.some((i) => i.sku === 'GES-LMS-ACD')) {
    const chassisCount =
      options.chassisCount ??
      items
        .filter((i) => i.category === 'Chassis')
        .reduce((sum, c) => sum + (c.qty || 1), 0);
    const voucherQty = Math.max(1, chassisCount);
    const skuRecord = skuService.getSKUByPartNumber('GES-LMS-ACD');
    items.push({
      id: `bom-elearning-${Date.now()}`,
      sku: 'GES-LMS-ACD',
      description:
        skuRecord?.description ||
        'Single user access to an eLearning Voucher for the Gigamon Academy e-learning curriculum for a one-year term.',
      type: 'Other',
      category: 'Other',
      qty: voucherQty,
      unitListPrice: skuRecord?.listPrice || 1495.0,
      isMonthlyPrice: false,
      applyDiscount: true,
      discountOverride: 100, // 100% Promotional Discount ($0 Net)
    });
  }

  return items;
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

  // 3. Compute total list price of eligible support-enabled hardware lines (Chassis + Modules)
  const eligibleHardwareListTotal = activeRawItems.reduce((sum, rawItem) => {
    const resolvedCat = mapBomTypeToQuoteCategory(rawItem.category || rawItem.type, rawItem.sku, rawItem.description);
    if (isSupportEnabledHardware(resolvedCat, rawItem.sku)) {
      const hwLine = calculateLineFinancials(rawItem, config, freePowerCords, spanOnlyMode);
      return sum + (hwLine.extendedListPrice || 0);
    }
    return sum;
  }, 0);

  // 4. Compute line financials with eligibleHardwareListTotal passed in
  const calculatedItems = activeRawItems.map((item) =>
    calculateLineFinancials(item, config, freePowerCords, spanOnlyMode, eligibleHardwareListTotal),
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
export async function exportQuoteToCsv(
  items: QuoteLineItem[],
  config: DiscountCategoryConfig,
  excludeOptics: boolean,
  freePowerCords: boolean = false,
  spanOnlyMode: boolean = false,
  scenarioName?: string,
): Promise<SaveFileResult> {
  const summary = calculateQuoteSummary(items, config, excludeOptics, freePowerCords, spanOnlyMode);

  const escapeCsv = (str: string) => `"${String(str ?? '').replace(/"/g, '""')}"`;

  const headers = [
    'Category',
    'SKU',
    'Description',
    'Qty',
    'Term (Months)',
    'Unit List Price',
    'Cost Before Discount',
    'Discount %',
    'Discount Amount',
    'Cost After Discount',
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
  const defaultFilename = getStandardExportFilename('quote-csv', scenarioName);

  return saveWithFilePickerOrPrompt(csvContent, defaultFilename, {
    description: 'Commercial Quote CSV File',
    mimeType: 'text/csv',
    extension: '.csv',
  });
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
export async function exportCommercialQuoteToJson(
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
): Promise<SaveFileResult> {
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
  const defaultFilename = getStandardExportFilename('quote-json', metadata.scenarioName);

  return saveWithFilePickerOrPrompt(jsonString, defaultFilename, {
    description: 'Commercial Quote JSON File',
    mimeType: 'application/json',
    extension: '.json',
  });
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

