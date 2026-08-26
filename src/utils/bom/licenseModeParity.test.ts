import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { CustomNode } from '../../store/types';
import { generateBom, type BomRow } from './bomGenerator';
import { buildProjectWideOpticBom } from './opticPacks';
import { consolidateSimpleDeviceRows } from './consolidateSimpleDevices';
import { createQuoteItemsFromBom } from '../pricingEngine';
import { getSkus } from './skuUtils';

/**
 * Regression coverage for the "flip Perpetual <-> HTL and the solution must stay
 * the same" invariant: switching globalLicenseMode changes which SKUs represent
 * the licence (single combined SKU vs. split -HW/-SW-TM per skuResolver.ts), but
 * must never change what hardware is actually being quoted - same chassis count,
 * same modules, same TAPs, same optics, same dependencies.
 *
 * Five scenarios of increasing complexity (S1 simple -> S5 full stack), each
 * generating a BOM under both license modes and diffing them against that
 * invariant, plus cross-checking every SKU against the generated price list
 * (src/data/skus.json via getSkus()) so the list stays the single source of truth.
 */

const node = (id: string, type: CustomNode['type'], data: Record<string, unknown>): CustomNode =>
  ({ id, type, position: { x: 0, y: 0 }, data }) as CustomNode;

const PHYSICAL_TYPES: BomRow['type'][] = ['Chassis', 'Module', 'TAP', 'Optic', 'Dependency', 'Hardware'];

/** Strips the HTL-only '-HW' suffix so a chassis/module SKU compares equal across modes. */
function normalizeHwSku(sku: string): string {
  return sku.endsWith('-HW') ? sku.slice(0, -3) : sku;
}

function qtyBySku(rows: BomRow[], type: BomRow['type'], normalize: boolean): Record<string, number> {
  const map: Record<string, number> = {};
  rows
    .filter((r) => r.type === type)
    .forEach((r) => {
      const key = normalize ? normalizeHwSku(r.sku) : r.sku;
      map[key] = (map[key] || 0) + r.qty;
    });
  return map;
}

/** Total physical unit count across all non-License row types - the headline "did the hardware change" number. */
function totalPhysicalUnits(rows: BomRow[]): number {
  return rows.filter((r) => PHYSICAL_TYPES.includes(r.type)).reduce((sum, r) => sum + r.qty, 0);
}

function assertNoUnknownSkus(rows: BomRow[], label: string) {
  const unknown = rows.filter((r) => r.description === 'Unknown SKU' || r.description?.startsWith('Unknown SKU'));
  expect(unknown, `${label}: found rows with no price-list match: ${unknown.map((r) => r.sku).join(', ')}`).toEqual([]);
}

/** Every SKU in the BOM must resolve to a real, priced catalogue entry - skus.json is the single source of truth. */
function assertAllSkusPriced(rows: BomRow[], label: string) {
  const skus = getSkus();
  const missing = rows.filter((r) => !skus[r.sku]);
  expect(missing, `${label}: SKUs missing from the generated price list: ${missing.map((r) => r.sku).join(', ')}`).toEqual([]);
}

/** Chassis/Module/TAP/Optic/Dependency rows must be identical (after -HW normalization) between license modes. */
function assertHardwareParity(perpetualBom: BomRow[], htlBom: BomRow[], label: string) {
  (['Chassis', 'Module'] as BomRow['type'][]).forEach((type) => {
    const perp = qtyBySku(perpetualBom, type, true);
    const htl = qtyBySku(htlBom, type, true);
    expect(htl, `${label}: ${type} rows differ between HTL and Perpetual beyond the -HW suffix`).toEqual(perp);
  });

  (['TAP', 'Optic', 'Dependency'] as BomRow['type'][]).forEach((type) => {
    const perp = qtyBySku(perpetualBom, type, false);
    const htl = qtyBySku(htlBom, type, false);
    expect(htl, `${label}: ${type} rows differ between HTL and Perpetual - these must never be licence-mode dependent`).toEqual(perp);
  });

  expect(totalPhysicalUnits(htlBom), `${label}: total physical unit count changed between license modes`).toBe(
    totalPhysicalUnits(perpetualBom),
  );
}

