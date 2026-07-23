/**
 * Hardware utility functions extracted from HardwareNodePanel.
 * Provides optic speed detection, board port capacity, and chassis base port capacity.
 */
import type { HardwareNodeData, InstalledOptic, PortInfo } from '../store/types';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';

const sumPortCounts = (ports: (PortInfo | number)[]): { [portType: string]: number } => {
  const counts: { [portType: string]: number } = {};

  if (!ports) {
    return counts;
  }

  for (const port of ports) {
    if (typeof port === 'number') {
      // Legacy format, assume SFP
      counts['SFP'] = (counts['SFP'] || 0) + port;
      continue;
    }

    counts[port.type] = (counts[port.type] || 0) + port.count;
  }

  return counts;
};

/**
 * Determines the speed tier of an optic based on its SKU/name.
 */
export const getOpticSpeed = (opticName: string): '1G' | '10G' | '25G' | '40G' | '100G' | '400G' | 'Unknown' => {
  const name = opticName.toUpperCase();
  if (name.includes('400G') || name.startsWith('QDD-')) return '400G';
  if (name.includes('100G') || name.startsWith('Q28-')) return '100G';
  if (name.includes('40G') || name.startsWith('QSF-')) return '40G';
  if (name.includes('25G') || name.startsWith('SFP-55')) return '25G';
  if (name.includes('10G') || name.startsWith('SFP-53')) return '10G';
  if (name.includes('1G') || name.startsWith('SFP-50')) return '1G';
  return 'Unknown';
};

/**
 * Returns the speed of an optic in Mbps as a number.
 */
export const getOpticSpeedMbps = (opticName: string): number => {
  const speedMap: Record<string, number> = {
    '1G': 1000,
    '10G': 10000,
    '25G': 25000,
    '40G': 40000,
    '100G': 100000,
    '400G': 400000,
    'Unknown': 0,
  };
  return speedMap[getOpticSpeed(opticName)] ?? 0;
};

/**
 * Returns the SFP and QSFP cage count for a given board/module name.
 */
export const getBoardPortCapacity = (
  boardSku: string,
): { [portType: string]: number } => {
  const name = boardSku.toLowerCase();

  const module = hardwareCatalogue.modules.find(m => m.sku.toLowerCase() === name);
  if (module) {
    return sumPortCounts(module.ports);
  }

  return {};
};

/**
 * Returns base port capacity for a given chassis model (no boards installed).
 */
export const getChassisBasePortCapacity = (model: string): { [portType: string]: number } => {
  const allSeries = [...hardwareCatalogue.ta_series, ...hardwareCatalogue.hc_series];
  const chassis = allSeries.find(c => c.model === model);

  if (chassis) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- catalogue entries mix `ports` (new schema) and `base_ports` (legacy)
    const chassisAny = chassis as any;
    const ports = chassisAny.ports || chassisAny.base_ports;
    if (ports) {
      return sumPortCounts(ports);
    }
  }
  
  return {};
};

/**
 * Determines the fiber type of an optic: 'Copper', 'MM', 'SM', or ''.
 */
export const getOpticFiberType = (opticName: string): string => {
  const upper = opticName.toUpperCase();
  if (
    upper.includes('COPPER') ||
    upper.includes('BASE-T') ||
    upper.includes('BASET') ||
    upper.includes('ACTIVE CABLE') ||
    upper.includes('DIRECT ATTACH') ||
    upper.includes('DAC') ||
    upper.includes('-CU') ||
    upper.includes('SFP-501') ||
    upper.includes('SFP-531')
  ) {
    return 'Copper';
  }
  if (/\b(SX|SR\d*|LRM|SWDM\d*|BIDI)\b/i.test(upper) || upper.includes(' SX') || upper.includes(' SR') || upper.includes(' LRM') || upper.includes(' SWDM') || upper.includes('BIDI')) {
    return 'MM';
  }
  if (/\b(LX|LR\d*|ER\d*|ZR\d*|LH|DR\d*|FR\d*|CWDM\d*|PLR\d*|PSM\d*)\b/i.test(upper) || upper.includes(' LX') || upper.includes(' LR') || upper.includes(' ER') || upper.includes(' ZR') || upper.includes(' LH') || upper.includes(' DR') || upper.includes(' FR') || upper.includes(' CWDM') || upper.includes(' PLR') || upper.includes(' PSM')) {
    return 'SM';
  }
  return '';
};

