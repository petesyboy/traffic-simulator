import { describe, it, expect } from 'vitest';
import {
  GIGASMART_BUNDLES,
  ORDERED_BUNDLES,
  isActionInBundle,
  resolveBundleSkus,
} from './gigaSmartBundles';
import { ACTION_TYPES } from './nodeTypes';

describe('GigaSMART Software Bundles', () => {
  it('defines 5 ordered bundles with increasing capabilities', () => {
    expect(ORDERED_BUNDLES).toHaveLength(5);
    expect(ORDERED_BUNDLES.map((b) => b.id)).toEqual([
      'CoreVUE',
      'NetVUE',
      'NetVUE+',
      'SecureVUE',
      'SecureVUE+',
    ]);
  });

  it('verifies CoreVUE bundle composition', () => {
    const core = GIGASMART_BUNDLES.CoreVUE;
    const actionTypes = core.apps.map((a) => a.actionType);
    expect(actionTypes).toContain(ACTION_TYPES.PACKET_SLICING);
    expect(actionTypes).toContain(ACTION_TYPES.MASKING);
    expect(actionTypes).toContain(ACTION_TYPES.HEADER_STRIP);
    expect(actionTypes).toContain(ACTION_TYPES.TUNNEL_DECAP);
    expect(actionTypes).toContain(ACTION_TYPES.SOURCE_ID);
    expect(actionTypes).not.toContain(ACTION_TYPES.DEDUPLICATION);
  });

  it('verifies NetVUE and NetVUE+ bundle compositions', () => {
    const nv = GIGASMART_BUNDLES.NetVUE;
    expect(nv.apps.map((a) => a.actionType)).toContain(ACTION_TYPES.DEDUPLICATION);
    expect(nv.apps.map((a) => a.actionType)).toContain(ACTION_TYPES.NETFLOW_APP);

    const nvp = GIGASMART_BUNDLES['NetVUE+'];
    expect(nvp.apps.map((a) => a.actionType)).toContain(ACTION_TYPES.APPLICATION_FILTERING_INTELLIGENCE);
    expect(nvp.apps.map((a) => a.actionType)).toContain(ACTION_TYPES.ADAPTIVE_PACKET_FILTERING);
    expect(nvp.apps.map((a) => a.actionType)).toContain(ACTION_TYPES.ADVANCED_FLOW_SLICING);
  });

  it('verifies SecureVUE+ bundle has all GigaSMART features enabled', () => {
    const svp = GIGASMART_BUNDLES['SecureVUE+'];
    const actionTypes = svp.apps.map((a) => a.actionType);
    expect(actionTypes).toContain(ACTION_TYPES.PACKET_SLICING);
    expect(actionTypes).toContain(ACTION_TYPES.MASKING);
    expect(actionTypes).toContain(ACTION_TYPES.HEADER_STRIP);
    expect(actionTypes).toContain(ACTION_TYPES.TUNNEL_DECAP);
    expect(actionTypes).toContain(ACTION_TYPES.SOURCE_ID);
    expect(actionTypes).toContain(ACTION_TYPES.DEDUPLICATION);
    expect(actionTypes).toContain(ACTION_TYPES.NETFLOW_APP);
    expect(actionTypes).toContain(ACTION_TYPES.SSL_DECRYPT);
    expect(actionTypes).toContain(ACTION_TYPES.APP_METADATA);
    expect(actionTypes).toContain(ACTION_TYPES.APPLICATION_FILTERING_INTELLIGENCE);
    expect(actionTypes).toContain(ACTION_TYPES.ADVANCED_FLOW_SLICING);
    expect(actionTypes).toContain(ACTION_TYPES.ADAPTIVE_PACKET_FILTERING);
  });

  it('correctly reports whether an action is in a bundle with isActionInBundle', () => {
    expect(isActionInBundle('CoreVUE', ACTION_TYPES.MASKING)).toBe(true);
    expect(isActionInBundle('CoreVUE', ACTION_TYPES.DEDUPLICATION)).toBe(false);
    expect(isActionInBundle('NetVUE', ACTION_TYPES.DEDUPLICATION)).toBe(true);
    expect(isActionInBundle('NetVUE', ACTION_TYPES.SSL_DECRYPT)).toBe(false);
    expect(isActionInBundle('SecureVUE+', ACTION_TYPES.SSL_DECRYPT)).toBe(true);
    expect(isActionInBundle('SecureVUE+', ACTION_TYPES.APP_METADATA)).toBe(true);
  });

  it('resolves deterministic bundle SKUs for GigaVUE-HC1', () => {
    expect(resolveBundleSkus('CoreVUE', 'GigaVUE-HC1')).toEqual(['SMT-HC1-BN-CORE']);
    expect(resolveBundleSkus('NetVUE', 'GigaVUE-HC1')).toEqual(['SMT-HC1-BN-NV']);
    expect(resolveBundleSkus('NetVUE+', 'GigaVUE-HC1')).toEqual(['SMT-HC1-BN-NVP']);
    expect(resolveBundleSkus('SecureVUE', 'GigaVUE-HC1')).toEqual(['SMT-HC1-BN-SV']);
    expect(resolveBundleSkus('SecureVUE+', 'GigaVUE-HC1')).toEqual(['SMT-HC1-BN-SVP']);
  });

  it('resolves deterministic bundle SKUs for GigaVUE-HC2', () => {
    expect(resolveBundleSkus('CoreVUE', 'GigaVUE-HC2')).toEqual(['SMT-HC2-BN-CORE']);
    expect(resolveBundleSkus('NetVUE', 'GigaVUE-HC2')).toEqual(['SMT-HC2-BN-NV']);
    expect(resolveBundleSkus('NetVUE+', 'GigaVUE-HC2')).toEqual(['SMT-HC2-BN-NVP']);
    expect(resolveBundleSkus('SecureVUE', 'GigaVUE-HC2')).toEqual(['SMT-HC2-BN-SV']);
    expect(resolveBundleSkus('SecureVUE+', 'GigaVUE-HC2')).toEqual(['SMT-HC2-BN-SVP']);
  });

  it('resolves deterministic bundle SKUs for GigaVUE-HC3', () => {
    expect(resolveBundleSkus('CoreVUE', 'GigaVUE-HC3')).toEqual(['SMT-HC3-BN-CORE']);
    expect(resolveBundleSkus('NetVUE', 'GigaVUE-HC3')).toEqual(['SMT-HC3-BN-NV']);
    expect(resolveBundleSkus('NetVUE+', 'GigaVUE-HC3')).toEqual(['SMT-HC3-BN-NVP']);
    expect(resolveBundleSkus('SecureVUE', 'GigaVUE-HC3')).toEqual(['SMT-HC3-BN-SV']);
    expect(resolveBundleSkus('SecureVUE+', 'GigaVUE-HC3')).toEqual(['SMT-HC3-BN-SVP']);
  });

  it('resolves deterministic bundle SKUs for GigaVUE-HC1-Plus', () => {
    // CoreVUE is included in base OS
    expect(resolveBundleSkus('CoreVUE', 'GigaVUE-HC1-Plus')).toEqual([]);

    // NetVUE
    expect(resolveBundleSkus('NetVUE', 'GigaVUE-HC1-Plus', 'HTL')).toEqual([
      'SMT-HC1P-GEN3-DD1-SW-TM',
      'SMT-HC1P-GEN3-NF1-SW-TM',
    ]);
    expect(resolveBundleSkus('NetVUE', 'GigaVUE-HC1-Plus', 'Perpetual')).toEqual([
      'SMT-HC1P-GEN3-DD1-PL',
      'SMT-HC1P-GEN3-NF1-PL',
    ]);

    // SecureVUE+
    expect(resolveBundleSkus('SecureVUE+', 'GigaVUE-HC1-Plus', 'HTL')).toEqual([
      'SMT-HC1P-GEN3-BN-ZTA-SW-TM',
    ]);
    expect(resolveBundleSkus('SecureVUE+', 'GigaVUE-HC1-Plus', 'Perpetual')).toEqual([
      'SMT-HC1P-GEN3-INSSL-PL',
      'SMT-HC1P-GEN3-DD1-PL',
      'SMT-HC1P-GEN3-NF1-PL',
      'SMT-HC1P-GEN3-AMI-PL',
      'SMT-HC1P-GEN3-AFI-PL',
      'SMT-HC1P-GEN3-APF-PL',
      'SMT-HC1P-GEN3-AFS-PL',
      'SMT-HC1P-GEN3-HS1-PL',
    ]);
  });
});