/** Every HTL 'License' row for a monthly SKU must carry a term; Perpetual's equivalent must not be a -SW-TM SKU. */
function assertLicenseRowShape(bom: BomRow[], mode: 'HTL' | 'Perpetual', label: string) {
  const licenseRows = bom.filter((r) => r.type === 'License');
  licenseRows.forEach((r) => {
    const isTermSku = r.sku.includes('-SW-TM') || r.sku.endsWith('-TM');
    if (mode === 'HTL') {
      expect(isTermSku, `${label}: HTL license row ${r.sku} is not a -SW-TM/-TM subscription SKU`).toBe(true);
      expect(r.term, `${label}: HTL license row ${r.sku} has no term duration set`).toBeTruthy();
    } else {
      expect(isTermSku, `${label}: Perpetual license row ${r.sku} unexpectedly uses a subscription SKU`).toBe(false);
    }
  });
}

describe('License mode parity (Perpetual <-> HTL) - S1 through S5', () => {
  it('S1 - simple: one TAP feeding one chassis', () => {
    const nodes: CustomNode[] = [
      node('tap-1', 'hardwareNode', {
        label: 'TAP-M251T', model: 'TAP-M251T', sku: 'TAP-M251T',
        tappedLinksCount: 1, tappedLinkAllocations: [{ qty: 1, optic: 'SFP-532' }],
      }),
      node('hc-1', 'hardwareNode', { label: 'HC1-Plus', model: 'GigaVUE-HC1-Plus' }),
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'tap-1', target: 'hc-1' } as Edge];

    const perp = generateBom(nodes, edges, 'Perpetual', '12', 'US');
    const htl = generateBom(nodes, edges, 'HTL', '12', 'US');

    assertNoUnknownSkus(perp, 'S1 Perpetual');
    assertNoUnknownSkus(htl, 'S1 HTL');
    assertAllSkusPriced(perp, 'S1 Perpetual');
    assertAllSkusPriced(htl, 'S1 HTL');
    assertHardwareParity(perp, htl, 'S1');
    assertLicenseRowShape(perp, 'Perpetual', 'S1');
    assertLicenseRowShape(htl, 'HTL', 'S1');

    // Sanity: this is really exercising the TAP-termination doubling rule (1 link -> 2 optics).
    expect(qtyBySku(htl, 'Optic', false)).toEqual(qtyBySku(perp, 'Optic', false));
    const opticTotal = Object.values(qtyBySku(htl, 'Optic', false)).reduce((a, b) => a + b, 0);
    expect(opticTotal).toBe(2);

    // HTL must have split the chassis into -HW + -SW-TM; Perpetual must not.
    expect(htl.some((r) => r.sku === 'GVS-HC1P1-HW')).toBe(true);
    expect(htl.some((r) => r.sku === 'GVS-HC1P-SW-TM')).toBe(true);
    expect(perp.some((r) => r.sku === 'GVS-HC1P1')).toBe(true);
    expect(perp.some((r) => r.sku.includes('-SW-TM'))).toBe(false);
  });

  it('S2 - GigaSMART apps on a single HC3 (Packet Slicing + Deduplication)', () => {
    const nodes: CustomNode[] = [
      node('hc3-1', 'hardwareNode', { label: 'HC3', model: 'GigaVUE-HC3' }),
      node('gs-slice', 'gigaSmartNode', { label: 'Slicing', actionType: 'Packet Slicing' }),
      node('gs-dedup', 'gigaSmartNode', { label: 'Dedup', actionType: 'Deduplication' }),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'hc3-1', target: 'gs-slice' } as Edge,
      { id: 'e2', source: 'hc3-1', target: 'gs-dedup' } as Edge,
    ];

    const perp = generateBom(nodes, edges, 'Perpetual', '12', 'US');
    const htl = generateBom(nodes, edges, 'HTL', '12', 'US');

    assertNoUnknownSkus(perp, 'S2 Perpetual');
    assertNoUnknownSkus(htl, 'S2 HTL');
    assertAllSkusPriced(perp, 'S2 Perpetual');
    assertAllSkusPriced(htl, 'S2 HTL');
    assertHardwareParity(perp, htl, 'S2');
    assertLicenseRowShape(perp, 'Perpetual', 'S2');
    assertLicenseRowShape(htl, 'HTL', 'S2');

    // Packet Slicing and AFS must never be conflated regardless of license mode.
    expect(htl.some((r) => r.sku.includes('AFS'))).toBe(false);
    expect(perp.some((r) => r.sku.includes('AFS'))).toBe(false);
    expect(htl.some((r) => r.sku.includes('APF'))).toBe(true);
    expect(perp.some((r) => r.sku.includes('APF'))).toBe(true);

    // Same number of GigaSMART app-feature licenses in both modes (2: slicing + dedup, SMT- prefixed),
    // just different SKU shape. HTL legitimately adds one extra row Perpetual doesn't have - the base
    // chassis OS licence (GVS-HC3A0-SW-TM) is its own License-type row under HTL, whereas Perpetual
    // bundles that licensing into the single Chassis-type hardware row - so total License-row *count*
    // is expected to differ by exactly that one row, and is asserted separately below.
    const appLicenseSkus = (rows: BomRow[]) => rows.filter((r) => r.type === 'License' && r.sku.startsWith('SMT-'));
    expect(appLicenseSkus(htl).length).toBe(appLicenseSkus(perp).length);
    expect(perp.filter((r) => r.type === 'License').length).toBe(2);
    expect(htl.filter((r) => r.type === 'License').length).toBe(3);
  });

  it('S3 - two chassis with a TA<->HC interconnect uplink', () => {
    const nodes: CustomNode[] = [
      node('ta-1', 'hardwareNode', { label: 'TA25E', model: 'GigaVUE-TA25E' }),
      node('hc3-1', 'hardwareNode', { label: 'HC3', model: 'GigaVUE-HC3' }),
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'ta-1', target: 'hc3-1' } as Edge];

    const perp = generateBom(nodes, edges, 'Perpetual', '12', 'US');
    const htl = generateBom(nodes, edges, 'HTL', '12', 'US');

    assertNoUnknownSkus(perp, 'S3 Perpetual');
    assertNoUnknownSkus(htl, 'S3 HTL');
    assertAllSkusPriced(perp, 'S3 Perpetual');
    assertAllSkusPriced(htl, 'S3 HTL');
    assertHardwareParity(perp, htl, 'S3');
    assertLicenseRowShape(perp, 'Perpetual', 'S3');
    assertLicenseRowShape(htl, 'HTL', 'S3');

    // The interconnect uplink optic (one per side) must exist and be untouched by license mode.
    const perpOptics = qtyBySku(perp, 'Optic', false);
    const htlOptics = qtyBySku(htl, 'Optic', false);
    expect(Object.keys(perpOptics).length).toBeGreaterThan(0);
    expect(htlOptics).toEqual(perpOptics);
  });

  it('S4 - multi-site, multi-node aggregation with a breakout panel and multipack rollup', () => {
    const nodes: CustomNode[] = [
      // Site A: one HC3 fed by two TAP-M251T modules (10 optics each -> 20 total, exactly one SFP-532T-20P pack)
      node('hc3-a', 'hardwareNode', { label: 'HC3 (Site A)', model: 'GigaVUE-HC3', site: 'Site A' }),
      node('tap-a1', 'hardwareNode', {
        label: 'TAP A1', model: 'TAP-M251T', sku: 'TAP-M251T', site: 'Site A',
        tappedLinksCount: 5, tappedLinkAllocations: [{ qty: 5, optic: 'SFP-532' }],
      }),
      node('tap-a2', 'hardwareNode', {
        label: 'TAP A2', model: 'TAP-M251T', sku: 'TAP-M251T', site: 'Site A',
        tappedLinksCount: 5, tappedLinkAllocations: [{ qty: 5, optic: 'SFP-532' }],
      }),
      node('panel-a', 'hardwareNode', { label: 'Breakout Panel A', model: 'PNL-M341T', sku: 'PNL-M341T', site: 'Site A' }),
      // Site B: two TA25E chassis, each fed by its own TAP module
      node('ta-b1', 'hardwareNode', { label: 'TA25E B1', model: 'GigaVUE-TA25E', site: 'Site B' }),
      node('ta-b2', 'hardwareNode', { label: 'TA25E B2', model: 'GigaVUE-TA25E', site: 'Site B' }),
      node('tap-b1', 'hardwareNode', {
        label: 'TAP B1', model: 'TAP-M251T', sku: 'TAP-M251T', site: 'Site B',
        tappedLinksCount: 2, tappedLinkAllocations: [{ qty: 2, optic: 'SFP-532' }],
      }),
      node('tap-b2', 'hardwareNode', {
        label: 'TAP B2', model: 'TAP-M251T', sku: 'TAP-M251T', site: 'Site B',
        tappedLinksCount: 2, tappedLinkAllocations: [{ qty: 2, optic: 'SFP-532' }],
      }),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'tap-a1', target: 'hc3-a' } as Edge,
      { id: 'e2', source: 'tap-a2', target: 'hc3-a' } as Edge,
      { id: 'e3', source: 'tap-b1', target: 'ta-b1' } as Edge,
      { id: 'e4', source: 'tap-b2', target: 'ta-b2' } as Edge,
    ];

    const perpRaw = generateBom(nodes, edges, 'Perpetual', '12', 'US');
    const htlRaw = generateBom(nodes, edges, 'HTL', '12', 'US');

    assertNoUnknownSkus(perpRaw, 'S4 Perpetual (raw)');
    assertNoUnknownSkus(htlRaw, 'S4 HTL (raw)');
    assertAllSkusPriced(perpRaw, 'S4 Perpetual (raw)');
    assertAllSkusPriced(htlRaw, 'S4 HTL (raw)');
    assertHardwareParity(perpRaw, htlRaw, 'S4 (raw, per-site)');

    // Project-wide Master BOM aggregation + multipack rollup, as the quote actually uses it.
    const skus = getSkus();
    const perpMaster = buildProjectWideOpticBom(consolidateSimpleDeviceRows(perpRaw), skus);
    const htlMaster = buildProjectWideOpticBom(consolidateSimpleDeviceRows(htlRaw), skus);

    assertNoUnknownSkus(perpMaster, 'S4 Perpetual (master)');
    assertNoUnknownSkus(htlMaster, 'S4 HTL (master)');
    assertHardwareParity(perpMaster, htlMaster, 'S4 (master, project-wide)');

    // Multipack rollup is a *project-wide* pool (see opticPacks.ts), not per-site: Site A's 20 raw
    // SFP-532 (2 TAPs x 5 links x 2) plus Site B's 8 (2 TAPs x 2 links x 2) = 28 total -> 1 full
    // 20-pack + 8 loose singles, pooled across both sites' chassis even though they're different
    // hardware models (HC3 and TA25E both fall back to the same non-TAA SFP-532 on these boards).
    const pack = perpMaster.find((r) => r.sku === 'SFP-532-20P');
    expect(pack, 'S4: expected a full SFP-532-20P pack from the pooled project-wide TAP-termination optics').toBeDefined();
    expect(pack?.qty).toBe(1);
    expect(pack?.note).toBeUndefined(); // exact multiple of the pack size - no round-up note expected
    const singlesQty = perpMaster.filter((r) => r.sku === 'SFP-532').reduce((sum, r) => sum + r.qty, 0);
    expect(singlesQty).toBe(8);
    expect((pack?.qty || 0) * 20 + singlesQty).toBe(28); // reconciles exactly back to the raw total, no units lost or invented

    // Quote line items: every unit price must come from the real catalogue (never a $0/undefined placeholder).
    const quoteItems = createQuoteItemsFromBom(htlMaster, 12);
    const zeroPriced = quoteItems.filter((i) => !i.unitListPrice || i.unitListPrice <= 0);
    expect(zeroPriced, `S4: quote line items with no catalogue price: ${zeroPriced.map((i) => i.sku).join(', ')}`).toEqual([]);
  });

  it('S5 - full stack: S4 topology + AFS/SSL/GTP GigaSMART, redundant power, DC power cords, advanced features', () => {
    const nodes: CustomNode[] = [
      node('hc3-a', 'hardwareNode', {
        label: 'HC3 (Site A, 4-PSU)', model: 'GigaVUE-HC3', site: 'Site A', psuCount: 4, powerSupply: 'AC',
      }),
      node('tap-a1', 'hardwareNode', {
        label: 'TAP A1', model: 'TAP-M251T', sku: 'TAP-M251T', site: 'Site A',
        tappedLinksCount: 5, tappedLinkAllocations: [{ qty: 5, optic: 'SFP-532' }],
      }),
      node('panel-a', 'hardwareNode', { label: 'Breakout Panel A', model: 'PNL-M341T', sku: 'PNL-M341T', site: 'Site A' }),
      node('gs-afs', 'gigaSmartNode', { label: 'AFS', actionType: 'Advanced Flow Slicing' }),
      node('gs-ssl', 'gigaSmartNode', { label: 'SSL', actionType: 'SSL Decrypt' }),
      node('gs-gtp', 'gigaSmartNode', { label: 'GTP Sampling', actionType: 'GTP Flow Sampling', gtpSamplePercent: 10 }),

      node('ta-b1', 'hardwareNode', {
        label: 'TA25E B1 (DC, Advanced)', model: 'GigaVUE-TA25E', site: 'Site B', powerSupply: 'DC', advancedFeatures: true,
      }),
      node('tap-b1', 'hardwareNode', {
        label: 'TAP B1', model: 'TAP-M251T', sku: 'TAP-M251T', site: 'Site B',
        tappedLinksCount: 2, tappedLinkAllocations: [{ qty: 2, optic: 'SFP-532' }],
      }),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'tap-a1', target: 'hc3-a' } as Edge,
      { id: 'e2', source: 'hc3-a', target: 'gs-afs' } as Edge,
      { id: 'e3', source: 'hc3-a', target: 'gs-ssl' } as Edge,
      { id: 'e4', source: 'hc3-a', target: 'gs-gtp' } as Edge,
      { id: 'e5', source: 'tap-b1', target: 'ta-b1' } as Edge,
    ];

    const perpRaw = generateBom(nodes, edges, 'Perpetual', '36', 'EU');
    const htlRaw = generateBom(nodes, edges, 'HTL', '36', 'EU');

    assertNoUnknownSkus(perpRaw, 'S5 Perpetual (raw)');
    assertNoUnknownSkus(htlRaw, 'S5 HTL (raw)');
    assertAllSkusPriced(perpRaw, 'S5 Perpetual (raw)');
    assertAllSkusPriced(htlRaw, 'S5 HTL (raw)');

    // Regression coverage for a real gap this test found and the price list has since fixed:
    // the Perpetual SSL Decrypt licence (SMT-HC3-GEN3-INSSL-PL) description explicitly says
    // "requires SMT-HC3-C08", which addRow's reqMatch regex parses into a mandatory
    // SMT-HC3-C08 Dependency row - the HC3 Gen3 compute module SSL Decrypt physically needs.
    // Its HTL/term-licence counterpart (SMT-HC3-GEN3-INSSL-SW-TM) was missing that clause in
    // the master price list (references/WWPL_20260731.xlsx, cell C630, and the mirrored
    // references/SKU-List*.csv), so the exact same topology silently dropped that mandatory
    // module from the BOM under HTL only - the same physical solution was valid under
    // Perpetual and invalid under HTL, purely because of a price-list wording gap. Both
    // sources now carry the clause; this guards against it silently regressing.
    const perpRequiresC08 = perpRaw.some((r) => r.sku === 'SMT-HC3-C08');
    const htlRequiresC08 = htlRaw.some((r) => r.sku === 'SMT-HC3-C08');
    expect(perpRequiresC08, 'S5: Perpetual SSL Decrypt should carry its mandatory SMT-HC3-C08 module').toBe(true);
    expect(
      htlRequiresC08,
      'S5: HTL SSL Decrypt must also carry the mandatory SMT-HC3-C08 module (see comment above - this regressed once already via a price-list wording gap)',
    ).toBe(true);

    assertHardwareParity(perpRaw, htlRaw, 'S5 (raw)');
    assertLicenseRowShape(perpRaw, 'Perpetual', 'S5');
    assertLicenseRowShape(htlRaw, 'HTL', 'S5');

    // Redundant 4-PSU chassis must draw 4 power cords in both modes.
    expect(perpRaw.filter((r) => r.type === 'Dependency' && r.sku.startsWith('PCD-')).reduce((s, r) => s + r.qty, 0)).toBe(
      htlRaw.filter((r) => r.type === 'Dependency' && r.sku.startsWith('PCD-')).reduce((s, r) => s + r.qty, 0),
    );

    // AFS, SSL Decrypt, GTP Flow Sampling, and Advanced Features licenses must all be present and distinct, in both modes.
    const licenseSkus = (rows: BomRow[]) => rows.filter((r) => r.type === 'License').map((r) => r.sku);
    expect(perpRaw.some((r) => r.sku.includes('AFS'))).toBe(true);
    expect(htlRaw.some((r) => r.sku.includes('AFS'))).toBe(true);
    expect(new Set(licenseSkus(perpRaw)).size).toBe(licenseSkus(perpRaw).length); // no accidental dupes
    expect(new Set(licenseSkus(htlRaw)).size).toBe(licenseSkus(htlRaw).length);

    // Term multiplier sanity on every monthly line item: extendedListPrice == unitListPrice * term * qty exactly.
    const skus = getSkus();
    const htlMaster = buildProjectWideOpticBom(consolidateSimpleDeviceRows(htlRaw), skus);
    const quoteItems = createQuoteItemsFromBom(htlMaster, 36);
    quoteItems
      .filter((i) => i.isMonthlyPrice)
      .forEach((i) => {
        expect(i.termMonths, `S5: monthly SKU ${i.sku} has no term set`).toBe(36);
      });
  });
});
