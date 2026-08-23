// gigaSmartRules.ts

export type GigaSmartEngine = 
  | 'HC1_GEN2_ONBOARD'
  | 'HC1_GEN3_SMT_HC1_S'
  | 'HC3_GEN2_C05'
  | 'HC3_GEN3_C08'
  | 'HC1PLUS_REAR_GEN3_SMT_HC1A_R'
  | 'HC1PLUS_FRONT_GEN3_SMT_HC1_S'
  | 'HCT_GEN3_SMT_HC1_S';

export interface GigaSmartRule {
  actionType: string;
  supportedOn: Record<GigaSmartEngine, boolean>;
}

export const GIGASMART_MATRIX: GigaSmartRule[] = [
  {
    actionType: 'Masking',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'Packet Slicing',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'Advanced Flow Slicing',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'Source ID',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: false, HC1PLUS_REAR_GEN3_SMT_HC1A_R: false, HC1PLUS_FRONT_GEN3_SMT_HC1_S: false, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: 'Header/Trailer Remove',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: false, HC1PLUS_REAR_GEN3_SMT_HC1A_R: false, HC1PLUS_FRONT_GEN3_SMT_HC1_S: false, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: '5G-Cloud', // GigaSMART 5G CUPS
    supportedOn: { HC1_GEN2_ONBOARD: false, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: false, HC1PLUS_FRONT_GEN3_SMT_HC1_S: false, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: 'Deduplication',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'L2GRE Tunnel Encapsulation',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: false, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'VXLAN Tunnel Encapsulation',
    supportedOn: { HC1_GEN2_ONBOARD: false, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: false, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'L2GRE Tunnel Decapsulation',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: false, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'VXLAN Tunnel Decapsulation',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'ERSPAN Tunnel Decapsulation',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'Header Stripping',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'Header Addition',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'IP FlowVUE',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: 'GTP Flow Filtering',
    supportedOn: { HC1_GEN2_ONBOARD: false, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: false, HC1PLUS_REAR_GEN3_SMT_HC1A_R: false, HC1PLUS_FRONT_GEN3_SMT_HC1_S: false, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: 'GTP Rotational Sampling',
    supportedOn: { HC1_GEN2_ONBOARD: false, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: false, HC1PLUS_REAR_GEN3_SMT_HC1A_R: false, HC1PLUS_FRONT_GEN3_SMT_HC1_S: false, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: 'GTP Whitelisting',
    supportedOn: { HC1_GEN2_ONBOARD: false, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: false, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: 'GTP Flow Sampling',
    supportedOn: { HC1_GEN2_ONBOARD: false, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: false, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: 'Adaptive Packet Filtering',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'Application Session Filtering',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'Application Filtering Intelligence',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'Application Metadata Intelligence',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'NetFlow Generation (App)',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'Application Visualization',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'NetFlow Generation (Traffic)',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: false, HC1PLUS_REAR_GEN3_SMT_HC1A_R: false, HC1PLUS_FRONT_GEN3_SMT_HC1_S: false, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: 'Load Balancing (Stateless)',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'Load Balancing (Stateful)',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'SSL Decrypt', // Actually passive
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'SSL Decrypt (Inline)',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: 'SIP Flow Sampling',
    supportedOn: { HC1_GEN2_ONBOARD: false, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: false, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: 'SIP Flow Whitelist',
    supportedOn: { HC1_GEN2_ONBOARD: false, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: false, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: '4G/5G UPN Monitoring', // 4G/5G Traffic Monitoring using UPN
    supportedOn: { HC1_GEN2_ONBOARD: false, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: false, HC1PLUS_FRONT_GEN3_SMT_HC1_S: false, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: 'TCP Tunnel',
    supportedOn: { HC1_GEN2_ONBOARD: true, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: true, HC3_GEN3_C08: false, HC1PLUS_REAR_GEN3_SMT_HC1A_R: false, HC1PLUS_FRONT_GEN3_SMT_HC1_S: false, HCT_GEN3_SMT_HC1_S: false }
  },
  {
    actionType: 'Secure Tunnels',
    supportedOn: { HC1_GEN2_ONBOARD: false, HC1_GEN3_SMT_HC1_S: true, HC3_GEN2_C05: false, HC3_GEN3_C08: true, HC1PLUS_REAR_GEN3_SMT_HC1A_R: true, HC1PLUS_FRONT_GEN3_SMT_HC1_S: true, HCT_GEN3_SMT_HC1_S: true }
  },
  {
    actionType: 'GRE-In-UDP Tunnel Decapsulation',
    supportedOn: { HC1_GEN2_ONBOARD: false, HC1_GEN3_SMT_HC1_S: false, HC3_GEN2_C05: false, HC3_GEN3_C08: false, HC1PLUS_REAR_GEN3_SMT_HC1A_R: false, HC1PLUS_FRONT_GEN3_SMT_HC1_S: false, HCT_GEN3_SMT_HC1_S: false }
  }
];

/**
 * Maps a given chassis and its installed modules to a list of available GigaSMART engines.
 */
export function getAvailableEngines(chassisModel: string, modules: string[]): GigaSmartEngine[] {
  const engines: GigaSmartEngine[] = [];
  const modelLower = chassisModel.toLowerCase();
  
  if (modelLower.includes('hc1') && !modelLower.includes('plus')) {
    engines.push('HC1_GEN2_ONBOARD'); // Base HC1 has Gen2 on-board
    if (modules.some(m => m.includes('SMT-HC1-S'))) {
      engines.push('HC1_GEN3_SMT_HC1_S');
    }
  } else if (modelLower.includes('hc1-plus') || modelLower.includes('hc1 plus')) {
    engines.push('HC1PLUS_REAR_GEN3_SMT_HC1A_R'); // Built-in Rear Gen3 engine for HC1 Plus
    if (modules.some(m => m.includes('SMT-HC1-S'))) {
      engines.push('HC1PLUS_FRONT_GEN3_SMT_HC1_S');
    }
  } else if (modelLower.includes('hc3')) {
    engines.push('HC3_GEN2_C05'); // Assuming HC3 base supports Gen2 C05 apps
    if (modules.some(m => m.includes('SMT-HC3-C08') || m.includes('SMT-HC3-Gen3'))) {
      engines.push('HC3_GEN3_C08');
    }
  } else if (modelLower.includes('hct')) {
    if (modules.some(m => m.includes('SMT-HC1-S'))) {
      engines.push('HCT_GEN3_SMT_HC1_S');
    }
  }
  
  return engines;
}

/**
 * Validates if a specific GigaSMART action type is supported by a given node.
 */
export function isActionSupportedOnNode(actionType: string, chassisModel: string, modules: string[]): boolean {
  const engines = getAvailableEngines(chassisModel, modules);
  if (engines.length === 0) return false;

  const rule = GIGASMART_MATRIX.find(r => r.actionType === actionType);
  if (!rule) {
    // If action is not in our strict matrix, default to supported (e.g. for simple/custom actions)
    return true; 
  }
  
  // Return true if AT LEAST ONE installed engine supports it
  return engines.some(engine => rule.supportedOn[engine]);
}

/**
 * Maps a given GigaSMART action type to its canonical matrix row/column name.
 */
export function getCanonicalGsopName(actionType: string): string | null {
  switch (actionType) {
    case 'Masking':
      return 'Masking';
    case 'Source ID':
      return 'Source Port Labelling';
    case 'Deduplication':
      return 'De-Dup';
    case 'Load Balancing (Stateless)':
    case 'Load Balancing (Stateful)':
      return 'Load Balance';
    case 'Adaptive Packet Filtering':
      return 'APF';
    case 'Application Session Filtering':
      return 'A SF';
    case 'Application Filtering Intelligence':
      return 'AFI (ASF)';
    case 'Application Metadata Intelligence':
      return 'AMI';
    case 'IP FlowVUE':
      return 'FlowVUE';
    case 'GTP Flow Filtering':
      return 'GTP Flow Filter';
    case 'GTP Whitelisting':
      return 'GTP Whitelist';
    case 'GTP Flow Sampling':
      return 'GTP Flow Sampling';
    case 'Header Stripping':
      return 'Strip Headers';
    case 'Header Addition':
      return 'Add Headers';
    case 'Header/Trailer Remove':
      return 'Remove H/T';
    case 'NetFlow Generation (App)':
      return 'NetFlow 1st level';
    case 'NetFlow Generation (Traffic)':
      return 'NetFlow 2nd level';
    case 'Packet Slicing':
      return 'Slicing';
    case 'Advanced Flow Slicing':
      return 'Advanced Flow Slicing';
    case 'SSL Decrypt':
      return 'SSL Decrypt';
    case 'SSL Decrypt (Inline)':
      return 'iSSL';
    case 'L2GRE Tunnel Encapsulation':
    case 'VXLAN Tunnel Encapsulation':
      return 'Tunnel Encap';
    case 'L2GRE Tunnel Decapsulation':
    case 'VXLAN Tunnel Decapsulation':
    case 'ERSPAN Tunnel Decapsulation':
    case 'GRE-In-UDP Tunnel Decapsulation':
      return 'Tunnel Decap';
    default:
      return null;
  }
}

// Maps each canonical GSOP name to a list of other canonical names it is compatible with in a single GSOP
export const GSOP_COMPATIBILITY: Record<string, string[]> = {
  'Masking': [
    'Source Port Labelling', 'De-Dup', 'Load Balance', 'APF', 'A SF', 'AFI (ASF)', 
    'FlowVUE', 'Strip Headers', 'Add Headers', 'Remove H/T', 'Slicing', 
    'Advanced Flow Slicing', 'Tunnel Encap', 'Tunnel Decap'
  ],
  'Source Port Labelling': [
    'Masking', 'De-Dup', 'Load Balance', 'APF', 'A SF', 'FlowVUE', 
    'Strip Headers', 'Add Headers', 'Remove H/T', 'Slicing', 
    'Advanced Flow Slicing', 'Tunnel Encap', 'Tunnel Decap'
  ],
  'De-Dup': [
    'Masking', 'Source Port Labelling', 'Load Balance', 'APF', 'A SF', 'AFI (ASF)', 
    'AMI', 'FlowVUE', 'Strip Headers', 'Add Headers', 'Remove H/T', 'NetFlow 1st level', 
    'NetFlow 2nd level', 'Slicing', 'Advanced Flow Slicing', 'SSL Decrypt', 
    'Tunnel Encap', 'Tunnel Decap'
  ],
  'Load Balance': [
    'Masking', 'Source Port Labelling', 'De-Dup', 'APF', 'A SF', 'AFI (ASF)', 
    'FlowVUE', 'GTP Flow Filter', 'GTP Whitelist', 'GTP Flow Sampling', 
    'Strip Headers', 'Add Headers', 'Remove H/T', 'Slicing', 'Advanced Flow Slicing', 
    'Tunnel Encap', 'Tunnel Decap'
  ],
  'APF': [
    'Masking', 'Source Port Labelling', 'De-Dup', 'Load Balance', 'FlowVUE', 
    'Strip Headers', 'Add Headers', 'Slicing', 'Advanced Flow Slicing', 
    'Tunnel Encap'
  ],
  'A SF': [
    'Masking', 'Source Port Labelling', 'De-Dup', 'Load Balance', 'FlowVUE', 
    'Strip Headers', 'Add Headers', 'NetFlow 2nd level', 'Slicing', 
    'Advanced Flow Slicing', 'Tunnel Encap'
  ],
  'AFI (ASF)': [
    'Masking', 'De-Dup', 'Load Balance', 'AMI', 'NetFlow 2nd level', 
    'Slicing', 'Advanced Flow Slicing'
  ],
  'AMI': [
    'De-Dup', 'A SF', 'AFI (ASF)'
  ],
  'FlowVUE': [
    'Masking', 'Source Port Labelling', 'De-Dup', 'Load Balance', 'APF',
    'A SF', 'Strip Headers', 'Add Headers', 'Remove H/T', 'Slicing',
    'Advanced Flow Slicing'
  ],
  'GTP Flow Filter': [
    'Load Balance', 'GTP Whitelist', 'Slicing'
  ],
  'GTP Whitelist': [
    'Load Balance', 'GTP Flow Filter', 'Slicing'
  ],
  'GTP Flow Sampling': [
    'Load Balance', 'Slicing'
  ],
  'Strip Headers': [
    'Masking', 'Source Port Labelling', 'De-Dup', 'Load Balance', 'APF', 
    'A SF', 'FlowVUE', 'Add Headers', 'Remove H/T', 'Slicing', 
    'Advanced Flow Slicing', 'Tunnel Encap', 'Tunnel Decap'
  ],
  'Add Headers': [
    'Masking', 'Source Port Labelling', 'De-Dup', 'Load Balance', 'APF', 
    'A SF', 'FlowVUE', 'Strip Headers', 'Remove H/T', 'Slicing', 
    'Advanced Flow Slicing', 'Tunnel Encap', 'Tunnel Decap'
  ],
  'Remove H/T': [
    'Masking', 'Source Port Labelling', 'De-Dup', 'Load Balance', 'FlowVUE', 
    'Strip Headers', 'Add Headers', 'Slicing', 'Advanced Flow Slicing', 
    'Tunnel Encap', 'Tunnel Decap'
  ],
  'NetFlow 1st level': [
    'De-Dup'
  ],
  'NetFlow 2nd level': [
    'De-Dup', 'A SF', 'AFI (ASF)'
  ],
  'Slicing': [
    'Masking', 'Source Port Labelling', 'De-Dup', 'Load Balance', 'APF', 
    'A SF', 'AFI (ASF)', 'FlowVUE', 'GTP Flow Filter', 'GTP Whitelist', 
    'GTP Flow Sampling', 'Strip Headers', 'Add Headers', 'Remove H/T', 
    'Advanced Flow Slicing', 'Tunnel Encap', 'Tunnel Decap'
  ],
  'Advanced Flow Slicing': [
    'Masking', 'Source Port Labelling', 'De-Dup', 'Load Balance', 'APF', 
    'A SF', 'AFI (ASF)', 'FlowVUE', 'Strip Headers', 'Add Headers', 'Remove H/T', 
    'Slicing', 'Tunnel Encap', 'Tunnel Decap'
  ],
  'SSL Decrypt': [
    'De-Dup'
  ],
  'iSSL': [],
  'ICAP': [],
  'Tunnel Encap': [
    'Masking', 'Source Port Labelling', 'De-Dup', 'Load Balance', 'APF', 
    'A SF', 'Strip Headers', 'Add Headers', 'Remove H/T', 'Slicing', 
    'Advanced Flow Slicing'
  ],
  'Tunnel Decap': [
    'Masking', 'Source Port Labelling', 'De-Dup', 'Load Balance', 
    'Strip Headers', 'Add Headers', 'Remove H/T', 'Slicing', 
    'Advanced Flow Slicing'
  ]
};

/**
 * Returns the number of physical GigaSMART engines available on a chassis.
 */
export function getGigaSmartEngineCount(chassisModel: string, modules: string[] = []): number {
  const modelLower = chassisModel.toLowerCase();
  
  if (modelLower.includes('hc3')) {
    const smtBlades = modules.filter(m => {
      const u = String(m).toUpperCase();
      return u.includes('SMT-HC3') || u.includes('SMT-') || u.includes('C08') || u.includes('C05');
    }).length;
    return Math.max(smtBlades, 1);
  }

  if (modelLower.includes('hc1') && !modelLower.includes('plus')) {
    const count = 1; // 1 onboard Gen2 engine
    const extra = modules.filter(m => String(m).toUpperCase().includes('SMT-HC1-S')).length;
    return count + extra;
  }

  if (modelLower.includes('hc1-plus') || modelLower.includes('hc1 plus')) {
    const count = 1; // 1 built-in rear Gen3 engine (SMT-HC1A-R)
    const extra = modules.filter(m => String(m).toUpperCase().includes('SMT-HC1-S')).length;
    return count + extra;
  }

  if (modelLower.includes('hc2')) {
    const smtBlades = modules.filter(m => {
      const u = String(m).toUpperCase();
      return u.includes('SMT-HC0') || u.includes('SMT-') || u.includes('R25') || u.includes('X16');
    }).length;
    return Math.max(smtBlades, 1);
  }

  if (modelLower.includes('hct')) {
    const smtBlades = modules.filter(m => String(m).toUpperCase().includes('SMT-HC1-S')).length;
    return Math.max(smtBlades, 1);
  }

  return 1;
}

/**
 * Generates an actionable prompt when an incompatible operation pair is requested
 * on a single engine, advising which GigaSMART module/blade to add.
 */
export function getGigaSmartEnginePrompt(
  chassisModel: string,
  _installedModules: string[],
  actionA: string,
  actionB: string,
): string {
  const model = chassisModel.toLowerCase();
  const nameA = getCanonicalGsopName(actionA) || actionA;
  const nameB = getCanonicalGsopName(actionB) || actionB;

  if (model.includes('hc3')) {
    return `'${nameA}' and '${nameB}' cannot be combined in a single GigaSMART operation (GSOP). To run both operations on this GigaVUE-HC3, please install an additional GigaSMART card (e.g. SMT-HC3-C08 or SMT-HC3-C05) into an available module slot.`;
  }
  if (model.includes('hc1-plus') || model.includes('hc1 plus')) {
    return `'${nameA}' and '${nameB}' cannot be combined in a single GigaSMART operation (GSOP). To run both operations on this GigaVUE-HC1-Plus, please add a front GigaSMART engine module (SMT-HC1-S).`;
  }
  if (model.includes('hc1')) {
    return `'${nameA}' and '${nameB}' cannot be combined in a single GigaSMART operation (GSOP). To run both operations on this GigaVUE-HC1, please install an additional GigaSMART engine module (SMT-HC1-S) into the expansion bay.`;
  }
  if (model.includes('hc2')) {
    return `'${nameA}' and '${nameB}' cannot be combined in a single GigaSMART operation (GSOP). To run both operations on this GigaVUE-HC2, please install an additional GigaSMART module (SMT-HC0-R25 or SMT-HC0-X16).`;
  }
  return `'${nameA}' and '${nameB}' cannot be combined in a single GigaSMART operation (GSOP). An additional GigaSMART engine or multi-pass map is required.`;
}

/**
 * Validates if two GigaSMART action types can be combined together.
 * If 2 or more physical engines are installed on the chassis, multi-engine distribution permits the combination.
 */
export function areActionsCompatible(
  actionA: string,
  actionB: string,
  engineCount?: number,
  chassisModel = '',
  installedModules: string[] = [],
): { compatible: boolean; reason?: string; multiEngine?: boolean } {
  if (actionA === actionB) {
    return { compatible: true };
  }

  // Derive engine count if not explicitly supplied
  const effectiveEngineCount =
    engineCount !== undefined
      ? engineCount
      : chassisModel
      ? getGigaSmartEngineCount(chassisModel, installedModules)
      : 1;

  // If the chassis has multiple physical GigaSMART engines installed,
  // operations that cannot share a single GSOP can be distributed across engines!
  if (effectiveEngineCount >= 2) {
    return { compatible: true, multiEngine: true };
  }

  const nameA = getCanonicalGsopName(actionA);
  const nameB = getCanonicalGsopName(actionB);

  // If one of the actions is not in our combination matrix, we assume they are compatible
  if (!nameA || !nameB) {
    return { compatible: true };
  }

  const listA = GSOP_COMPATIBILITY[nameA] || [];
  const listB = GSOP_COMPATIBILITY[nameB] || [];

  const isCompatible = listA.includes(nameB) || listB.includes(nameA);

  if (!isCompatible) {
    const reason = chassisModel
      ? getGigaSmartEnginePrompt(chassisModel, installedModules, actionA, actionB)
      : `GigaSMART operation '${nameA}' cannot be combined with '${nameB}' in a single GSOP.`;
    return {
      compatible: false,
      reason,
    };
  }

  return { compatible: true };
}
