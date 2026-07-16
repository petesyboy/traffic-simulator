/**
 * Hardware utility functions extracted from HardwareNodePanel.
 * Provides optic speed detection, board port capacity, and chassis base port capacity.
 */
import { getSupportedBoards } from './opticValidation';
import type { HardwareNodeData, InstalledOptic } from '../store/types';

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
  model: string,
  isPlus: boolean
): { sfp: number; qsfp: number } => {
  const name = boardSku.toLowerCase();
  const modelLower = model.toLowerCase();

  if (modelLower.includes('ta25')) {
    return { sfp: 48, qsfp: 8 };
  }
  if (modelLower.includes('ta200')) {
    return { sfp: 0, qsfp: 64 };
  }
  if (modelLower.includes('ta400e')) {
    return { sfp: 2, qsfp: 32 };
  }
  if (modelLower.includes('ta400')) {
    return { sfp: 0, qsfp: 32 };
  }

  if (name.includes('main') || name.includes('base') || name.includes('hc1-x12g4') || name.includes('hc1p-c04x08') || name.includes('hc1p-base') || name.includes('hct-c02')) {
    if (isPlus) {
      return { sfp: 8, qsfp: 4 };
    } else if (modelLower.includes('hct')) {
      return { sfp: 4, qsfp: 2 };
    } else { // HC1
      return { sfp: 12, qsfp: 0 };
    }
  }

  if (name.includes('q04x08')) {
    return { sfp: 8, qsfp: 4 };
  }
  if (name.includes('d25a24') || name.includes('bps-hc1-d25a24')) {
    return { sfp: 24, qsfp: 0 };
  }
  if (name.includes('x12') || name.includes('g12')) {
    return { sfp: 12, qsfp: 0 };
  }
  if (name.includes('x24')) {
    return { sfp: 24, qsfp: 0 };
  }
  if (name.includes('c08q08')) {
    return { sfp: 0, qsfp: 16 };
  }
  if (name.includes('c16')) {
    return { sfp: 0, qsfp: 16 };
  }
  if (name.includes('c08')) {
    return { sfp: 0, qsfp: 8 };
  }
  if (name.includes('c05')) {
    return { sfp: 0, qsfp: 5 };
  }
  if (name.includes('bps-hc3')) {
    return { sfp: 16, qsfp: 4 };
  }
  return { sfp: 0, qsfp: 0 };
};

/**
 * Returns base port capacity for a given chassis model (no boards installed).
 */
export const getChassisBasePortCapacity = (model: string): { sfp: number; qsfp: number } => {
  const modelLower = model.toLowerCase();
  if (modelLower.includes('ta25')) return { sfp: 48, qsfp: 8 };
  if (modelLower.includes('ta200')) return { sfp: 0, qsfp: 64 };
  if (modelLower.includes('ta400e')) return { sfp: 2, qsfp: 32 };
  if (modelLower.includes('ta400')) return { sfp: 0, qsfp: 32 };
  if (modelLower.includes('hct')) return { sfp: 4, qsfp: 2 };
  if (modelLower.includes('hc1-plus') || modelLower.includes('hc1 plus')) return { sfp: 8, qsfp: 4 };
  if (modelLower.includes('hc1')) return { sfp: 12, qsfp: 0 };
  if (modelLower.includes('hc3')) return { sfp: 0, qsfp: 0 };
  return { sfp: 0, qsfp: 0 };
};

/**
 * Determines the fiber type of an optic: 'Copper', 'MM', 'SM', or ''.
 */
export const getOpticFiberType = (opticName: string): string => {
  const upper = opticName.toUpperCase();
  if (upper.includes('COPPER') || upper.includes('BASE-T') || upper.includes('BASET') || upper.includes('ACTIVE CABLE') || upper.includes('DIRECT ATTACH') || upper.includes('DAC')) {
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

  let desc = '';
  if (name.includes('Q04X08')) {
    desc = isPlus ? '4x 100G QSFP28 & 8x 25G SFP28' : '4x 40G QSFP+ & 8x 10G SFP+';
  } else if (name.includes('D25A24')) {
    desc = 'Bypass: 2x 10G SR Pairs & 20x 10G SFP+';
  } else if (name.includes('X12') || name.includes('G12')) {
    desc = '12x 10G/1G SFP+';
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
  const isPlus = model.includes('Plus');

  const supportedBoards = getSupportedBoards(model, hwData.portCapacity as string, installedOptics);
  const availableOpticBoards: { board: string }[] = [];

  const mainBoardObj = supportedBoards.find(b => b.board.toLowerCase().includes('main') || b.board.toLowerCase().includes('base'));
  if (mainBoardObj) {
    availableOpticBoards.push({ board: mainBoardObj.board });
  }
  Object.entries(installedBoards).forEach(([slotIdx, boardName]) => {
    if (!boardName) return;
    const boardTemplate = supportedBoards.find(b => b.board === boardName);
    if (boardTemplate) {
      availableOpticBoards.push({ board: `${boardName} (Slot ${slotIdx})` });
    }
  });

  let totalSfpCages = 0;
  let totalQsfpCages = 0;
  let hasBuiltInCopper = false;

  availableOpticBoards.forEach(b => {
    const cages = getBoardPortCapacity(b.board, model, isPlus);
    totalSfpCages += cages.sfp;
    totalQsfpCages += cages.qsfp;

    const name = b.board.toLowerCase();
    const modelLower = model.toLowerCase();
    if ((name.includes('main') || name.includes('base') || name.includes('hc1-x12g4')) && !isPlus && !modelLower.includes('hct') && !modelLower.includes('tap')) {
      hasBuiltInCopper = true;
    }
  });

  let usedSfpOptics = 0;
  let usedQsfpOptics = 0;
  let usedBreakouts = 0;
  let usedBuiltInCopper = 0;

  installedOptics.forEach(opt => {
    if (opt.optic.includes('PNL-M341') || opt.optic.includes('PNL-M343')) {
      usedBreakouts += opt.qty;
    } else {
      const speed = getOpticSpeed(opt.optic);
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
  const remainingQsfpCages = Math.max(0, totalQsfpCages - totalUsedQsfpCages);
  const breakoutSfpExpansion = usedBreakouts * 4;
  const totalExpandedSfpPorts = totalSfpCages + breakoutSfpExpansion;
  const remainingSfpCages = Math.max(0, totalExpandedSfpPorts - usedSfpOptics);

  return {
    totalSfpCages,
    totalQsfpCages,
    usedSfpOptics,
    usedQsfpOptics,
    usedBreakouts,
    hasBuiltInCopper,
    usedBuiltInCopper,
    totalExpandedSfpPorts,
    breakoutSfpExpansion,
    remainingSfpCages,
    remainingQsfpCages,
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
