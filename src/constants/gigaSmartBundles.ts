/**
 * gigaSmartBundles.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Canonical definitions and resolution utilities for Gigamon GigaSMART
 * Software Bundles: CoreVUE, NetVUE, NetVUE+, SecureVUE, and SecureVUE+.
 */

import { ACTION_TYPES } from './nodeTypes';

export type GigaSmartBundleId = 'CoreVUE' | 'NetVUE' | 'NetVUE+' | 'SecureVUE' | 'SecureVUE+';

export interface BundleAppDefinition {
  label: string;
  actionType: string;
  configType: string;
  defaultData?: Record<string, unknown>;
}

export interface GigaSmartBundleSpec {
  id: GigaSmartBundleId;
  label: string;
  skuBadge: string;
  tier: number;
  description: string;
  tooltip: string;
  badgeColour: string;
  accentColour: string;
  apps: BundleAppDefinition[];
}

const CORE_VUE_APPS: BundleAppDefinition[] = [
  {
    label: 'Packet Slicing',
    actionType: ACTION_TYPES.PACKET_SLICING,
    configType: ACTION_TYPES.PACKET_SLICING,
    defaultData: { sliceSize: 128 },
  },
  {
    label: 'Masking',
    actionType: ACTION_TYPES.MASKING,
    configType: ACTION_TYPES.MASKING,
  },
  {
    label: 'Header Stripping',
    actionType: ACTION_TYPES.HEADER_STRIP,
    configType: ACTION_TYPES.HEADER_STRIP,
    defaultData: { headerStripProtocol: 'VXLAN' },
  },
  {
    label: 'Tunnel Decapsulation',
    actionType: ACTION_TYPES.TUNNEL_DECAP,
    configType: 'Tunneling',
    defaultData: {
      tunnelMode: 'ERSPAN Decapsulation',
      erspanType: 'Type II',
      tunnelId: 10,
      tunnelIp: '192.168.10.100',
    },
  },
  {
    label: 'Source Port Labelling',
    actionType: ACTION_TYPES.SOURCE_ID,
    configType: ACTION_TYPES.SOURCE_ID,
  },
];

const NET_VUE_ADDITIONS: BundleAppDefinition[] = [
  {
    label: 'Deduplication',
    actionType: ACTION_TYPES.DEDUPLICATION,
    configType: ACTION_TYPES.DEDUPLICATION,
    defaultData: { dedupRate: 20 },
  },
  {
    label: 'NetFlow Generation (App)',
    actionType: ACTION_TYPES.NETFLOW_APP,
    configType: ACTION_TYPES.NETFLOW_APP,
  },
];

const NET_VUE_PLUS_ADDITIONS: BundleAppDefinition[] = [
  {
    label: 'Application Filtering Intelligence',
    actionType: ACTION_TYPES.APPLICATION_FILTERING_INTELLIGENCE,
    configType: ACTION_TYPES.APPLICATION_FILTERING_INTELLIGENCE,
  },
  {
    label: 'Adaptive Packet Filtering',
    actionType: ACTION_TYPES.ADAPTIVE_PACKET_FILTERING,
    configType: ACTION_TYPES.ADAPTIVE_PACKET_FILTERING,
  },
  {
    label: 'Advanced Flow Slicing',
    actionType: ACTION_TYPES.ADVANCED_FLOW_SLICING,
    configType: ACTION_TYPES.ADVANCED_FLOW_SLICING,
    defaultData: { sliceSize: 128 },
  },
];

const SECURE_VUE_ADDITIONS: BundleAppDefinition[] = [
  {
    label: 'Adaptive Packet Filtering',
    actionType: ACTION_TYPES.ADAPTIVE_PACKET_FILTERING,
    configType: ACTION_TYPES.ADAPTIVE_PACKET_FILTERING,
  },
];

const SECURE_VUE_PLUS_ADDITIONS: BundleAppDefinition[] = [
  {
    label: 'SSL Decryption',
    actionType: ACTION_TYPES.SSL_DECRYPT,
    configType: ACTION_TYPES.SSL_DECRYPT,
  },
  {
    label: 'Application Filtering Intelligence',
    actionType: ACTION_TYPES.APPLICATION_FILTERING_INTELLIGENCE,
    configType: ACTION_TYPES.APPLICATION_FILTERING_INTELLIGENCE,
  },
  {
    label: 'Adaptive Packet Filtering',
    actionType: ACTION_TYPES.ADAPTIVE_PACKET_FILTERING,
    configType: ACTION_TYPES.ADAPTIVE_PACKET_FILTERING,
  },
  {
    label: 'Application Metadata Intelligence',
    actionType: ACTION_TYPES.APP_METADATA,
    configType: ACTION_TYPES.APP_METADATA,
    defaultData: { metadataFormat: 'CEF' },
  },
  {
    label: 'Advanced Flow Slicing',
    actionType: ACTION_TYPES.ADVANCED_FLOW_SLICING,
    configType: ACTION_TYPES.ADVANCED_FLOW_SLICING,
    defaultData: { sliceSize: 128 },
  },
];