/**
 * Formats an optic label with fiber type badge and TAA indicator.
 */
export const formatOpticLabel = (opticName: string): string => {
  const type = getOpticFiberType(opticName);
  const skuMatch = opticName.match(/^([A-Z0-9]+-[A-Z0-9]+)/i);
  const isTAA = skuMatch ? /T$/i.test(skuMatch[1]) : false;
  let label = type ? `${opticName} [${type}]` : opticName;
  if (isTAA) label += ' (TAA)';
  return label;
};

/**
 * Returns a human-readable description for a board/module name.
 */
export const getBoardDescription = (boardName: string, model: string): string => {
  const name = boardName.toUpperCase();
  const isPlus = model.includes('Plus');
  const isHct = model.includes('HCT');

  let desc = '';
  if (name.includes('Q04X08')) {
    // Same PRT-HC1-Q04X08 module runs different port speeds depending on which
    // chassis it's installed in (per its SKU description) - same 4 QSFP + 8 SFP
    // cage form factor throughout, but HCT splits the 8 SFP cages across two speeds.
    if (isPlus) desc = '4x 100G QSFP28 & 8x 25G SFP28';
    else if (isHct) desc = '4x 40G QSFP+ & 4x 25G SFP28 & 4x 10G SFP+';
    else desc = '4x 40G QSFP+ & 8x 10G SFP+';
  } else if (name.includes('D25A24')) {
    desc = 'Bypass: 2x 10G SR Pairs & 20x 10G SFP+';
  } else if (name.includes('G12')) {
    // HCT-only module - distinct from PRT-HC1-X12 below despite the similar SKU name.
    desc = '6x RJ45 (10/100/1000M) & 6x SFP (100M/1G)';
  } else if (name.includes('X12')) {
    desc = '12x 10G/1G SFP+';
  } else if (name.includes('G10040')) {
    // Fixed port speed on HC1-Plus/HCT; HC1 auto-negotiates down to 10/100M too.
    desc = (isPlus || isHct) ? '4x TAP/Bypass Pairs, 1000M Copper' : '4x TAP/Bypass Pairs, 10/100/1000M Copper';
  } else if (name.includes('X24')) {
    desc = '24x 25G/10G SFP28/SFP+';
  } else if (name.includes('C08Q08')) {
    desc = '8x 100G QSFP28 & 8x 40G QSFP+';
  } else if (name.includes('C16')) {
    desc = '16x 100G QSFP28';
  } else if (name.includes('C08')) {
    desc = '8x 100G QSFP28';
  } else if (name.includes('C05')) {
    desc = '5x 100G/40G QSFP28';
  } else if (name.includes('C25F2G')) {
    desc = 'Bypass: 2x 100G SR4 Pairs & 16x 10G SFP+';
  } else if (name.includes('C35C2G')) {
    desc = 'Bypass: 2x 100G LR Pairs & 16x 10G SFP+';
  } else if (name.includes('Q35C2G')) {
    desc = 'Bypass: 2x 40G LR Pairs & 16x 10G SFP+';
  }

  const hasGigaSmart = name.startsWith('SMT-');

  if (desc) {
    return `${boardName} (${hasGigaSmart ? 'GigaSMART Engine + ' : ''}${desc})`;
  }
  return boardName + (hasGigaSmart ? ' (GigaSMART Engine)' : '');
};

