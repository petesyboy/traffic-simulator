/**
 * nodeTypes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every "magic string" that identifies a React Flow
 * node type or a GigaSMART action type within the simulator.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Before this file, string literals like 'inputNode', 'gigaSmartNode', or
 * 'Deduplication' were scattered across 6+ files.  A single typo (e.g.
 * 'gigasmartNode') would silently break routing without a TypeScript error.
 *
 * Now every comparison uses a constant:
 *   if (node.type === NODE_TYPES.INPUT)   ← compiler-checked
 *   if (node.type === 'inputNode')        ← silent bug risk
 *
 * USAGE
 * ─────
 *   import { NODE_TYPES, ACTION_TYPES, CONFIG_TYPES } from '../constants/nodeTypes';
 */

// ─── React Flow node type identifiers ────────────────────────────────────────

export const NODE_TYPES = {
  INPUT:      'inputNode',
  MAP:        'mapNode',
  FILTER:     'filterNode',
  TOOL:       'toolNode',
  GIGASMART:  'gigaSmartNode',
  GIGASTREAM: 'gigaStreamNode',
  GROUP:      'groupNode',
  HARDWARE:   'hardwareNode',
} as const;

/** Union of all valid node type strings. */
export type NodeType = typeof NODE_TYPES[keyof typeof NODE_TYPES];

// ─── GigaSMART action types ───────────────────────────────────────────────────

export const ACTION_TYPES = {
  APP_METADATA:   'Application Metadata',
  APP_VIS:        'Application Visualization',
  CLOUD_5G:       '5G-Cloud',
  DEDUPLICATION:  'Deduplication',
  GVHTTP2:        'GVHTTP2',
  HEADER_STRIP:   'Header Stripping',
  MASKING:        'Masking',
  AMX:            'AMX',
  AMI:            'AMI',
  PCAPNG:         'Pcapng',
  SBI_5G:         '5G-SBI',
  SBIPOE:         'Sbipoe',
  PACKET_SLICING: 'Packet Slicing',
  SSL_DECRYPT:    'SSL Decrypt',
} as const;

/** Union of all valid GigaSMART action type strings. */
export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];

// ─── Tool / Filter configType identifiers ─────────────────────────────────────

export const CONFIG_TYPES = {
  // Input port types
  SPAN:   'SPAN',
  TAP:    'TAP',
  ERSPAN: 'ERSPAN',
  EAST_WEST: 'East/West',
  VMWARE: 'VMWare',

  // Filter node sub-types
  VLAN_FILTER:   'VLAN Filter',
  IP_FILTER:     'IP Subnet Filter',
  PORT_FILTER:   'Port Filter',

  // Traffic Map
  TRAFFIC_MAP: 'Traffic Map',

  // Tool classes
  PACKET_TOOL:   'Packet Tool',
  METADATA_TOOL: 'Metadata Tool',
  STORAGE_TOOL:  'Objects',

  // Port group
  PORT_GROUP: 'Port Group',
} as const;

/** Union of all valid configType strings. */
export type ConfigType = typeof CONFIG_TYPES[keyof typeof CONFIG_TYPES];

// ─── Metadata output formats ───────────────────────────────────────────────────

export const METADATA_FORMATS = {
  CEF:  'CEF',
  JSON: 'JSON',
  ANY:  'Any',
} as const;

export type MetadataFormat = typeof METADATA_FORMATS[keyof typeof METADATA_FORMATS];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true for any GigaSMART action that produces metadata output
 * (Application Metadata, AMX, or AMI).  Used by SimulationEngine and
 * ConfigPanel to determine traffic type.
 */
export const isMetadataAction = (actionType: string): boolean =>
  actionType === ACTION_TYPES.APP_METADATA ||
  actionType === ACTION_TYPES.AMX ||
  actionType === ACTION_TYPES.AMI;

/**
 * Returns true for the two deduplication action type strings that the
 * simulator treats equivalently.
 */
export const isDedupAction = (actionType: string): boolean =>
  actionType === ACTION_TYPES.DEDUPLICATION;