export const GIGASMART_BUNDLES: Record<GigaSmartBundleId, GigaSmartBundleSpec> = {
  CoreVUE: {
    id: 'CoreVUE',
    label: 'CoreVUE Bundle',
    skuBadge: 'BN-CORE',
    tier: 1,
    description: 'Core GigaSMART software bundle including Advanced Tunnelling, Header Stripping, Slicing, Masking, and Source Port Labelling.',
    tooltip: 'CoreVUE software bundle: Advanced Tunnelling, Header Stripping, Slicing, Masking, and Source Port Labelling. Includes bundled Elite-Plus Support.',
    badgeColour: '#0284c7', // Sky blue
    accentColour: '#38bdf8',
    apps: [...CORE_VUE_APPS],
  },
  NetVUE: {
    id: 'NetVUE',
    label: 'NetVUE Bundle',
    skuBadge: 'BN-NV',
    tier: 2,
    description: 'Network visibility bundle including all CoreVUE capabilities plus De-duplication and NetFlow Generation.',
    tooltip: 'NetVUE software bundle: All CoreVUE capabilities plus De-duplication and NetFlow Generation. Includes bundled Elite-Plus Support.',
    badgeColour: '#059669', // Emerald green
    accentColour: '#34d399',
    apps: [...CORE_VUE_APPS, ...NET_VUE_ADDITIONS],
  },
  'NetVUE+': {
    id: 'NetVUE+',
    label: 'NetVUE+ Bundle',
    skuBadge: 'BN-NVP',
    tier: 3,
    description: 'Advanced network intelligence bundle: all NetVUE capabilities plus AFI, Adaptive Packet Filtering (APF), and Advanced Flow Slicing.',
    tooltip: 'NetVUE Plus software bundle: All NetVUE capabilities, Application Filtering Intelligence (AFI), Adaptive Packet Filtering (APF), and Advanced Flow Slicing. Includes bundled Elite-Plus Support.',
    badgeColour: '#0d9488', // Teal
    accentColour: '#2dd4bf',
    apps: [...CORE_VUE_APPS, ...NET_VUE_ADDITIONS, ...NET_VUE_PLUS_ADDITIONS],
  },
  SecureVUE: {
    id: 'SecureVUE',
    label: 'SecureVUE Bundle',
    skuBadge: 'BN-SV',
    tier: 4,
    description: 'Security visibility bundle including all CoreVUE capabilities plus De-duplication, NetFlow Generation, and Adaptive Packet Filtering.',
    tooltip: 'SecureVUE software bundle: All CoreVUE capabilities, De-duplication, NetFlow Generation, and Adaptive Packet Filtering. Includes bundled Elite-Plus Support.',
    badgeColour: '#7c3aed', // Purple
    accentColour: '#a78bfa',
    apps: [...CORE_VUE_APPS, ...NET_VUE_ADDITIONS, ...SECURE_VUE_ADDITIONS],
  },
  'SecureVUE+': {
    id: 'SecureVUE+',
    label: 'SecureVUE+ Bundle',
    skuBadge: 'BN-SVP',
    tier: 5,
    description: 'Comprehensive top-tier visibility bundle: ALL GigaSMART features enabled, including SSL/TLS Decryption, AMI, AFI, APF, AFS, De-duplication, NetFlow, and CoreVUE.',
    tooltip: 'SecureVUE Plus software bundle: All SecureVUE capabilities, SSL/TLS Decryption (Inline + Out-of-band), Application Filtering Intelligence, Application Metadata Intelligence (AMI), and Advanced Flow Slicing. Includes bundled Elite-Plus Support.',
    badgeColour: '#e11d48', // Crimson / Rose
    accentColour: '#fb7185',
    apps: [
      ...CORE_VUE_APPS,
      ...NET_VUE_ADDITIONS,
      ...SECURE_VUE_PLUS_ADDITIONS,
    ],
  },
};

export const ORDERED_BUNDLES: GigaSmartBundleSpec[] = [
  GIGASMART_BUNDLES.CoreVUE,
  GIGASMART_BUNDLES.NetVUE,
  GIGASMART_BUNDLES['NetVUE+'],
  GIGASMART_BUNDLES.SecureVUE,
  GIGASMART_BUNDLES['SecureVUE+'],
];

/**
 * Returns true if the given actionType is provided natively by the specified bundle.
 */
