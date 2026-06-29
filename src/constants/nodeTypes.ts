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
}

export const SUPPORTED_TAP_OPTICS: TapOpticOption[] = [
  { value: 'SFP-502 (1G SFP SX)', label: '1G SX Multimode (SFP)', isSM: false },
  { value: 'SFP-503 (1G SFP LX)', label: '1G LX Singlemode (SFP)', isSM: true },
  { value: 'SFP-532 (10G SFP+ SR)', label: '10G SR Multimode (SFP+)', isSM: false },
  { value: 'SFP-533 (10G SFP+ LR)', label: '10G LR Singlemode (SFP+)', isSM: true },
  { value: 'SFP-552 (25G SFP28 SR)', label: '25G SR Multimode (SFP28)', isSM: false },
  { value: 'SFP-553T (25G SFP28 LR)', label: '25G LR Singlemode (SFP28)', isSM: true },
  { value: 'QSF-502 (40G QSFP+ SR4)', label: '40G SR4 Multimode (QSFP+)', isSM: false },
  { value: 'QSF-503T (40G QSFP+ LR4)', label: '40G LR4 Singlemode (QSFP+)', isSM: true },
  { value: 'Q28-502T (100G QSFP28 SR4)', label: '100G SR4 Multimode (QSFP28)', isSM: false },
  { value: 'Q28-503 (100G QSFP28 LR4)', label: '100G LR4 Singlemode (QSFP28)', isSM: true }
];
