import { describe, it, expect } from 'vitest';
import {
  mapBomTypeToQuoteCategory,
  resolveLineDiscount,
  calculateLineFinancials,
  calculateQuoteSummary,
  createAdHocQuoteItem,
  DEFAULT_DISCOUNT_CONFIG,
  parseCommercialQuoteJson,
  type QuoteLineItem,
  type DiscountCategoryConfig,
} from './pricingEngine';

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

    it('correctly categorises modules', () => {
      expect(mapBomTypeToQuoteCategory('Module', 'PRT-HC3-C16', '16-Port 100G Module')).toBe('Module');
      expect(mapBomTypeToQuoteCategory('Hardware', 'SMT-HC0-X16', 'GigaSMART Module')).toBe('Module');
      expect(mapBomTypeToQuoteCategory('Hardware', 'BPS-HC3-C25F2G', 'Bypass Module')).toBe('Module');
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
});