export function isActionInBundle(bundleId: GigaSmartBundleId, actionType: string): boolean {
  const spec = GIGASMART_BUNDLES[bundleId];
  if (!spec) return false;
  return spec.apps.some((app) => app.actionType === actionType);
}

/**
 * Resolves the deterministic Bill of Materials SKU list for a given bundle, chassis model,
 * and licence mode.
 */
export function resolveBundleSkus(
  bundleId: GigaSmartBundleId,
  chassisModel: string,
  licenseMode: 'HTL' | 'Perpetual' = 'HTL',
): string[] {
  const model = chassisModel.toLowerCase();
  const isPerpetual = licenseMode === 'Perpetual';

  // 1. HC1-Plus
  if (model.includes('hc1-plus') || model.includes('hc1 plus') || model.includes('hc1p')) {
    switch (bundleId) {
      case 'CoreVUE':
        // Included in base GigaVUE-HC1-Plus chassis OS license (GVS-HC1P-SW-TM / base hardware)
        return [];
      case 'NetVUE':
        return isPerpetual
          ? ['SMT-HC1P-GEN3-DD1-PL', 'SMT-HC1P-GEN3-NF1-PL']
          : ['SMT-HC1P-GEN3-DD1-SW-TM', 'SMT-HC1P-GEN3-NF1-SW-TM'];
      case 'NetVUE+':
        return isPerpetual
          ? [
              'SMT-HC1P-GEN3-DD1-PL',
              'SMT-HC1P-GEN3-NF1-PL',
              'SMT-HC1P-GEN3-AFI-PL',
              'SMT-HC1P-GEN3-APF-PL',
              'SMT-HC1P-GEN3-AFS-PL',
            ]
          : [
              'SMT-HC1P-GEN3-DD1-SW-TM',
              'SMT-HC1P-GEN3-NF1-SW-TM',
              'SMT-HC1P-GEN3-AFI-SW-TM',
              'SMT-HC1P-GEN3-APF-SW-TM',
              'SMT-HC1P-GEN3-AFS-SW-TM',
            ];
      case 'SecureVUE':
        return isPerpetual
          ? ['SMT-HC1P-GEN3-DD1-PL', 'SMT-HC1P-GEN3-NF1-PL', 'SMT-HC1P-GEN3-APF-PL']
          : ['SMT-HC1P-GEN3-DD1-SW-TM', 'SMT-HC1P-GEN3-NF1-SW-TM', 'SMT-HC1P-GEN3-APF-SW-TM'];
      case 'SecureVUE+':
        return isPerpetual
          ? [
              'SMT-HC1P-GEN3-INSSL-PL',
              'SMT-HC1P-GEN3-DD1-PL',
              'SMT-HC1P-GEN3-NF1-PL',
              'SMT-HC1P-GEN3-AMI-PL',
              'SMT-HC1P-GEN3-AFI-PL',
              'SMT-HC1P-GEN3-APF-PL',
              'SMT-HC1P-GEN3-AFS-PL',
              'SMT-HC1P-GEN3-HS1-PL',
            ]
          : ['SMT-HC1P-GEN3-BN-ZTA-SW-TM'];
    }
  }

  // 2. GigaVUE-HC1
  if (model.includes('hc1')) {
    switch (bundleId) {
      case 'CoreVUE':
        return ['SMT-HC1-BN-CORE'];
      case 'NetVUE':
        return ['SMT-HC1-BN-NV'];
      case 'NetVUE+':
        return ['SMT-HC1-BN-NVP'];
      case 'SecureVUE':
        return ['SMT-HC1-BN-SV'];
      case 'SecureVUE+':
        return ['SMT-HC1-BN-SVP'];
    }
  }

  // 3. GigaVUE-HC2
  if (model.includes('hc2')) {
    switch (bundleId) {
      case 'CoreVUE':
        return ['SMT-HC2-BN-CORE'];
      case 'NetVUE':
        return ['SMT-HC2-BN-NV'];
      case 'NetVUE+':
        return ['SMT-HC2-BN-NVP'];
      case 'SecureVUE':
        return ['SMT-HC2-BN-SV'];
      case 'SecureVUE+':
        return ['SMT-HC2-BN-SVP'];
    }
  }

  // 4. GigaVUE-HC3
  if (model.includes('hc3')) {
    switch (bundleId) {
      case 'CoreVUE':
        return ['SMT-HC3-BN-CORE'];
      case 'NetVUE':
        return ['SMT-HC3-BN-NV'];
      case 'NetVUE+':
        return ['SMT-HC3-BN-NVP'];
      case 'SecureVUE':
        return ['SMT-HC3-BN-SV'];
      case 'SecureVUE+':
        return ['SMT-HC3-BN-SVP'];
    }
  }

  return [];
}
