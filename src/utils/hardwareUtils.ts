/**
 * Hardware utility functions extracted from HardwareNodePanel.
 * Provides optic speed detection, board port capacity, and chassis base port capacity.
 */
import type { CustomNode, HardwareNodeData, InstalledOptic, PortInfo } from '../store/types';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';
import { getSupportedBoards } from './opticValidation';
import { skuService } from '../services/skuService';

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
// QSB-* BiDi optics carry no speed digit in their bare SKU (e.g. "QSB-521"),
// so they fall through every substring/prefix check below and used to resolve
// to 'Unknown' - which getOpticCage then defaulted to an SFP cage instead of
// the QSFP+ /QSFP28 cage every QSB part actually is. Keep this in step with
// the BIDI_OPTICS table in constants/tapOpticRules.ts.
const QSB_SPEED: Record<string, '40G' | '100G'> = {
  'QSB-501': '40G', 'QSB-502': '40G', 'QSB-504': '40G',
  'QSB-512': '100G', 'QSB-521': '100G', 'QSB-522': '100G',
  'QSB-523T': '100G', 'QSB-524T': '100G', 'QSB-531': '100G', 'QSB-532': '100G',
};

export const getOpticSpeed = (opticName: string): '1G' | '10G' | '25G' | '40G' | '100G' | '400G' | 'Unknown' => {
  const name = opticName.toUpperCase();
  if (name.startsWith('QSB-')) {
    const sku = name.split(' ')[0];
    return QSB_SPEED[sku] || '100G'; // every QSB part is 40G or 100G; 100G is the more common/newer default
  }
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
 * Looks up a module in the catalogue by SKU, case-insensitively.
 *
 * SKUs are typed by hand into several independently-maintained files
 * (hardwareCatalogue.json, opticRules.json, skus.json) and casing has drifted
 * between them before (e.g. PRT-HC1-x12 vs PRT-HC1-X12, SMT-HC3-c08 vs
 * SMT-HC3-C08) - an exact-match `find` silently returns no ports/icon/BOM row
 * for a module a user has actually installed. Every catalogue module lookup
 * by SKU should go through this helper rather than a fresh `===`/`find`.
 */
export const findModuleBySku = (boardSku: string) => {
  if (!boardSku) return undefined;
  const cleanSku = boardSku.replace(/\s*\(Slot\s*\d+\)/i, '').replace(/\s*\(Main\s*Board\)/i, '').replace(/\s*\(Base\s*Ports\)/i, '').trim().toLowerCase();
  return hardwareCatalogue.modules.find(m => m.sku.toLowerCase() === cleanSku || m.model.toLowerCase() === cleanSku);
};

/**
 * Robust catalogue lookup for a chassis across TA and HC series, supporting normalized names.
 */
export const findChassisInCatalogue = (model: string, sku?: string) => {
  const allSeries = [...hardwareCatalogue.ta_series, ...hardwareCatalogue.hc_series];
  if (sku) {
    const skuMatch = allSeries.find(c => c.sku?.toLowerCase() === sku.toLowerCase());
    if (skuMatch) return skuMatch;
  }
  if (!model) return undefined;
  const cleanModel = model.trim().toLowerCase();
  const stripped = cleanModel.replace(/^gigavue[- ]/i, '');
  return allSeries.find(c => {
    const cModel = c.model.toLowerCase();
    const cStripped = cModel.replace(/^gigavue[- ]/i, '');
    return cModel === cleanModel || cStripped === stripped || cModel === stripped || cStripped === cleanModel;
  });
};

/**
 * Returns the SFP and QSFP cage count for a given board/module name.
 */
export const getBoardPortCapacity = (
  boardSku: string,
): { [portType: string]: number } => {
  const module = findModuleBySku(boardSku);
  if (module) {
    return sumPortCounts(module.ports);
  }

  return {};
};

export interface ModuleSlotPosition {
  number: number;
  label: string;
  /** Fractional (0-1) rect of the slot's bay on the chassis image, if calibrated. */
  box?: { x: number; y: number; width: number; height: number };
}

/**
 * Slot numbering for a chassis's module bays. Where the catalogue defines
 * `module_slot_positions` these are the real silkscreen numbers and physical
 * positions (HC1/HC1-Plus bays are slots 2 and 3, not 1 and 2); otherwise this
 * falls back to a plain 1..N sequence.
 */
export const getModuleSlotPositions = (model: string, sku?: string): ModuleSlotPosition[] => {
  const chassis = findChassisInCatalogue(model, sku) as
    | { module_slots?: number; module_slot_positions?: ModuleSlotPosition[] }
    | undefined;
  if (!chassis) return [];
  if (chassis.module_slot_positions) return chassis.module_slot_positions;
  return Array.from({ length: chassis.module_slots || 0 }, (_, i) => ({ number: i + 1, label: '' }));
};

/** Catalogue front-panel photo path (relative, e.g. `./hardware-icons/GigaVUE-HC1.png`) for a chassis model/SKU — resolve with `resolveHardwareIcon` before use. */
export const getChassisImagePath = (model: string, sku?: string): string | undefined => {
  const chassis = findChassisInCatalogue(model, sku) as { image?: string } | undefined;
  return chassis?.image;
};

/**
 * Bay count for a TAP tray chassis (TAP-M100T = 3, TAP-M200T = 6, TAP-M202ULT = 2),
 * read from `hardwareCatalogue.taps`' `max_modules`. Separate from
 * `getModuleSlotPositions` because trays live in a different catalogue array, key
 * their capacity under a differently-named field, and (unlike HC1's base-chassis-
 * is-slot-1 wrinkle) have no non-obvious physical bay numbering to model - a tray
 * is just bays 1..N left to right.
 */
export const getTrayBayCount = (model: string, sku?: string): number => {
  const tray = hardwareCatalogue.taps.find(t => (sku && t.sku === sku) || t.model === model) as
    | { max_modules?: number }
    | undefined;
  return tray?.max_modules || 0;
};

export interface TrayLayout {
  rows: number;
  cols: number;
  grid: number[][];
}

/**
 * Returns physical bay grid layout for a TAP tray:
 * - TAP-M200T (2U): 2 rows of 3 bays (Top row: 1, 2, 3; Bottom row: 4, 5, 6)
 * - TAP-M100T (1U): 1 row of 3 bays (1, 2, 3)
 * - TAP-M202ULT (1U): 1 row of 2 bays (1, 2)
 */
export const getTrayLayout = (model: string, sku?: string): TrayLayout => {
  const bays = getTrayBayCount(model, sku);
  if (bays === 6 || model.includes('M200') || (sku && sku.includes('M200'))) {
    return {
      rows: 2,
      cols: 3,
      grid: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    };
  }
  return {
    rows: 1,
    cols: bays || 3,
    grid: [Array.from({ length: bays || 3 }, (_, i) => i + 1)],
  };
};

/**
 * Rack height (RU) for a device - prefers catalogue's `ru` field, with fallback heuristics.
 */
export const getDeviceRU = (model: string, sku?: string): number => {
  if (!model) return 1;
  const catalogueEntry = [...hardwareCatalogue.taps, ...hardwareCatalogue.ta_series, ...hardwareCatalogue.hc_series]
    .find((c: { model: string; sku: string; ru?: number }) => (sku && c.sku === sku) || c.model === model) as
    { ru?: number } | undefined;
  if (catalogueEntry?.ru !== undefined) return catalogueEntry.ru;
  if (model.includes('HC3')) return 3;
  if (model.includes('HC2')) return 2;
  if (model.includes('HC1') || model.includes('HCT')) return 1;
  if (model.includes('TA25') || model.includes('TA100') || model.includes('TA200') || model.includes('TA400')) return 1;
  if (model.includes('M200')) return 1;
  if (model.includes('M100')) return 0.5;
  if (model.includes('TAP')) return 1;
  return 1;
};

/** True for a physical tap-module "stick" (TAP-M251T, TAP-M253T, ...) - the only
 *  kind of node that belongs in a tray bay, as opposed to a tray itself, an active
 *  G-TAP appliance, or unrelated hardware dragged onto a bay by mistake. */
export const isTapModule = (model: string, sku?: string): boolean => {
  const entry = hardwareCatalogue.taps.find(t => (sku && t.sku === sku) || t.model === model) as
    | { type?: string }
    | undefined;
  return entry?.type === 'module';
};

/**
 * True for the PNL-M341T/PNL-M343T MPO breakout panel catalogue entries - a
 * passive module, not a chassis, not a tap (though it shares the same tap-tray
 * bays and is picked up by isTapModule() above for that purpose).
 */
export const isBreakoutPanelModel = (model: string): boolean =>
  model.startsWith('PNL-M341') || model.startsWith('PNL-M343');

/**
 * Determines whether a node is a valid Gigamon rack-mountable chassis, tray,
 * or TAP device belonging to the Gigamon Bill of Materials.
 * Custom tools, packet tools, third-party probes (e.g. Ericsson, Dynatrace, Wireshark),
 * and non-BOM equipment are explicitly excluded from the rack and unracked warnings.
 */
export const isRackableGigamonEquipment = (node: CustomNode): boolean => {
  if (!node) return false;
  if (node.type === 'toolNode' || node.type === 'inputNode' || node.type === 'mapNode' || node.type === 'gigasmartNode') {
    return false;
  }
  const configType = String(node.data?.configType || '');
  if (
    configType === 'Packet Tool' ||
    configType === 'Metadata Tool' ||
    configType === 'Storage Tool' ||
    configType.includes('Tool') ||
    configType.includes('Probe')
  ) {
    return false;
  }

  const model = String(node.data?.model || node.data?.toolName || '');
  const sku = node.data?.sku as string | undefined;

  const inCatalogue = [...hardwareCatalogue.taps, ...hardwareCatalogue.ta_series, ...hardwareCatalogue.hc_series]
    .some(c => (sku && c.sku === sku) || c.model === model);

  if (inCatalogue) return true;

  // Recognized Gigamon hardware model families
  const isRecognizedGigamonFamily =
    model.startsWith('GigaVUE-') ||
    model.startsWith('GVS-') ||
    model.startsWith('TAP-') ||
    model.startsWith('G-TAP') ||
    model.startsWith('PNL-') ||
    Boolean(sku && (sku.startsWith('GVS-') || sku.startsWith('TAP-') || sku.startsWith('PNL-') || sku.startsWith('TA-') || sku.startsWith('HC')));

  return Boolean(isRecognizedGigamonFamily && (node.type === 'hardwareNode' || configType === 'TAP Device' || configType === 'Chassis'));
};

/**
 * Returns the catalogue icon path for a board/module SKU (e.g. "PRT-HC1-Q04X08"),
 * for compositing onto a chassis's front-panel photo in the hardware summary view.
 */
export const getBoardIcon = (boardSku: string): string | undefined => {
  return findModuleBySku(boardSku)?.image;
};

/**
 * Returns base port capacity for a given chassis model (no boards installed).
 */
export const getChassisBasePortCapacity = (model: string): { [portType: string]: number } => {
  const chassis = findChassisInCatalogue(model);

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
 * Formats an optic string with both its SKU and clean human-readable specification
 * for canvas overlays and export diagram mode (e.g. "Q28-503T (100G QSFP28, Singlemode LR4)").
 */
export const getOpticFriendlyDescription = (opticName: string): string => {
  if (!opticName) return '';
  const trimmed = opticName.trim();
  const rawSku = trimmed.split(' ')[0].replace(/[,\(\)\[\]]/g, '');
  const sku = rawSku.toUpperCase();

  // Try looking up SKU in catalogue
  const skuItem = skuService.getSKUByPartNumber(sku);
  let desc = '';

  if (skuItem?.description) {
    desc = skuItem.description
      .replace(/\.?\s*(?:TAA Compliant|Not TAA Compliant)\.?/gi, '')
      .replace(/[,\.]\s*$/, '')
      .trim();
  }

  if (!desc) {
    const parenthesizedMatch = trimmed.match(/\((.*?)\)/);
    if (parenthesizedMatch) {
      desc = parenthesizedMatch[1].trim();
    }
  }

  if (!desc) {
    const speed = getOpticSpeed(trimmed);
    const fiber = getOpticFiberType(trimmed);
    const fiberLabel = fiber === 'SM' ? 'Singlemode' : fiber === 'MM' ? 'Multimode' : fiber === 'Copper' ? 'Copper' : '';
    if (speed && speed !== 'Unknown') {
      desc = `${speed} ${fiberLabel}`.trim();
    }
  }

  if (desc) {
    // If the description starts with the SKU, strip it to avoid duplication
    const descCleaned = desc.replace(new RegExp(`^${sku}\\s*[-:,]?\\s*`, 'i'), '').trim();
    if (descCleaned) {
      return `${sku} (${descCleaned})`;
    }
  }

  return trimmed;
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

/**
 * Some modules expose cages that run at different maximum speeds depending on
 * the chassis they're plugged into - e.g. PRT-HC1-Q04X08 on GigaVUE-HCT runs 4
 * of its SFP cages at 25G and the other 4 at 10G (on HC1/HC1-Plus all 8 run 25G),
 * per its SKU description. The aggregate SFP cage count alone can't express
 * that split, so this returns a per-speed cap for the given board/model, or
 * Infinity if no such sub-cap applies.
 */
export const getBoardSpeedSubCap = (model: string, boardName: string, speed: string): number => {
  const name = boardName.toUpperCase();
  if (model.includes('HCT') && name.includes('Q04X08') && speed === '25G') return 4;
  return Infinity;
};

const getBoardPortSpecs = (boardSku: string): PortInfo[] => {
  return (findModuleBySku(boardSku)?.ports as PortInfo[]) || [];
};

const getChassisBasePortSpecs = (model: string): PortInfo[] => {
  const chassis = findChassisInCatalogue(model) as { ports?: PortInfo[]; base_ports?: PortInfo[] } | undefined;
  return chassis?.ports || chassis?.base_ports || [];
};

export interface MaxSpeedCapacity {
  speed: string;
  maxPorts: number;
  config: string;
  /** True when reaching `maxPorts` requires feeding some QSFP-family cages through an
   *  external MPO breakout panel (PNL-M341T/M343T) rather than native cages alone. */
  viaBreakout?: boolean;
}

const SPEED_DISPLAY_ORDER = ['400G', '100G', '40G', '25G', '10G', '1G'];

/**
 * The parent (MPO-side) optic speed that feeds each breakout lane speed, once run
 * through an external MPO breakout panel - see breakoutRules.ts's LANE_SPEED_BY_PARENT.
 * Duplicated here rather than imported: breakoutRules.ts already imports from this
 * module, so importing it back would create a circular dependency.
 */
const BREAKOUT_PARENT_SPEED_FOR_LANE: Record<string, string> = { '10G': '40G', '25G': '100G', '100G': '400G' };
/** Every breakout panel fans one QSFP-family cage out to this many LC lanes (breakoutRules.ts's PANEL_LC_PER_GROUP). */
const BREAKOUT_LANES_PER_CAGE = 4;

/**
 * The generic per-module `ports[].speeds` list in hardwareCatalogue.json isn't always
 * chassis-accurate - e.g. PRT-HC1-Q04X08's QSFP28 cages are listed as ['40G','100G']
 * everywhere, but the matrix-verified opticRules.json shows GigaVUE-HCT only actually
 * offers 40G QSFP+ optics for that board (no Q28- 100G SKUs), while HC1/HC1-Plus offer
 * both. Intersecting against the real optic list per chassis+board corrects for this.
 */
const getBoardSpeedsFromOptics = (model: string, board: string): Set<string> => {
  const optics = getSupportedBoards(model).find(b => b.board === board)?.supportedOptics ?? [];
  const speeds = new Set<string>();
  optics.forEach(o => {
    const speed = getOpticSpeed(o);
    if (speed !== 'Unknown') speeds.add(speed);
  });
  return speeds;
};

/** Cage count across `portSpecs` running `speed`, capped by any board-specific sub-cap. */
const countAtSpeed = (model: string, board: string, portSpecs: PortInfo[], speed: string): number => {
  let count = portSpecs.filter(p => p.speeds.includes(speed)).reduce((sum, p) => sum + p.count, 0);
  const subCap = getBoardSpeedSubCap(model, board, speed);
  if (subCap !== Infinity) count = Math.min(count, subCap);
  return count;
};

/** How many extra `laneSpeed` ports a set of ports contributes by feeding their
 *  QSFP-family cages (that carry the matching parent speed) through an external MPO
 *  breakout panel - 0 if `laneSpeed` isn't a breakout lane speed, or none of these
 *  ports actually carry the parent speed. */
const breakoutCountAtSpeed = (model: string, board: string, portSpecs: PortInfo[], laneSpeed: string, availableSpeeds: Set<string>): number => {
  const parentSpeed = BREAKOUT_PARENT_SPEED_FOR_LANE[laneSpeed];
  if (!parentSpeed || !availableSpeeds.has(parentSpeed)) return 0;
  const cages = countAtSpeed(model, board, portSpecs.filter(p => p.type.toUpperCase().includes('QSFP')), parentSpeed);
  return cages * BREAKOUT_LANES_PER_CAGE;
};

/**
 * For HC-series chassis (which have interchangeable module slots), works out the
 * highest port count achievable at each optic speed if every slot were filled with
 * whichever single installable module maximises that speed - e.g. "how many 100G
 * ports can a GigaVUE-HC3 take?" (4x PRT-HC3-C16, 16 QSFP28 cages each = 64). For
 * 10G/25G, also considers feeding QSFP-family cages through an external MPO breakout
 * panel (PNL-M341T/M343T, 4 LC lanes per cage) when that beats native cages alone -
 * matching the "*" entries in Gigamon's own "Chassis Maximum Capabilities" datasheet
 * table, which are annotated exactly this way. Returns [] for chassis with no module
 * slots (TA-series, fixed-configuration units).
 */
export const getMaxChassisCapacityBySpeed = (model: string): MaxSpeedCapacity[] => {
  const chassis = findChassisInCatalogue(model) as { module_slots?: number } | undefined;
  const slotCount = chassis?.module_slots || 0;
  if (!slotCount) return [];

  const allBoards = getSupportedBoards(model);
  const installableBoards = allBoards.map(b => b.board).filter(b => !b.toLowerCase().includes('main') && !b.toLowerCase().includes('base'));
  const mainBoard = allBoards.find(b => b.board.toLowerCase().includes('main'));
  const baseSpeeds = mainBoard ? getBoardSpeedsFromOptics(model, mainBoard.board) : null;
  const mainBoardName = mainBoard?.board || '';

  const basePortSpecs = getChassisBasePortSpecs(model);

  const speedsSeen = new Set<string>();
  basePortSpecs.forEach(p => p.speeds.forEach(s => speedsSeen.add(s)));
  installableBoards.forEach(b => getBoardPortSpecs(b).forEach(p => p.speeds.forEach(s => speedsSeen.add(s))));
  // A breakout lane speed can be reachable even with no cage natively running it -
  // e.g. a chassis whose QSFP cages only run 40G/100G still yields 10G/25G lanes once
  // fed through an MPO breakout panel.
  Object.entries(BREAKOUT_PARENT_SPEED_FOR_LANE).forEach(([lane, parent]) => {
    if (speedsSeen.has(parent)) speedsSeen.add(lane);
  });

  const results: MaxSpeedCapacity[] = [];

  for (const speed of SPEED_DISPLAY_ORDER) {
    if (!speedsSeen.has(speed)) continue;
    const baseAvailable = baseSpeeds || speedsSeen;

    const baseNative = !baseSpeeds || baseSpeeds.has(speed) ? countAtSpeed(model, mainBoardName, basePortSpecs, speed) : 0;
    const baseBreakout = breakoutCountAtSpeed(model, mainBoardName, basePortSpecs, speed, baseAvailable);
    const baseCount = baseNative + baseBreakout;

    let bestBoard = '';
    let bestPerSlot = 0;
    let bestUsedBreakout = false;
    for (const board of installableBoards) {
      const boardSpeeds = getBoardSpeedsFromOptics(model, board);
      const portSpecs = getBoardPortSpecs(board);
      const nativeCount = boardSpeeds.has(speed) ? countAtSpeed(model, board, portSpecs, speed) : 0;
      const breakoutCount = breakoutCountAtSpeed(model, board, portSpecs, speed, boardSpeeds);
      const count = nativeCount + breakoutCount;
      if (count > bestPerSlot) {
        bestPerSlot = count;
        bestBoard = board;
        bestUsedBreakout = breakoutCount > 0;
      }
    }

    let maxPorts = baseCount + bestPerSlot * slotCount;
    if (maxPorts === 0) continue;

    const viaBreakout = baseBreakout > 0 || bestUsedBreakout;
    if (viaBreakout) {
      // Per the datasheet, dense QSFP fanout via breakout panels is capped below the
      // raw "every cage x4" arithmetic on some chassis (likely an ASIC/SerDes lane-
      // sharing limit) - see getMaxFanoutSfpPorts.
      maxPorts = Math.min(maxPorts, getMaxFanoutSfpPorts(model));
    }

    const configParts: string[] = [];
    if (bestPerSlot > 0) configParts.push(`${slotCount}x ${bestBoard}`);
    if (baseCount > 0) configParts.push('built-in ports');
    if (viaBreakout) configParts.push('using MPO breakout panel');
    results.push({ speed, maxPorts, config: configParts.join(' + '), viaBreakout });
  }

  return results;
};

/**
 * Counts the GigaSMART engines available on an HC-series chassis for its current
 * board configuration. HC1 and HC1-Plus each have one onboard/built-in engine on
 * the main board itself; HCT and HC3 have none built in. Every installed SMT-*
 * add-in board (e.g. SMT-HC1-S, SMT-HC3-C05/C08) contributes one additional engine
 * on any chassis that supports it. Returns 0 for TA-series (no GigaSMART support).
 */
export const getGigaSmartEngineCount = (model: string, hwData: HardwareNodeData): number => {
  const hasOnboardEngine = model.includes('HC1'); // matches HC1 and HC1-Plus, not HCT or HC3
  let count = hasOnboardEngine ? 1 : 0;

  const installedBoards = hwData.installedBoards || {};
  Object.values(installedBoards).forEach(boardName => {
    if (boardName && boardName.toUpperCase().startsWith('SMT-')) count += 1;
  });

  return count;
};

export const getTaLicenseLimits = (modelName: string, capacity: string): { [portType: string]: number; qsfp_400g: number } => {
  const cap = capacity || 'Full';
  const modelLower = (modelName || '').toLowerCase();

  const chassis = findChassisInCatalogue(modelName);

  if (chassis && (chassis as any).licensing && (chassis as any).licensing.tiers) {
    const tier = (chassis as any).licensing.tiers.find((t: any) => t.name.toLowerCase() === cap.toLowerCase());
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
  hasBuiltInCopper: boolean;
  usedBuiltInCopper: number;
  totalExpandedSfpPorts: number;
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
 * Computes the physical SFP/QSFP cage usage and remaining capacity for a
 * chassis, accounting for installed boards and built-in copper ports. MPO
 * breakout panels are separate hardwareNodes with their own ports (see
 * getPanelPorts in ports.ts) and no longer expand this chassis's own cage
 * count - the chassis side of a breakout link is just one ordinary used
 * QSFP cage, like any other optic.
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
  let usedBuiltInCopper = 0;
  let used400G = 0;

  installedOptics.forEach(opt => {
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
  });

  const totalUsedQsfpCages = usedQsfpOptics;
  const remainingQsfpCages = Math.max(0, totalQsfpCages - usedQsfpOptics);
  const totalExpandedSfpPorts = Math.min(totalSfpCages, getMaxFanoutSfpPorts(model));
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
    usedQsfpOptics,
    hasBuiltInCopper,
    usedBuiltInCopper,
    totalExpandedSfpPorts,
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
