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

import opticRules from './opticRules.json';
import { getOpticFiberType, getOpticSpeed, formatOpticLabel } from '../utils/hardwareUtils';

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
  CLUSTER:    'clusterNode',
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
  TUNNELING:                'Tunneling (ERSPAN Decap)',
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

/**
 * Returns true for Tunneling and ERSPAN decapsulation actions.
 */
export const isTunnelingAction = (actionType: string): boolean =>
  actionType === ACTION_TYPES.TUNNELING ||
  actionType === ACTION_TYPES.ERSPAN_DECAP ||
  actionType === ACTION_TYPES.L2GRE_DECAP ||
  actionType === ACTION_TYPES.VXLAN_DECAP ||
  actionType === ACTION_TYPES.GRE_IN_UDP_DECAP ||
  actionType === ACTION_TYPES.L2GRE_ENCAP ||
  actionType === ACTION_TYPES.VXLAN_ENCAP ||
  actionType === ACTION_TYPES.TCP_TUNNEL ||
  actionType === ACTION_TYPES.SECURE_TUNNELS ||
  actionType === 'Tunneling' ||
  actionType.includes('Tunnel') ||
  actionType.includes('ERSPAN');

/**
 * Returns true for any GigaSMART GTP flow intelligence action
 * (GTP Flow Filtering, GTP Whitelisting, GTP Flow Sampling, GTP Rotational Sampling).
 */
export const isGtpAction = (actionType: string): boolean =>
  actionType === ACTION_TYPES.GTP_FLOW_FILTERING ||
  actionType === ACTION_TYPES.GTP_WHITELISTING ||
  actionType === ACTION_TYPES.GTP_FLOW_SAMPLING ||
  actionType === ACTION_TYPES.GTP_ROTATIONAL_SAMPLING ||
  actionType.startsWith('GTP');

/**
 * Returns true for Header Stripping actions.
 */
export const isHeaderStripAction = (actionType: string): boolean =>
  actionType === ACTION_TYPES.HEADER_STRIP ||
  actionType === ACTION_TYPES.HEADER_TRAILER_REMOVE;

/**
 * Returns true for packet slicing actions.
 */
export const isSlicingAction = (actionType: string): boolean =>
  actionType === ACTION_TYPES.PACKET_SLICING ||
  actionType === ACTION_TYPES.ADVANCED_FLOW_SLICING;


export interface TapOpticOption {
  value: string;
  label: string;
  isSM: boolean;
  isCopper?: boolean;
}

const SPEED_ORDER: Record<string, number> = { '1G': 0, '10G': 1, '25G': 2, '40G': 3, '100G': 4, '400G': 5, Unknown: 6 };

// Generated from opticRules.json - the exact same catalogue the HC/TA
// chassis "Install Optics" picker reads (src/utils/opticValidation.ts /
// OpticsPanel.tsx) - rather than a hand-typed, independently-worded list.
// That hand list used to invent its own generic naming (e.g. '10G-SFP-SR')
// that never matched a real chassis-side SKU, so a TAP's default optic
// (SKU-based everywhere else, e.g. 'SFP-532') couldn't even display as
// selected here, and the two pickers never agreed on wording. Deriving both
// from one source guarantees they never diverge again.
// resolveOpticSku() (src/utils/bom/skuUtils.ts) upgrades a chosen value to
// its TAA ('T'-suffixed) variant for the BOM where the chassis has one.
// `label` is run through the same formatOpticLabel() the HC/TA "Install
// Optics" picker (OpticsPanel.tsx) uses, so an option reads identically
// (e.g. "SFP-532 (10G SFP+ SR) [MM]") in both pickers.
export const SUPPORTED_TAP_OPTICS: TapOpticOption[] = (() => {
  const rules = opticRules as Record<string, Record<string, string[]>>;
  const uniqueLabels = new Set<string>();
  Object.values(rules).forEach((boards) =>
    Object.values(boards).forEach((optics) => optics.forEach((o) => uniqueLabels.add(o)))
  );

  return Array.from(uniqueLabels)
    .map((raw) => {
      const fiberType = getOpticFiberType(raw);
      const value = raw.split(' ')[0];
      const opt: TapOpticOption = {
        value,
        label: formatOpticLabel(raw),
        isSM: fiberType === 'SM',
        isCopper: fiberType === 'Copper' ? true : undefined,
      };
      return { opt, sortKey: `${SPEED_ORDER[getOpticSpeed(raw)]}-${value}` };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((entry) => entry.opt);
})();

