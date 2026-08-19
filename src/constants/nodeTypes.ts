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

// `value`/`label` here use the same real Gigamon transceiver SKUs and
// wording as opticRules.json (the HC/TA chassis "Install Optics" picker) -
// they used to be an independently-invented generic vocabulary (e.g.
// '10G-SFP-SR') that never matched a chassis-side SKU, so a TAP's default
// optic (already SKU-based elsewhere, e.g. 'SFP-532') couldn't display as
// selected in this dropdown and the two pickers never agreed on wording.
// resolveOpticSku() (src/utils/bom/skuUtils.ts) upgrades these to their TAA
// ('T'-suffixed) variant for the BOM where one exists on the target chassis.
export const SUPPORTED_TAP_OPTICS: TapOpticOption[] = [
  // --- 1G Optics ---
  { value: 'SFP-502', label: 'SFP-502 (1G SFP SX)', isSM: false },
  { value: 'SFP-503', label: 'SFP-503 (1G SFP LX)', isSM: true },
  { value: 'SFP-501', label: 'SFP-501 (1G SFP Copper)', isSM: false, isCopper: true },

  // --- 10G Optics ---
  { value: 'SFP-532', label: 'SFP-532 (10G SFP+ SR)', isSM: false },
  { value: 'SFP-533', label: 'SFP-533 (10G SFP+ LR)', isSM: true },
  { value: 'SFP-531', label: 'SFP-531 (10G SFP+ Copper)', isSM: false, isCopper: true },

  // --- 25G Optics ---
  { value: 'SFP-552', label: 'SFP-552 (25G SFP28 SR)', isSM: false },
  { value: 'SFP-553T', label: 'SFP-553T (25G SFP28 LR)', isSM: true },

  // --- 40G Optics ---
  { value: 'QSF-502', label: 'QSF-502 (40G QSFP+ SR4)', isSM: false },
  { value: 'QSF-508', label: 'QSF-508 (40G QSFP+ SWDM4)', isSM: false },
  { value: 'QSF-503T', label: 'QSF-503T (40G QSFP+ LR4)', isSM: true },
  { value: 'QSF-506', label: 'QSF-506 (40G QSFP+ PSM4)', isSM: true },

  // --- 100G Optics ---
  { value: 'Q28-502T', label: 'Q28-502T (100G QSFP28 SR4)', isSM: false },
  { value: 'Q28-508', label: 'Q28-508 (100G QSFP28 SWDM4)', isSM: false },
  { value: 'Q28-503', label: 'Q28-503 (100G QSFP28 LR4)', isSM: true },
];

