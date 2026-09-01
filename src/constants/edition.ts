/**
 * edition.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Compile-time application edition constants.
 *
 * Supported editions:
 *  - 'internal': Full Gigamon SE edition with commercial quotation engine,
 *    worldwide list pricing, discount schedule, and budgetary quote exports.
 *  - 'partner': Sanitised Salesperson / Partner demonstration edition with
 *    pure Bill of Materials (equipment manifest) and zero pricing or quotation logic.
 */

export type AppEdition = 'internal' | 'partner';

// Vite replaces `import.meta.env.VITE_APP_EDITION` at compile time
export const APP_EDITION: AppEdition =
  ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_EDITION) as AppEdition) || 'internal';

export const isInternalEdition = (): boolean => APP_EDITION === 'internal';
export const isPartnerEdition = (): boolean => APP_EDITION === 'partner';
