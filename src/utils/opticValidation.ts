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
export function getSupportedBoards(model: string, portCapacity?: string): OpticSupport[] {
  const keys = Object.keys(opticRules);
  // An exact match must win outright before falling back to prefix matching below -
  // otherwise a longer key that happens to start with this model's name (e.g. the
  // "GigaVUE-HC1-Plus" rules block starting with "GigaVUE-HC1") would shadow the
  // model's own exact rules block once sorted longest-first, silently handing a base
  const exactMatch = keys.find(k => k === model);
  const cleanModel = model.toLowerCase().trim();
  const strippedModel = cleanModel.replace(/^gigavue[- ]/i, '');
  const normalizedMatch = exactMatch ?? keys.find(k => {
    const kLower = k.toLowerCase();
    const kStripped = kLower.replace(/^gigavue[- ]/i, '');
    return kLower === cleanModel || kStripped === strippedModel || kLower === strippedModel || kStripped === cleanModel;
  });
  const match = normalizedMatch ?? [...keys]
    .sort((a, b) => b.length - a.length)
    .find(k => k.startsWith(model + ' ') || model.startsWith(k.split(' ')[0]));
  if (!match) return [];
  
  const rules = opticRules[match];
  if (!rules) return [];

  const isTA400No400G = model.includes('TA400') && portCapacity === '100G';

  return Object.keys(rules).map(board => {
    let supportedOptics = rules[board].filter(opt => opt !== 'Cable');

    // If TA400 has no 400G ports enabled, it cannot accept 400G optics
    if (isTA400No400G) {
      supportedOptics = supportedOptics.filter(opt => !opt.includes('400G'));
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
): { valid: boolean; message?: string } {
  const boards = getSupportedBoards(model, portCapacity);
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
