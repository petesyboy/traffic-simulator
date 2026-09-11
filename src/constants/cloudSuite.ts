/**
 * cloudSuite.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GigaVUE Cloud Suite (VBL) quoting metadata — volume tiers, bundle codes, and
 * the feature coverage matrix. Pricing itself is never hardcoded here: it's
 * always resolved live from the SKU catalogue (src/data/skus.json, ingested
 * from the WWPL) via skuService, so it stays in sync with future price list
 * updates instead of drifting out of date.
 *
 * Feature coverage is sourced directly from the VBL-*-BN-* SKU descriptions in
 * the WWPL (references/WWPL_20260731.xlsx) — not from any secondary source.
 */

export interface CloudSuiteTier {
  code: string;
  label: string;
  /** Perpetual (-PL) licensing is only orderable for these tiers per the WWPL — Telco Service Providers only. */
  perpetualAvailable: boolean;
}

export const CLOUD_SUITE_TIERS: CloudSuiteTier[] = [
  { code: '50T', label: '50 TB/day', perpetualAvailable: false },
  { code: '250T', label: '250 TB/day', perpetualAvailable: true },
  { code: '2500T', label: '2,500 TB/day', perpetualAvailable: true },
  { code: '25KT', label: '25,000 TB/day', perpetualAvailable: false },
];

export type CloudSuiteBundle = 'CORE' | 'NV' | 'SVP';

export const CLOUD_SUITE_BUNDLES: { code: CloudSuiteBundle; label: string }[] = [
  { code: 'CORE', label: 'CoreVUE' },
  { code: 'NV', label: 'NetVUE' },
  { code: 'SVP', label: 'SecureVUE Plus' },
];

export type CloudSuiteSupportLevel = 'eliteInitial' | 'eliteRenewal' | 'enhancedInitial' | 'enhancedRenewal';

/**
 * Standalone software support SKUs required for Perpetual (-PL) Cloud Suite licenses, which — unlike
 * the Monthly Term bundles — do not include Elite-Plus support. Rates (18%/20% Elite, 15%/17% Enhanced)
 * are resolved by pricingEngine.getPercentOfTotalSupportRate() from the same WWPL data.
 */
export const CLOUD_SUITE_SUPPORT_SKUS: Record<CloudSuiteSupportLevel, string> = {
  eliteInitial: 'GSS-FYS-ELT-PSS',
  eliteRenewal: 'GSS-RNL-ELT-PSS',
  enhancedInitial: 'GSS-FYS-ENH-PSS',
  enhancedRenewal: 'GSS-RNL-ENH-PSS',
};

export const CLOUD_SUITE_SUPPORT_LEVEL_LABELS: Record<CloudSuiteSupportLevel, string> = {
  eliteInitial: 'Elite 24x7 — Initial',
  eliteRenewal: 'Elite 24x7 — Renewal',
  enhancedInitial: 'Enhanced 8x5 — Initial',
  enhancedRenewal: 'Enhanced 8x5 — Renewal',
};

export interface CloudSuiteFeatureRow {
  name: string;
  CORE: boolean;
  NV: boolean;
  SVP: boolean;
}

export const CLOUD_SUITE_FEATURES: CloudSuiteFeatureRow[] = [
  { name: 'Advanced Tunneling', CORE: true, NV: true, SVP: true },
  { name: 'Slicing / Masking', CORE: true, NV: true, SVP: true },
  { name: 'Advanced Load Balancing', CORE: true, NV: true, SVP: true },
  { name: 'De-duplication', CORE: false, NV: true, SVP: true },
  { name: 'NetFlow Generation', CORE: false, NV: true, SVP: true },
  { name: 'App Metadata / App Filtering', CORE: false, NV: false, SVP: true },
  { name: 'OOB TLS/SSL Decryption', CORE: false, NV: false, SVP: true },
  { name: 'Precryption', CORE: false, NV: false, SVP: true },
  { name: 'Gigamon Enriched Metadata (Cloud Workloads)', CORE: false, NV: false, SVP: true },
];

/** Builds the VBL SKU for a given tier, bundle, and licensing model. */
export function buildCloudSuiteSku(tierCode: string, bundle: CloudSuiteBundle, perpetual: boolean): string {
  return `VBL-${tierCode}-BN-${bundle}${perpetual ? '-PL' : ''}`;
}
