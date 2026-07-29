/**
 * gsaOptics.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Real Gigamon transceiver part numbers for the GigaSMART Appliance (GSA)'s
 * two physical port banks, shared between the config panel (picker options)
 * and the on-canvas/export-mode summary (so both agree on what a "valid"
 * optic looks like for this appliance).
 */

// 2x 400GbE QSFP-DD data ports. Native speed is 400G on TA400/TA400E; the 100G
// QSFP28 options cover attaching to a smaller chassis (HC1P/HC3/TA25(E)/TA200(E)),
// which runs the same cage at 100G. Pulled from opticRules.json's GigaVUE-TA400
// port list.
export const GSA_DATA_PORT_OPTICS = [
  'QDD-503 (400G QSFP-DD LR4)',
  'QDD-511 (400G QSFP-DD DR4)',
  'QDD-512 (400G QSFP-DD DR4+)',
  'QDD-514 (400G QSFP-DD FR4)',
  'Q28-502T (100G QSFP28 SR4)',
  'Q28-503T (100G QSFP28 LR4)',
  'Q28-504T (100G QSFP28 ER4-lite)',
  'Q28-511T (100G QSFP28 DR1)',
  'Q28-513 (100G QSFP28 CWDM4)',
  'Q28-514 (100G QSFP28 FR1)',
];

// 4x 10/25GbE SFP28 metadata/NetFlow export bank (per the GigaSMART Appliance
// Guide) — informational only, this bank isn't individually modelled in the BOM yet.
export const GSA_METADATA_PORT_OPTICS = [
  'SFP-552 (25G SFP28 SR)',
  'SFP-552T (25G SFP28 SR)',
  'SFP-553T (25G SFP28 LR)',
  'SFP-531T (10G SFP+ Copper)',
  'SFP-532T (10G SFP+ SR)',
  'SFP-533T (10G SFP+ LR)',
  'SFP-534T (10G SFP+ ER)',
];

export const GSA_DEFAULT_DATA_PORT_OPTIC = GSA_DATA_PORT_OPTICS[0];

// The GSA is a Gigamon appliance, so "Customer Supplied Optic" (the default every
// other packet tool gets) never applies to it. Anything other than one of its own
// real part numbers is treated as unset/stale and corrected to the default above.
export function isValidGsaDataPortOptic(value: string | undefined): boolean {
  return !!value && GSA_DATA_PORT_OPTICS.includes(value);
}
