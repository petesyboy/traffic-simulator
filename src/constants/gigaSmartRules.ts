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
