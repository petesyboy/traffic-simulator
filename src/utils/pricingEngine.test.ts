import { describe, it, expect } from 'vitest';
import {
  mapBomTypeToQuoteCategory,
  resolveLineDiscount,
  calculateLineFinancials,
  calculateQuoteSummary,
  createQuoteItemsFromBom,
  createAdHocQuoteItem,
  resolveLicenseModeSku,
  convertQuoteItemLicenseMode,
  convertQuoteItemsLicenseMode,
  DEFAULT_DISCOUNT_CONFIG,
  parseCommercialQuoteJson,
  type QuoteLineItem,
  type DiscountCategoryConfig,
} from './pricingEngine';
import type { BomRow } from './bom/bomGenerator';

describe('pricingEngine', () => {
  describe('mapBomTypeToQuoteCategory', () => {
    it('correctly categorises transceivers, cables, and optics', () => {
      expect(mapBomTypeToQuoteCategory('Optic', 'SFP-532', '10G Transceiver')).toBe('Optic');
      expect(mapBomTypeToQuoteCategory('Hardware', 'QSB-523T', 'BiDi Transceiver')).toBe('Optic');
      expect(mapBomTypeToQuoteCategory('Hardware', 'CBL-503', 'Active Optical Cable')).toBe('Optic');
    });

    it('correctly categorises software licences', () => {
      expect(mapBomTypeToQuoteCategory('License', 'BPS-HC1-D25A60-SW-TM', 'Monthly Term License')).toBe('Software');
      expect(mapBomTypeToQuoteCategory('Software', 'CLS-TAC20', 'Advanced Features License')).toBe('Software');
      expect(mapBomTypeToQuoteCategory('Hardware', 'GEM-2500G-4G-SW-TM', 'Enriched Metadata License')).toBe('Software');
    });

    it('correctly categorises chassis and switches', () => {
      expect(mapBomTypeToQuoteCategory('Chassis', 'GVS-HC301', 'GigaVUE-HC3 Chassis')).toBe('Chassis');
      expect(mapBomTypeToQuoteCategory('Hardware', 'GVS-TAX20', 'GigaVUE-TA25 Traffic Aggregator')).toBe('Chassis');
    });

    it('correctly categorises modules and hardware line cards', () => {
      expect(mapBomTypeToQuoteCategory('Module', 'PRT-HC3-C16', '16-Port 100G Module')).toBe('Module');
      expect(mapBomTypeToQuoteCategory('Hardware', 'SMT-HC0-X16', 'GigaSMART Module')).toBe('Module');
      expect(mapBomTypeToQuoteCategory('Hardware', 'BPS-HC3-C25F2G', 'Bypass Module')).toBe('Module');
      expect(
        mapBomTypeToQuoteCategory(
          'License',
          'PRT-HC3-X24-HW',
          'Port Module, GigaVUE-HC3, 24x10G/1G SFP+ cages. Hardware only. Must pair with appropriate GigaVUE-OS Software License.',
        ),
      ).toBe('Module');
      expect(
        mapBomTypeToQuoteCategory(
          'License',
          'SMT-HC3-C08-HW',
          'Gen3 GigaSMART, GigaVUE-HC3, Module, 8x100G/40G QSFP28 cages. Hardware only. Must pair with appropriate GigaVUE-OS Software License.',
        ),
      ).toBe('Module');
      expect(
        mapBomTypeToQuoteCategory(
          'Hardware',
          'UNKNOWN-PORT-MOD',
          'Port Module with 16x 10G SFP+ cages. Hardware only.',
        ),
      ).toBe('Module');
    });

    it('correctly uses English description semantics to differentiate software licenses vs hardware', () => {
      // Software license descriptions
      expect(
        mapBomTypeToQuoteCategory('Other', 'CUSTOM-LIC-01', 'Perpetual license for GigaSMART Advanced Flow Slicing'),
      ).toBe('Software');
      expect(
        mapBomTypeToQuoteCategory('Other', 'CUSTOM-LIC-02', 'Monthly subscription license for SSL Decryption'),
      ).toBe('Software');
      expect(
        mapBomTypeToQuoteCategory('Other', 'CUSTOM-LIC-03', 'Feature license per GigaSMART module, Maximum subscribers'),
      ).toBe('Software');

      // Hardware descriptions
      expect(
        mapBomTypeToQuoteCategory('Other', 'CUSTOM-HW-01', 'Bypass Combo Module, 2 40/100Gb SR4 BPS pairs, 16 10G cages'),
      ).toBe('Module');
      expect(
        mapBomTypeToQuoteCategory('Other', 'CUSTOM-CHASSIS-01', 'GigaVUE-HC3 chassis, fan tray, 2 power supplies, AC power'),
      ).toBe('Chassis');
    });

    it('correctly categorises TAPs and breakout panels', () => {
      expect(mapBomTypeToQuoteCategory('TAP', 'GTP-M100T', 'Rack Tray')).toBe('TAP');
      expect(mapBomTypeToQuoteCategory('TAP', 'PNL-M341', 'Breakout Panel')).toBe('TAP');
      expect(mapBomTypeToQuoteCategory('Hardware', 'TAP-M253', 'Multimode TAP')).toBe('TAP');
    });
  });

  describe('resolveLineDiscount', () => {
    const config: DiscountCategoryConfig = {
      global: 10,
      software: 25,
      optics: 15,
      chassis: 20,
      modules: 18,
      taps: 12,
      support: 5,
      accessories: 8,
    };

    const makeItem = (category: QuoteLineItem['category'], applyDiscount = true, discountOverride?: number): QuoteLineItem => ({
      id: 'test-1',
      sku: 'TEST-SKU',
      description: 'Test Description',
      type: category,
      category,
      qty: 2,
      unitListPrice: 1000,
      isMonthlyPrice: false,
      applyDiscount,
      discountOverride,
    });

    it('applies category-specific discounts when configured', () => {
      expect(resolveLineDiscount(makeItem('Software'), config)).toBe(25);
      expect(resolveLineDiscount(makeItem('Optic'), config)).toBe(15);
      expect(resolveLineDiscount(makeItem('Chassis'), config)).toBe(20);
      expect(resolveLineDiscount(makeItem('Module'), config)).toBe(18);
      expect(resolveLineDiscount(makeItem('TAP'), config)).toBe(12);
      expect(resolveLineDiscount(makeItem('Support'), config)).toBe(5);
    });

    it('falls back to global discount when category discount is 0', () => {
      const zeroCatConfig: DiscountCategoryConfig = { ...config, software: 0 };
      expect(resolveLineDiscount(makeItem('Software'), zeroCatConfig)).toBe(10);
    });

    it('respects per-line discount override', () => {
      expect(resolveLineDiscount(makeItem('Chassis', true, 40), config)).toBe(40);
      expect(resolveLineDiscount(makeItem('Software', true, 0), config)).toBe(0);
    });

    it('returns 0 when applyDiscount is false (selective hardware exclusion)', () => {
      expect(resolveLineDiscount(makeItem('Chassis', false), config)).toBe(0);
      expect(resolveLineDiscount(makeItem('Chassis', false, 30), config)).toBe(0);
    });
  });

  describe('calculateLineFinancials', () => {
    const config: DiscountCategoryConfig = {
      global: 10,
      software: 20,
      optics: 0,
      chassis: 0,
      modules: 0,
      taps: 0,
      support: 0,
      accessories: 0,
    };

    it('calculates perpetual hardware financials correctly', () => {
      const item: QuoteLineItem = {
        id: '1',
        sku: 'GVS-TAC20',
        description: 'Chassis',
        type: 'Chassis',
        category: 'Chassis',
        qty: 2,
        unitListPrice: 10000,
        isMonthlyPrice: false,
        applyDiscount: true,
      };

      const result = calculateLineFinancials(item, config);
      expect(result.effectiveUnitList).toBe(10000);
      expect(result.extendedListPrice).toBe(20000);
      expect(result.effectiveDiscountPercent).toBe(10); // fallback to global
      expect(result.discountAmount).toBe(2000);
      expect(result.extendedNetPrice).toBe(18000);
      expect(result.unitNetPrice).toBe(9000);
    });

    it('calculates monthly term license financials with term duration multiplier', () => {
      const item: QuoteLineItem = {
        id: '2',
        sku: 'CLS-TAC20-SW-TM',
        description: 'Monthly License',
        type: 'License',
        category: 'Software',
        qty: 3,
        termMonths: 36,
        unitListPrice: 200,
        isMonthlyPrice: true,
        applyDiscount: true,
      };

      const result = calculateLineFinancials(item, config);
      // Unit list for 36 months = 200 * 36 = 7200
      expect(result.effectiveUnitList).toBe(7200);
      // Extended list = 7200 * 3 = 21600
      expect(result.extendedListPrice).toBe(21600);
      // Discount = 20% on software
      expect(result.effectiveDiscountPercent).toBe(20);
      expect(result.discountAmount).toBe(4320);
      expect(result.extendedNetPrice).toBe(17280);
      expect(result.unitNetPrice).toBe(5760);
    });
  });

  describe('calculateQuoteSummary and optics exclusion', () => {
    const config: DiscountCategoryConfig = {
      global: 0,
      software: 30,
      optics: 10,
      chassis: 0,
      modules: 0,
      taps: 0,
      support: 0,
      accessories: 0,
    };

    const items: QuoteLineItem[] = [
      {
        id: '1',
        sku: 'GVS-HC3',
        description: 'HC3 Chassis',
        type: 'Chassis',
        category: 'Chassis',
        qty: 1,
        unitListPrice: 20000,
        isMonthlyPrice: false,
        applyDiscount: true,
      },
      {
        id: '2',
        sku: 'SFP-532',
        description: '10G Optic',
        type: 'Optic',
        category: 'Optic',
        qty: 10,
        unitListPrice: 500,
        isMonthlyPrice: false,
        applyDiscount: true,
      },
      {
        id: '3',
        sku: 'SW-LIC',
        description: 'Term Software',
        type: 'License',
        category: 'Software',
        qty: 1,
        termMonths: 12,
        unitListPrice: 1000,
        isMonthlyPrice: true,
        applyDiscount: true,
      },
    ];

    it('summarises entire quote when optics are included', () => {
      const summary = calculateQuoteSummary(items, config, false);
      expect(summary.activeLineCount).toBe(3);
      // List: 20000 (Chassis) + 5000 (Optics) + 12000 (Software: 1000*12) = 37000
      expect(summary.totalListPrice).toBe(37000);
      // Discounts: 0 (Chassis) + 500 (10% Optics) + 3600 (30% of 12000) = 4100
      expect(summary.totalDiscountAmount).toBe(4100);
      expect(summary.totalNetPrice).toBe(32900);
      expect(summary.categoryBreakdown.Optic.totalQty).toBe(10);
      expect(summary.opticsExcluded).toBe(false);
    });

    it('excludes all optics when excludeOptics is true', () => {
      const summary = calculateQuoteSummary(items, config, true);
      expect(summary.activeLineCount).toBe(2);
      expect(summary.allLineCount).toBe(3);
      // List: 20000 (Chassis) + 12000 (Software) = 32000
      expect(summary.totalListPrice).toBe(32000);
      // Discounts: 3600 (Software)
      expect(summary.totalDiscountAmount).toBe(3600);
      expect(summary.totalNetPrice).toBe(28400);
      expect(summary.categoryBreakdown.Optic.totalQty).toBe(0);
      expect(summary.opticsExcluded).toBe(true);
    });

    it('applies 100% discount ONLY on the 8 eligible TA/HC power cords when freePowerCords is true', () => {
      const itemsWithCords: QuoteLineItem[] = [
        {
          id: '1',
          sku: 'GVS-HC3',
          description: 'HC3 Chassis',
          type: 'Chassis',
          category: 'Chassis',
          qty: 1,
          unitListPrice: 20000,
          isMonthlyPrice: false,
          applyDiscount: true,
        },
        {
          id: '2',
          sku: 'PCD-00005', // Eligible UK plug cord
          description: 'Power Cord, UK plug',
          type: 'Dependency',
          category: 'Accessory',
          qty: 2,
          unitListPrice: 35,
          isMonthlyPrice: false,
          applyDiscount: true,
        },
        {
          id: '3',
          sku: 'PCD-00051', // Ineligible DC cord
          description: 'Power cord, D-SUB DC power connector',
          type: 'Dependency',
          category: 'Accessory',
          qty: 2,
          unitListPrice: 50,
          isMonthlyPrice: false,
          applyDiscount: true,
        },
      ];

      const normalSummary = calculateQuoteSummary(itemsWithCords, config, false, false);
      const normalUkCord = normalSummary.items.find((i) => i.sku === 'PCD-00005');
      expect(normalUkCord?.qty).toBe(2);
      expect(normalUkCord?.effectiveDiscountPercent).toBe(0);
      expect(normalUkCord?.extendedNetPrice).toBe(70);

      const freeCordSummary = calculateQuoteSummary(itemsWithCords, config, false, true);
      const freeUkCord = freeCordSummary.items.find((i) => i.sku === 'PCD-00005');
      const dcCord = freeCordSummary.items.find((i) => i.sku === 'PCD-00051');

      // Eligible UK cord receives 100% discount
      expect(freeUkCord?.qty).toBe(2); // Quantity preserved!
      expect(freeUkCord?.extendedListPrice).toBe(70);
      expect(freeUkCord?.effectiveDiscountPercent).toBe(100);
      expect(freeUkCord?.discountAmount).toBe(70);
      expect(freeUkCord?.extendedNetPrice).toBe(0); // Free of charge ($0 net)

      // Ineligible DC cord does not receive auto 100% discount
      expect(dcCord?.effectiveDiscountPercent).toBe(0);
      expect(dcCord?.extendedNetPrice).toBe(100);

      expect(freeCordSummary.freePowerCords).toBe(true);
    });

    it('removes all TAPs & trays and halves TAP optics when spanOnlyMode is true', () => {
      const mixedItems: QuoteLineItem[] = [
        {
          id: '1',
          sku: 'GVS-HC3',
          description: 'HC3 Chassis',
          type: 'Chassis',
          category: 'Chassis',
          qty: 1,
          unitListPrice: 20000,
          isMonthlyPrice: false,
          applyDiscount: true,
        },
        {
          id: '2',
          sku: 'GTP-M100T',
          description: 'M100T TAP Tray',
          type: 'Hardware',
          category: 'TAP',
          qty: 1,
          unitListPrice: 1500,
          isMonthlyPrice: false,
          applyDiscount: true,
        },
        {
          id: '3',
          sku: 'TAP-M253',
          description: 'Single-mode Optical TAP Module',
          type: 'TAP',
          category: 'TAP',
          qty: 3,
          unitListPrice: 1200,
          isMonthlyPrice: false,
          applyDiscount: true,
        },
        {
          id: '4',
          sku: 'SFP-532',
          description: '10G Multimode SFP+ Transceiver',
          type: 'Optic',
          category: 'Optic',
          qty: 8, // 8 optics for 4 tapped links
          unitListPrice: 500,
          isMonthlyPrice: false,
          applyDiscount: true,
          linkType: 'tap-termination',
        },
      ];

      // Normal mode with TAPs
      const tapSummary = calculateQuoteSummary(mixedItems, config, false, false, false);
      expect(tapSummary.activeLineCount).toBe(4);
      expect(tapSummary.items.find((i) => i.sku === 'GTP-M100T')).toBeDefined();
      expect(tapSummary.items.find((i) => i.sku === 'TAP-M253')).toBeDefined();
      expect(tapSummary.items.find((i) => i.sku === 'SFP-532')?.qty).toBe(8);

      // SPAN-only mode
      const spanSummary = calculateQuoteSummary(mixedItems, config, false, false, true);
      expect(spanSummary.activeLineCount).toBe(2); // Only Chassis and halved Optics remain
      expect(spanSummary.items.find((i) => i.sku === 'GTP-M100T')).toBeUndefined();
      expect(spanSummary.items.find((i) => i.sku === 'TAP-M253')).toBeUndefined();
      expect(spanSummary.categoryBreakdown.TAP.itemCount).toBe(0);
      expect(spanSummary.categoryBreakdown.TAP.totalQty).toBe(0);

      // Optics quantity is halved (8 / 2 = 4 for single SPAN feed per link)
      const spanOptic = spanSummary.items.find((i) => i.sku === 'SFP-532');
      expect(spanOptic?.qty).toBe(4);
      expect(spanOptic?.extendedListPrice).toBe(2000); // 4 * 500 = 2000
      expect(spanSummary.spanOnlyMode).toBe(true);
    });

    it('does not halve Optic-category rows that are not tagged as TAP-termination', () => {
      // e.g. a chassis-to-chassis interconnect uplink or a GigaSMART/module board optic -
      // these share the 'Optic' category with real TAP-termination optics but aren't
      // eligible for the SPAN-only halving rule.
      const unrelatedOptics: QuoteLineItem[] = [
        {
          id: '1',
          sku: 'QSF-502T',
          description: '40G Chassis Interconnect Uplink',
          type: 'Optic',
          category: 'Optic',
          qty: 2,
          unitListPrice: 800,
          isMonthlyPrice: false,
          applyDiscount: true,
        },
      ];

      const spanSummary = calculateQuoteSummary(unrelatedOptics, DEFAULT_DISCOUNT_CONFIG, false, false, true);
      expect(spanSummary.items.find((i) => i.sku === 'QSF-502T')?.qty).toBe(2);
    });
  });

  describe('createAdHocQuoteItem', () => {
    it('creates an ad-hoc line item with catalogue data and specified quantity', () => {
      const item = createAdHocQuoteItem('SFP-532', 4, 12);
      expect(item.sku).toBe('SFP-532');
      expect(item.qty).toBe(4);
      expect(item.category).toBe('Optic');
      expect(item.isCustomOrAdHoc).toBe(true);
    });
  });

  describe('parseCommercialQuoteJson', () => {
    it('successfully parses and restores a customized commercial quote JSON', () => {
      const samplePayload = JSON.stringify({
        version: '1.0',
        type: 'commercial-quote',
        savedAt: '2026-08-26T10:00:00.000Z',
        scenarioName: 'Tusass Greenland 5G Core',
        projectLicenseMode: 'HTL',
        defaultTermDuration: '36',
        projectRegion: 'EU',
        items: [
          {
            id: 'item-1',
            sku: 'VUE-FM0-001',
            description: 'GigaVUE Fabric Manager Prime',
            category: 'Software',
            qty: 2,
            unitListPrice: 15000,
            isMonthlyPrice: false,
            applyDiscount: true,
            discountOverride: 40,
            isCustomOrAdHoc: true,
          },
          {
            id: 'item-2',
            sku: 'GVS-HC3A1-HW',
            description: 'GigaVUE-HC3 Base Chassis',
            category: 'Chassis',
            qty: 2,
            unitListPrice: 22645,
            isMonthlyPrice: false,
            applyDiscount: true,
          },
        ],
        discountConfig: {
          global: 10,
          software: 35,
          chassis: 20,
          modules: 15,
          optics: 10,
          taps: 10,
          support: 0,
          accessories: 0,
        },
        rawDiscountInputs: {
          global: '10',
          software: '35',
          chassis: '20',
          modules: '15',
          optics: '10',
          taps: '10',
          support: '0',
          accessories: '0',
        },
        excludeOptics: true,
        freePowerCords: true,
        spanOnlyMode: false,
      });

      const parsed = parseCommercialQuoteJson(samplePayload);
      expect(parsed.type).toBe('commercial-quote');
      expect(parsed.scenarioName).toBe('Tusass Greenland 5G Core');
      expect(parsed.excludeOptics).toBe(true);
      expect(parsed.freePowerCords).toBe(true);
      expect(parsed.items.length).toBe(2);

      const fm = parsed.items.find((i) => i.sku === 'VUE-FM0-001');
      expect(fm).toBeDefined();
      expect(fm?.qty).toBe(2);
      expect(fm?.discountOverride).toBe(40);
      expect(fm?.isCustomOrAdHoc).toBe(true);

      expect(parsed.discountConfig.software).toBe(35);
      expect(parsed.discountConfig.chassis).toBe(20);
    });

    it('throws meaningful error on invalid JSON string or missing items', () => {
      expect(() => parseCommercialQuoteJson('bad-json')).toThrow(/Invalid JSON/);
      expect(() => parseCommercialQuoteJson(JSON.stringify({ version: '1.0' }))).toThrow(/missing items array/);
    });
  });

  describe('Licence Mode Switching (Perpetual vs HTL)', () => {
    it('creates perpetual quote items without term multiplier and with full perpetual capital price', () => {
      const perpetualBomRows: BomRow[] = [
        { sku: 'GVS-HC3A1', qty: 1, description: 'GigaVUE-HC3 Chassis AC (2 PSUs)', type: 'Chassis' },
        { sku: 'SMT-HC3-C08', qty: 1, description: 'GigaSMART HC3 Module', type: 'Module' },
        { sku: 'UPG-TAC20', qty: 1, description: 'TA200 Port Upgrade License', type: 'License' },
        { sku: 'PCD-00001', qty: 2, description: 'Power Cord', type: 'Dependency' },
      ];

      const quoteItems = createQuoteItemsFromBom(perpetualBomRows, 12);
      expect(quoteItems).toHaveLength(4);

      const hc3 = quoteItems.find((i) => i.sku === 'GVS-HC3A1');
      expect(hc3?.isMonthlyPrice).toBe(false);
      expect(hc3?.termMonths).toBeUndefined();
      expect(hc3?.unitListPrice).toBe(22645);

      const upg = quoteItems.find((i) => i.sku === 'UPG-TAC20');
      expect(upg?.isMonthlyPrice).toBe(false);
      expect(upg?.termMonths).toBeUndefined();
      expect(upg?.unitListPrice).toBe(25485);

      // Financial calculations must use term multiplier of 1
      const calculated = calculateLineFinancials(upg!, DEFAULT_DISCOUNT_CONFIG);
      expect(calculated.extendedListPrice).toBe(25485);
    });

    it('creates HTL quote items with term months and monthly pricing for -SW-TM licenses', () => {
      const htlBomRows: BomRow[] = [
        { sku: 'GVS-HC3A1-HW', qty: 1, description: 'GigaVUE-HC3 Base Chassis (HW Only)', type: 'Chassis' },
        { sku: 'GVS-HC3A0-SW-TM', qty: 1, description: 'HC3 GigaVUE-OS Software Term License', type: 'License', term: '36' },
        { sku: 'UPG-TAC20-SW-TM', qty: 1, description: 'TA200 Port Upgrade Term License', type: 'License', term: '36' },
      ];

      const quoteItems = createQuoteItemsFromBom(htlBomRows, 36);

      const hw = quoteItems.find((i) => i.sku === 'GVS-HC3A1-HW');
      expect(hw?.isMonthlyPrice).toBe(false);
      expect(hw?.termMonths).toBeUndefined();

      const sw = quoteItems.find((i) => i.sku === 'GVS-HC3A0-SW-TM');
      expect(sw?.isMonthlyPrice).toBe(true);
      expect(sw?.termMonths).toBe(36);
      expect(sw?.unitListPrice).toBe(2365); // monthly list price

      const upgTm = quoteItems.find((i) => i.sku === 'UPG-TAC20-SW-TM');
      expect(upgTm?.isMonthlyPrice).toBe(true);
      expect(upgTm?.termMonths).toBe(36);
      expect(upgTm?.unitListPrice).toBe(995); // $995/mo

      const calculatedSw = calculateLineFinancials(sw!, DEFAULT_DISCOUNT_CONFIG);
      expect(calculatedSw.effectiveUnitList).toBe(2365 * 36);
      expect(calculatedSw.extendedListPrice).toBe(2365 * 36);
    });
  });

  describe('License Mode Conversions (HTL <-> Perpetual Preservation)', () => {
    it('correctly maps SKUs between HTL and Perpetual', () => {
      // SMT feature licenses
      expect(resolveLicenseModeSku('SMT-HC3-GEN3-FVU-SW-TM', 'Perpetual')).toBe('SMT-HC3-GEN3-FVU');
      expect(resolveLicenseModeSku('SMT-HC3-GEN3-FVU', 'HTL')).toBe('SMT-HC3-GEN3-FVU-SW-TM');
      expect(resolveLicenseModeSku('SMT-HC3-GEN3-GTPMAX-SW-TM', 'Perpetual')).toBe('SMT-HC3-GEN3-GTPMAX');
      expect(resolveLicenseModeSku('SMT-HC3-GEN3-GTPMAX', 'HTL')).toBe('SMT-HC3-GEN3-GTPMAX-SW-TM');
      expect(resolveLicenseModeSku('SMT-HC1P-GEN3-FVU-SW-TM', 'Perpetual')).toBe('SMT-HC1P-GEN3-FVU-PL');
      expect(resolveLicenseModeSku('SMT-HC1P-GEN3-FVU-PL', 'HTL')).toBe('SMT-HC1P-GEN3-FVU-SW-TM');

      // Port upgrade licenses
      expect(resolveLicenseModeSku('UPG-TAC40EA-SW-TM', 'Perpetual')).toBe('UPG-TAC40EA');
      expect(resolveLicenseModeSku('UPG-TAC40EA', 'HTL')).toBe('UPG-TAC40EA-SW-TM');

      // Hardware and optics must remain unchanged
      expect(resolveLicenseModeSku('SFP-532T', 'Perpetual')).toBe('SFP-532T');
      expect(resolveLicenseModeSku('SFP-532T', 'HTL')).toBe('SFP-532T');
      expect(resolveLicenseModeSku('PNL-M341', 'Perpetual')).toBe('PNL-M341');
      expect(resolveLicenseModeSku('PCD-00001', 'HTL')).toBe('PCD-00001');
    });

    it('converts ad-hoc HTL item to Perpetual preserving quantity and discount override', () => {
      const htlItem: QuoteLineItem = {
        id: 'adhoc-1',
        sku: 'SMT-HC3-GEN3-FVU-SW-TM',
        description: 'Monthly FlowVUE',
        type: 'License',
        category: 'Software',
        qty: 2,
        termMonths: 24,
        unitListPrice: 2145,
        isMonthlyPrice: true,
        applyDiscount: true,
        discountOverride: 35,
        isCustomOrAdHoc: true,
      };

      const perpItem = convertQuoteItemLicenseMode(htlItem, 'Perpetual', 24);
      expect(perpItem.sku).toBe('SMT-HC3-GEN3-FVU');
      expect(perpItem.isMonthlyPrice).toBe(false);
      expect(perpItem.termMonths).toBeUndefined();
      expect(perpItem.unitListPrice).toBe(25000);
      expect(perpItem.qty).toBe(2);
      expect(perpItem.discountOverride).toBe(35);
      expect(perpItem.isCustomOrAdHoc).toBe(true);
    });

    it('converts ad-hoc Perpetual item to HTL setting monthly term pricing', () => {
      const perpItem: QuoteLineItem = {
        id: 'adhoc-2',
        sku: 'SMT-HC3-GEN3-GTPMAX',
        description: 'Perpetual GTP Max',
        type: 'License',
        category: 'Software',
        qty: 1,
        unitListPrice: 45000,
        isMonthlyPrice: false,
        applyDiscount: true,
        discountOverride: 20,
        isCustomOrAdHoc: true,
      };

      const htlItem = convertQuoteItemLicenseMode(perpItem, 'HTL', 36);
      expect(htlItem.sku).toBe('SMT-HC3-GEN3-GTPMAX-SW-TM');
      expect(htlItem.isMonthlyPrice).toBe(true);
      expect(htlItem.termMonths).toBe(36);
      expect(htlItem.unitListPrice).toBe(4260);
      expect(htlItem.qty).toBe(1);
      expect(htlItem.discountOverride).toBe(20);
      expect(htlItem.isCustomOrAdHoc).toBe(true);
    });

    it('convertQuoteItemsLicenseMode preserves all ad-hoc items and customizations when switching modes', () => {
      const prevItems: QuoteLineItem[] = [
        {
          id: 'bom-1',
          sku: 'GVS-HC3A1-HW',
          description: 'HC3 Chassis HW',
          type: 'Chassis',
          category: 'Chassis',
          qty: 1,
          unitListPrice: 22645,
          isMonthlyPrice: false,
          applyDiscount: true,
          discountOverride: 15,
        },
        {
          id: 'bom-2',
          sku: 'GVS-HC3A0-SW-TM',
          description: 'HC3 Base SW Term',
          type: 'License',
          category: 'Software',
          qty: 1,
          termMonths: 12,
          unitListPrice: 2365,
          isMonthlyPrice: true,
          applyDiscount: true,
        },
        {
          id: 'adhoc-custom-1',
          sku: 'SMT-HC3-GEN3-FVU-SW-TM',
          description: 'FlowVUE Term',
          type: 'License',
          category: 'Software',
          qty: 3,
          termMonths: 12,
          unitListPrice: 2145,
          isMonthlyPrice: true,
          applyDiscount: true,
          discountOverride: 40,
          isCustomOrAdHoc: true,
        },
        {
          id: 'adhoc-custom-2',
          sku: 'SFP-532T',
          description: '10G Transceiver',
          type: 'Transceiver',
          category: 'Optic',
          qty: 8,
          unitListPrice: 400,
          isMonthlyPrice: false,
          applyDiscount: true,
          isCustomOrAdHoc: true,
        },
      ];

      const newPerpBomItems: QuoteLineItem[] = [
        {
          id: 'bom-1-perp',
          sku: 'GVS-HC3A1',
          description: 'HC3 Chassis Base Perpetual',
          type: 'Chassis',
          category: 'Chassis',
          qty: 1,
          unitListPrice: 22645,
          isMonthlyPrice: false,
          applyDiscount: true,
        },
      ];

      const converted = convertQuoteItemsLicenseMode(prevItems, newPerpBomItems, 'Perpetual', 12);

      // Should include BOM chassis with preserved 15% discountOverride
      const chassis = converted.find((i) => i.sku === 'GVS-HC3A1');
      expect(chassis).toBeDefined();
      expect(chassis?.discountOverride).toBe(15);

      // Should include converted FlowVUE perpetual license with preserved qty 3 and 40% discount
      const fvu = converted.find((i) => i.sku === 'SMT-HC3-GEN3-FVU');
      expect(fvu).toBeDefined();
      expect(fvu?.qty).toBe(3);
      expect(fvu?.unitListPrice).toBe(25000);
      expect(fvu?.isMonthlyPrice).toBe(false);
      expect(fvu?.discountOverride).toBe(40);
      expect(fvu?.isCustomOrAdHoc).toBe(true);

      // Should include the custom optic intact
      const optic = converted.find((i) => i.sku === 'SFP-532T');
      expect(optic).toBeDefined();
      expect(optic?.qty).toBe(8);
      expect(optic?.unitListPrice).toBe(400);
      expect(optic?.isCustomOrAdHoc).toBe(true);
    });

    it('resolves GFM-FM000-SW-TM (and GFM-FM000-SWTM) with monthly list price of $2310/mo', () => {
      const gfmItem = createAdHocQuoteItem('GFM-FM000-SW-TM', 1, 12);
      expect(gfmItem.isMonthlyPrice).toBe(true);
      expect(gfmItem.unitListPrice).toBe(2310);
      expect(gfmItem.termMonths).toBe(12);

      const gfmVariant = createAdHocQuoteItem('GFM-FM000-SWTM', 1, 36);
      expect(gfmVariant.isMonthlyPrice).toBe(true);
      expect(gfmVariant.unitListPrice).toBe(2310);
      expect(gfmVariant.termMonths).toBe(36);
    });
  });
});
