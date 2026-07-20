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
  CLOUD_5G:       '5G-Cloud', // GigaSMART 5G CUPS
  DEDUPLICATION:  'Deduplication',
  GVHTTP2:        'GVHTTP2',
  HEADER_STRIP:   'Header Stripping',
  MASKING:        'Masking',
  AMX:            'AMX',
  AMI:            'AMI', // Application Metadata Intelligence
  PCAPNG:         'Pcapng',
  SBI_5G:         '5G-SBI',
  SBIPOE:         'Sbipoe',
  PACKET_SLICING: 'Packet Slicing',
  SSL_DECRYPT:    'SSL Decrypt',
  // Below added for GigaSMART rules mapping
  ADVANCED_FLOW_SLICING:    'Advanced Flow Slicing',
  SOURCE_ID:                'Source ID',
  HEADER_TRAILER_REMOVE:    'Header/Trailer Remove',
  L2GRE_ENCAP:              'L2GRE Tunnel Encapsulation',
  VXLAN_ENCAP:              'VXLAN Tunnel Encapsulation',
  L2GRE_DECAP:              'L2GRE Tunnel Decapsulation',
  VXLAN_DECAP:              'VXLAN Tunnel Decapsulation',
  ERSPAN_DECAP:             'ERSPAN Tunnel Decapsulation',
  HEADER_ADDITION:          'Header Addition',
  IP_FLOWVUE:               'IP FlowVUE',
  GTP_FLOW_FILTERING:       'GTP Flow Filtering',
  GTP_ROTATIONAL_SAMPLING:  'GTP Rotational Sampling',
  GTP_WHITELISTING:         'GTP Whitelisting',
  GTP_FLOW_SAMPLING:        'GTP Flow Sampling',
  ADAPTIVE_PACKET_FILTERING:'Adaptive Packet Filtering',
  APPLICATION_SESSION_FILTERING: 'Application Session Filtering',
  APPLICATION_FILTERING_INTELLIGENCE: 'Application Filtering Intelligence',
  NETFLOW_APP:              'NetFlow Generation (App)',
  NETFLOW_TRAFFIC:          'NetFlow Generation (Traffic)',
  LOAD_BALANCING_STATELESS: 'Load Balancing (Stateless)',
  LOAD_BALANCING_STATEFUL:  'Load Balancing (Stateful)',
  SSL_DECRYPT_INLINE:       'SSL Decrypt (Inline)',
  SIP_FLOW_SAMPLING:        'SIP Flow Sampling',
  SIP_FLOW_WHITELIST:       'SIP Flow Whitelist',
  UPN_MONITORING:           '4G/5G UPN Monitoring',
  TCP_TUNNEL:               'TCP Tunnel',
  SECURE_TUNNELS:           'Secure Tunnels',
  GRE_IN_UDP_DECAP:         'GRE-In-UDP Tunnel Decapsulation',
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

// NOTE: every `value` here MUST have a matching entry in TAP_OPTIC_SKU_MAP
// (src/utils/bom/skuUtils.ts) — that's what translates the picker value into
// a real, orderable Gigamon transceiver SKU for the BOM. Optic types with no
// confirmed real SKU (1G ZX, 10G direct-attach copper, 40G/100G BiDi, 100G
// PSM4, and the 400G QSFP-DD family) were deliberately left out rather than
// risk a fabricated part number appearing on a customer-facing BOM.
export const SUPPORTED_TAP_OPTICS: TapOpticOption[] = [
  // --- 1G Optics ---
  { value: '1G-SFP-SX', label: '1Gb SFP SX (850nm) — Multimode LC (200-550m)', isSM: false },
  { value: '1G-SFP-LX', label: '1Gb SFP LX (1310nm) — Singlemode LC (10km)', isSM: true },
  { value: '1G-SFP-CU', label: '1Gb SFP Copper (CAT-5) — RJ45 (100m)', isSM: false, isCopper: true },

  // --- 10G Optics ---
  { value: '10G-SFP-SR', label: '10Gb SFP+ SR (850nm) — Multimode LC (300m)', isSM: false },
  { value: '10G-SFP-LR', label: '10Gb SFP+ LR (1310nm) — Singlemode LC (10km)', isSM: true },
  { value: '10G-SFP-CU6', label: '10Gb SFP+ Copper (CAT-6a) — RJ45 (100m)', isSM: false, isCopper: true },

  // --- 25G Optics ---
  { value: '25G-SFP28-SR', label: '25Gb SFP28 SR (850nm) — Multimode LC (100m)', isSM: false },
  { value: '25G-SFP28-LR', label: '25Gb SFP28 LR (1310nm) — Singlemode LC (10km)', isSM: true },

  // --- 40G Optics ---
  { value: '40G-QSFP-SR4', label: '40Gb QSFP+ SR4 (850nm) — Multimode MPO (100m)', isSM: false },
  { value: '40G-QSFP-SWDM4', label: '40Gb QSFP+ SWDM4 (850-940nm) — Multimode LC (240-440m)', isSM: false },
  { value: '40G-QSFP-LR4', label: '40Gb QSFP+ LR4 (1310nm) — Singlemode LC (10km)', isSM: true },
  { value: '40G-QSFP-PSM4', label: '40Gb QSFP+ PSM4 (1310nm) — Singlemode MPO (1.4km)', isSM: true },

  // --- 100G Optics ---
  { value: '100G-QSFP28-SR4', label: '100Gb QSFP28 SR4 (850nm) — Multimode MPO (100m)', isSM: false },
  { value: '100G-QSFP28-SWDM4', label: '100Gb QSFP28 SWDM4 (850-940nm) — Multimode LC (75-150m)', isSM: false },
  { value: '100G-QSFP28-LR4', label: '100Gb QSFP28 LR4 (1310nm) — Singlemode LC (10km)', isSM: true },
];