export interface TapOpticOption {
  value: string;
  label: string;
  isSM: boolean;
  isCopper?: boolean;
}

export const SUPPORTED_TAP_OPTICS: TapOpticOption[] = [
  { value: 'SFP-505T (100M FX)', label: 'SFP-505T — 100M FX Multimode (SFP) (TAA)', isSM: false },
  { value: 'SFP-501 (1G Copper SFP)', label: 'SFP-501 — 1G Copper (SFP)', isSM: false, isCopper: true },
  { value: 'SFP-502 (1G SFP SX)', label: 'SFP-502 — 1G SX Multimode (SFP)', isSM: false },
  { value: 'SFP-503 (1G SFP LX)', label: 'SFP-503 — 1G LX Singlemode (SFP)', isSM: true },
  { value: 'SFP-501T (1G Copper SFP T)', label: 'SFP-501T — 1G Copper (SFP) (TAA)', isSM: false, isCopper: true },
  { value: 'SFP-502T (1G SFP SX T)', label: 'SFP-502T — 1G SX Multimode (SFP) (TAA)', isSM: false },
  { value: 'SFP-503T (1G SFP LX T)', label: 'SFP-503T — 1G LX Singlemode (SFP) (TAA)', isSM: true },
  
  { value: 'SFP-531 (10G Copper SFP+)', label: 'SFP-531 — 10G Copper (SFP+)', isSM: false, isCopper: true },
  { value: 'SFP-532 (10G SFP+ SR)', label: 'SFP-532 — 10G SR Multimode (SFP+)', isSM: false },
  { value: 'SFP-533 (10G SFP+ LR)', label: 'SFP-533 — 10G LR Singlemode (SFP+)', isSM: true },
  { value: 'SFP-534 (10G SFP+ ER)', label: 'SFP-534 — 10G ER Singlemode (SFP+)', isSM: true },
  { value: 'SFP-535 (10G SFP+ LRM)', label: 'SFP-535 — 10G LRM Multimode (SFP+)', isSM: false },
  
  { value: 'SFP-531T (10G Copper SFP+ T)', label: 'SFP-531T — 10G Copper (SFP+) (TAA)', isSM: false, isCopper: true },
  { value: 'SFP-532T (10G SFP+ SR T)', label: 'SFP-532T — 10G SR Multimode (SFP+) (TAA)', isSM: false },
  { value: 'SFP-533T (10G SFP+ LR T)', label: 'SFP-533T — 10G LR Singlemode (SFP+) (TAA)', isSM: true },
  { value: 'SFP-534T (10G SFP+ ER T)', label: 'SFP-534T — 10G ER Singlemode (SFP+) (TAA)', isSM: true },
  { value: 'SFP-532C (10G SFP+ SR C)', label: 'SFP-532C — 10G SR Multimode C (SFP+)', isSM: false },

  { value: 'SFP-552 (25G SFP28 SR)', label: 'SFP-552 — 25G SR Multimode (SFP28)', isSM: false },
  { value: 'SFP-553T (25G SFP28 LR)', label: 'SFP-553T — 25G LR Singlemode (SFP28) (TAA)', isSM: true },
  { value: 'QSF-502 (40G QSFP+ SR4)', label: 'QSF-502 — 40G SR4 Multimode (QSFP+)', isSM: false },
  { value: 'QSF-503T (40G QSFP+ LR4)', label: 'QSF-503T — 40G LR4 Singlemode (QSFP+) (TAA)', isSM: true },
  { value: 'Q28-502T (100G QSFP28 SR4)', label: 'Q28-502T — 100G SR4 Multimode (QSFP28) (TAA)', isSM: false },
  { value: 'Q28-503 (100G QSFP28 LR4)', label: 'Q28-503 — 100G LR4 Singlemode (QSFP28)', isSM: true },
  { value: 'QSB-523T (40/100G QSFP28 Dual-Rate BiDi)', label: 'QSB-523T — 40/100G BiDi Multimode (QSFP28) (TAA)', isSM: false }
];