export const getTaLicenseLimits = (modelName: string, capacity: string): { [portType: string]: number; qsfp_400g: number } => {
  const modelLower = modelName.toLowerCase();
  const cap = capacity || 'Full';

  const chassis = hardwareCatalogue.ta_series.find(c => c.model.toLowerCase() === modelLower);

  if (chassis && chassis.licensing && chassis.licensing.tiers) {
    const tier = chassis.licensing.tiers.find(t => t.name.toLowerCase() === cap.toLowerCase());
    if (tier) {
      const counts = sumPortCounts(tier.ports);
      return { ...counts, qsfp_400g: 0 };
    }
  }
  
  // Fallback for models not yet in the catalogue with the new structure
  if (modelLower.includes('ta400e')) {
    if (cap === '100G') return { 'SFP+': 2, 'QSFP28': 32, qsfp_400g: 0 };
    if (cap === 'Upgrade') return { 'SFP+': 2, 'QSFP28': 32, qsfp_400g: 16 };
    return { 'SFP+': 2, 'QSFP28': 32, qsfp_400g: 32 }; // Full
  }
  return { qsfp_400g: 0 };
};

// Per the official Gigamon HC-series datasheet's "Chassis Maximum Capabilities"
// table, the max achievable 10G/25G port count via QSFP fanout/breakout is
// capped below what raw "every cage broken out 4x" arithmetic gives on some
// chassis — e.g. GigaVUE-HC3: 4 slots x 16 QSFP28 cages x 4 = 256 in theory,
// but the datasheet documents a 128 max (likely an ASIC/SerDes lane-sharing
// limit not otherwise broken out in Gigamon's public reference material).
const MAX_FANOUT_SFP_PORTS: Record<string, number> = {
  'GigaVUE-HC3': 128,
};

export const getMaxFanoutSfpPorts = (model: string): number => MAX_FANOUT_SFP_PORTS[model] ?? Infinity;

export interface CageCapacityBreakdown {
  totalSfpCages: number;
  totalQsfpCages: number;
  usedSfpOptics: number;
  usedQsfpOptics: number;
  usedBreakouts: number;
  hasBuiltInCopper: boolean;
  usedBuiltInCopper: number;
  totalExpandedSfpPorts: number;
  breakoutSfpExpansion: number;
  remainingSfpCages: number;
  remainingQsfpCages: number;
  licensedSfpCages: number;
  licensedQsfpCages: number;
  remainingLicensedSfpCages: number;
  remainingLicensedQsfpCages: number;
  licensedQsfp400gCages: number;
  remainingLicensedQsfp400gCages: number;
  isLicensed: boolean;
  used400G: number;
}

/**
 * Computes the physical SFP/QSFP cage usage and remaining capacity for a chassis,
 * accounting for installed boards, breakout panel expansion, and built-in copper ports.
 */
