import opticRulesRaw from '../constants/opticRules.json';

// Define the shape of our optic rules JSON
type OpticRulesType = Record<string, Record<string, string[]>>;
const opticRules = opticRulesRaw as OpticRulesType;

export interface OpticSupport {
  board: string;
  supportedOptics: string[];
}

/**
 * Returns a list of boards/modules and their supported optics for a given hardware model.
 */
export function getSupportedBoards(model: string, portCapacity?: string, installedOptics?: { optic: string }[]): OpticSupport[] {
  const keys = Object.keys(opticRules);
  // An exact match must win outright before falling back to prefix matching below -
  // otherwise a longer key that happens to start with this model's name (e.g. the
  // "GigaVUE-HC1-Plus" rules block starting with "GigaVUE-HC1") would shadow the
  // model's own exact rules block once sorted longest-first, silently handing a base
  // chassis a variant's optic/speed capabilities (e.g. 100G cages HC1 doesn't have).
  const exactMatch = keys.find(k => k === model);
  const match = exactMatch ?? [...keys]
    .sort((a, b) => b.length - a.length)
    .find(k => k.startsWith(model + ' ') || model.startsWith(k.split(' ')[0]));
  if (!match) return [];
  
  const rules = opticRules[match];
  if (!rules) return [];

  const isTA400No400G = model.includes('TA400') && portCapacity === '100G';
  const isTaOrHc = model.includes('TA') || model.includes('HC');
  const hasBreakoutPanel = installedOptics?.some(opt => opt.optic.includes('PNL-M341') || opt.optic.includes('PNL-M343'));

  return Object.keys(rules).map(board => {
    let supportedOptics = rules[board].filter(opt => opt !== 'Cable');
    
    // If TA400 has no 400G ports enabled, it cannot accept 400G optics
    if (isTA400No400G) {
      supportedOptics = supportedOptics.filter(opt => !opt.includes('400G'));
    }

    if (isTaOrHc) {
      supportedOptics = [
        ...supportedOptics,
        "PNL-M341 (40/100G Multimode Breakout Panel)",
        "PNL-M343 (40/100/400G Singlemode Breakout Panel)"
      ];
      if (hasBreakoutPanel) {
        // Add 10G and 25G optics for breakout support
        const breakoutOptics = [
          "SFP-532 (10G SFP+ SR)",
          "SFP-532T (10G SFP+ SR)",
          "SFP-533 (10G SFP+ LR)",
          "SFP-533T (10G SFP+ LR)",
          "SFP-552 (25G SFP28 SR)",
          "SFP-552T (25G SFP28 SR)",
          "SFP-553T (25G SFP28 LR)"
        ];
        // Only append ones that aren't already supported
        breakoutOptics.forEach(bo => {
          if (!supportedOptics.includes(bo)) {
            supportedOptics.push(bo);
          }
        });
      }
    }

    return {
      board,
      supportedOptics
    };
  });
}

/**
 * Validates if a chosen optic can be installed in a specific board on the given hardware model.
 */
export function validateOptic(
  model: string,
  board: string,
  optic: string,
  portCapacity?: string,
  installedOptics?: { optic: string }[]
): { valid: boolean; message?: string } {
  const boards = getSupportedBoards(model, portCapacity, installedOptics);
  if (boards.length === 0) {
    return { valid: false, message: `No compatibility data found for model: ${model}` };
  }

  const cleanBoard = board.split(' (Slot')[0];
  const targetBoard = boards.find(b => b.board === cleanBoard);
  if (!targetBoard) {
    return { valid: false, message: `Board/Module "${cleanBoard}" is not recognized for model ${model}.` };
  }
  
  if (!targetBoard.supportedOptics.includes(optic)) {
    return { 
      valid: false, 
      message: `Optic "${optic}" is NOT supported on ${board}.\nSupported optics: ${targetBoard.supportedOptics.join(', ')}` 
    };
  }
  
  return { valid: true };
}
