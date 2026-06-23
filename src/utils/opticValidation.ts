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
export function getSupportedBoards(model: string): OpticSupport[] {
  // Find a matching key in opticRules. Keys might have extra whitespace or GVOS versions appended.
  const match = Object.keys(opticRules).find(k => k.startsWith(model) || model.startsWith(k.split(' ')[0]));
  if (!match) return [];
  
  const rules = opticRules[match];
  if (!rules) return [];

  return Object.keys(rules).map(board => ({
    board,
    supportedOptics: rules[board].filter(opt => opt !== 'Cable')
  }));
}

/**
 * Validates if a chosen optic can be installed in a specific board on the given hardware model.
 */
export function validateOptic(model: string, board: string, optic: string): { valid: boolean; message?: string } {
  const boards = getSupportedBoards(model);
  if (boards.length === 0) {
    return { valid: false, message: `No compatibility data found for model: ${model}` };
  }

  const targetBoard = boards.find(b => b.board === board);
  if (!targetBoard) {
    return { valid: false, message: `Board/Module "${board}" is not recognized for model ${model}.` };
  }
  
  if (!targetBoard.supportedOptics.includes(optic)) {
    return { 
      valid: false, 
      message: `Optic "${optic}" is NOT supported on ${board}.\nSupported optics: ${targetBoard.supportedOptics.join(', ')}` 
    };
  }
  
  return { valid: true };
}