export const getCageCapacityBreakdown = (
  model: string,
  hwData: HardwareNodeData
): CageCapacityBreakdown => {
  const installedOptics: InstalledOptic[] = hwData.optics || [];
  const installedBoards = hwData.installedBoards || {};
  const portCapacity = hwData.portCapacity || 'Full';

  let totalSfpCages = 0;
  let totalQsfpCages = 0;

  const chassisCapacity = getChassisBasePortCapacity(model);
  // Only chassis whose catalogue entry lists physical RJ45 base ports (currently just
  // GigaVUE-HC1) actually have built-in copper data ports. TA-series chassis (TA25E,
  // TA100, TA200, TA400, etc.) also expose a "Base Ports" board in opticRules.json, but
  // that board is entirely SFP/QSFP cages - every one of its data ports needs a transceiver.
  const hasBuiltInCopper = 'RJ45' in chassisCapacity;
  for (const portType in chassisCapacity) {
    if (portType.toUpperCase().includes('QSFP')) {
      totalQsfpCages += chassisCapacity[portType];
    } else if (portType.toUpperCase().includes('SFP')) {
      totalSfpCages += chassisCapacity[portType];
    }
  }


  Object.values(installedBoards).forEach(boardName => {
    if (!boardName) return;
    const cages = getBoardPortCapacity(boardName);
    for (const portType in cages) {
      if (portType.toUpperCase().includes('QSFP')) {
        totalQsfpCages += cages[portType];
      } else if (portType.toUpperCase().includes('SFP')) {
        totalSfpCages += cages[portType];
      }
    }
  });

  let usedSfpOptics = 0;
  let usedQsfpOptics = 0;
  let usedBreakouts = 0;
  let usedBuiltInCopper = 0;
  let used400G = 0;

  installedOptics.forEach(opt => {
    if (opt.optic.includes('PNL-M341') || opt.optic.includes('PNL-M343')) {
      usedBreakouts += opt.qty;
    } else {
      const speed = getOpticSpeed(opt.optic);
      if (speed === '400G') {
        used400G += opt.qty;
      }
      const isQsfp = speed === '100G' || speed === '40G' || speed === '400G';
      const isCopper = getOpticFiberType(opt.optic) === 'Copper';

      if (isQsfp) {
        usedQsfpOptics += opt.qty;
      } else {
        if (hasBuiltInCopper && isCopper && opt.optic.includes('SFP-501')) {
          const countForBuiltIn = Math.min(opt.qty, 4 - usedBuiltInCopper);
          usedBuiltInCopper += countForBuiltIn;
          usedSfpOptics += (opt.qty - countForBuiltIn);
        } else {
          usedSfpOptics += opt.qty;
        }
      }
    }
  });

  const totalUsedQsfpCages = usedQsfpOptics + usedBreakouts;
  const remainingQsfpCages = Math.max(0, totalQsfpCages - usedQsfpOptics - usedBreakouts);
  const breakoutSfpExpansion = usedBreakouts * 4;
  const totalExpandedSfpPorts = Math.min(totalSfpCages + breakoutSfpExpansion, getMaxFanoutSfpPorts(model));
  const remainingSfpCages = Math.max(0, totalExpandedSfpPorts - usedSfpOptics);

  const isLicensed = model.includes('TA25') || model.includes('TA200') || model.includes('TA400E');
  
  const licenseLimits = getTaLicenseLimits(model, portCapacity);

  let licensedSfpCages = 0;
  let licensedQsfpCages = 0;

  for (const portType in licenseLimits) {
    if (portType === 'qsfp_400g') continue; // tracked separately as licensedQsfp400gCages below
    if (portType.toUpperCase().includes('QSFP')) {
      licensedQsfpCages += licenseLimits[portType as keyof typeof licenseLimits] as number;
    } else if (portType.toUpperCase().includes('SFP')) {
      licensedSfpCages += licenseLimits[portType as keyof typeof licenseLimits] as number;
    }
  }
  
  if (!isLicensed) {
    licensedSfpCages = totalExpandedSfpPorts;
    licensedQsfpCages = totalQsfpCages;
  }
  
  const licensedQsfp400gCages = isLicensed ? licenseLimits.qsfp_400g : 0;

  const remainingLicensedSfpCages = Math.max(0, licensedSfpCages - usedSfpOptics);
  const remainingLicensedQsfpCages = Math.max(0, licensedQsfpCages - totalUsedQsfpCages);
  const remainingLicensedQsfp400gCages = Math.max(0, licensedQsfp400gCages - used400G);

  return {
    totalSfpCages,
    totalQsfpCages,
    usedSfpOptics,
    usedBreakouts,
    usedQsfpOptics,
    hasBuiltInCopper,
    usedBuiltInCopper,
    totalExpandedSfpPorts,
    breakoutSfpExpansion,
    remainingSfpCages,
    remainingQsfpCages,
    licensedSfpCages,
    licensedQsfpCages,
    remainingLicensedSfpCages,
    remainingLicensedQsfpCages,
    licensedQsfp400gCages,
    remainingLicensedQsfp400gCages,
    isLicensed,
    used400G,
  };
};



/**
 * Returns just the remaining free SFP/QSFP cage counts for a chassis. Returns
 * zero capacity for TAP modules, which have no installable optic cages.
 */
export const getRemainingCageCapacity = (model: string, hwData: HardwareNodeData): { sfp: number; qsfp: number } => {
  if (model.includes('TAP')) return { sfp: 0, qsfp: 0 };
  const breakdown = getCageCapacityBreakdown(model, hwData);
  return { sfp: breakdown.remainingSfpCages, qsfp: breakdown.remainingQsfpCages };
};

/**
 * Parses the maximum number of tapped links from a TAP module's description.
 * Defaults to 1 if not found.
 * @param description The full SKU description of the TAP module.
 */
export const getTapLinkCapacity = (description: string): number => {
  if (!description) return 1;
  const match = description.match(/taps (\d+) links?/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return 1;
};
