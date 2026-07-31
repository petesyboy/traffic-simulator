/**
 * Which Gigamon transceiver a passive TAP's monitor output may be terminated
 * into on a TA/HC chassis.
 *
 * A passive optical TAP has no transceiver of its own - it's a fused splitter -
 * so the only optic quoted is the one in the chassis cage receiving the monitor
 * output. Which optics are valid there depends on the TAP's fibre type and
 * connector, not just on the link speed:
 *
 *  - TAP-M251T is a 50/50 **multimode** LC tap (830-940nm OM5), so it takes
 *    LC multimode SX/SR at 1/10/25G and LC multimode **SWDM4** at 40/100G.
 *  - TAP-M253T is a 50/50 **singlemode** LC tap (1270-1550nm), so multimode
 *    SX/SR are excluded entirely.
 *  - MPO-connector optics (QSF-506, Q28-506, and the SR4/PSM4 family) are not
 *    direct LC terminations and are excluded from both.
 *  - The QSB-* BiDi optics are Rx-only multimode parts for BiDi taps such as
 *    TAP-M506T. They use LC connectors but suit neither a normal M251T nor a
 *    singlemode M253T.
 *
 * Cabling rule (documentation, not modelled): connect only the Rx side of each
 * chassis optic to the monitor output and leave Tx disconnected. Each
 * full-duplex tapped link yields two monitor outputs, hence two optics per link.
 */

export type TapOpticSpeed = '1G' | '10G' | '25G' | '40G' | '100G' | '400G';
export type TapOpticCage = 'SFP' | 'QSFP';

export interface TapOpticSpec {
  /** Real Gigamon SKU, stored directly as the allocation's optic value. */
  sku: string;
  speed: TapOpticSpeed;
  /** Optical standard, e.g. 'SR', 'SWDM4', 'LR4'. */
  standard: string;
  cage: TapOpticCage;
  /** TAA-compliant 'T' variant. Preferred for new orders where a pair exists. */
  taa: boolean;
  reach: string;
}

const spec = (
  sku: string, speed: TapOpticSpeed, standard: string, cage: TapOpticCage, reach: string,
): TapOpticSpec => ({ sku, speed, standard, cage, taa: /T(-\d+P)?$/.test(sku), reach });

/** TAP-M251T family: 50/50 multimode LC, 1/10/25/40/100G. */
const MULTIMODE_LC_OPTICS: TapOpticSpec[] = [
  spec('SFP-502', '1G', 'SX', 'SFP', '200-550m'),
  spec('SFP-502T', '1G', 'SX', 'SFP', '200-550m'),
  spec('SFP-532', '10G', 'SR', 'SFP', '300m'),
  spec('SFP-532T', '10G', 'SR', 'SFP', '300m'),
  spec('SFP-532-20P', '10G', 'SR', 'SFP', '300m (20-pack)'),
  spec('SFP-532T-20P', '10G', 'SR', 'SFP', '300m (20-pack)'),
  spec('SFP-552', '25G', 'SR', 'SFP', '100m'),
  spec('SFP-552T', '25G', 'SR', 'SFP', '100m'),
  // 40G/100G multimode termination is SWDM4 over LC - not SR4, which is MPO.
  spec('QSF-508', '40G', 'SWDM4', 'QSFP', '240-440m'),
  spec('Q28-508', '100G', 'SWDM4', 'QSFP', '75-150m'),
];

/**
 * TAP-M253T family: 50/50 singlemode LC, 1/10/25/40/100/400G.
 * SFP-553 and QSF-503 are deliberately absent - both were superseded by their
 * TAA variants in current product data.
 */
const SINGLEMODE_LC_OPTICS: TapOpticSpec[] = [
  spec('SFP-503', '1G', 'LX', 'SFP', '10km'),
  spec('SFP-503T', '1G', 'LX', 'SFP', '10km'),
  spec('SFP-533', '10G', 'LR', 'SFP', '10km'),
  spec('SFP-533T', '10G', 'LR', 'SFP', '10km'),
  spec('SFP-533-20P', '10G', 'LR', 'SFP', '10km (20-pack)'),
  spec('SFP-533T-20P', '10G', 'LR', 'SFP', '10km (20-pack)'),
  spec('SFP-534', '10G', 'ER', 'SFP', '40km'),
  spec('SFP-534T', '10G', 'ER', 'SFP', '40km'),
  spec('SFP-553T', '25G', 'LR', 'SFP', '10km'),
  spec('QSF-503T', '40G', 'LR4', 'QSFP', '10km'),
  spec('QSF-503T-5P', '40G', 'LR4', 'QSFP', '10km (5-pack)'),
  spec('QSF-504', '40G', 'ER4', 'QSFP', '40km'),
  spec('Q28-503', '100G', 'LR4', 'QSFP', '10km'),
  spec('Q28-503T', '100G', 'LR4', 'QSFP', '10km'),
  spec('Q28-504', '100G', 'ER4-Lite', 'QSFP', 'up to 25km'),
  spec('Q28-504T', '100G', 'ER4-Lite', 'QSFP', 'up to 25km'),
  spec('Q28-511T', '100G', 'DR1', 'QSFP', '500m'),
  spec('Q28-513', '100G', 'CWDM4', 'QSFP', '2km'),
  spec('Q28-514', '100G', 'FR1', 'QSFP', '2km'),
];

/**
 * TAP-M451T/M471T: multimode MPO-12 taps, OM5, 40/100/400G SR4.
 *
 * The spec sheet lists 400G SR4, but no 400G multimode SR4 transceiver exists
 * in Gigamon's current transceiver list - so 400G is deliberately absent here
 * rather than offered with no real SKU behind it. In particular QDD-511/
 * QDD-512 (400G singlemode DR4/DR4+) must NOT be offered against these taps.
 */
const MULTIMODE_MPO_OPTICS: TapOpticSpec[] = [
  spec('QSF-502', '40G', 'SR4', 'QSFP', '100m'),
  spec('QSF-502T', '40G', 'SR4', 'QSFP', '100m'),
  spec('QSF-507', '40G', 'SR4-ER', 'QSFP', 'extended reach'),
  spec('QSF-507T', '40G', 'SR4-ER', 'QSFP', 'extended reach'),
  // Q28-502 (non-TAA) is not a catalogued SKU - only the TAA variant exists.
  spec('Q28-502T', '100G', 'SR4', 'QSFP', '100m'),
];

/**
 * TAP-M453T/M473T: singlemode MPO-12 taps, 40/100/400G PSM4/PLR4/DR4(+).
 * 400G is only reachable on a TA400/TA400E (no QSFP-DD cages elsewhere) -
 * chassis narrowing already enforces that.
 */
const SINGLEMODE_MPO_OPTICS: TapOpticSpec[] = [
  spec('QSF-506', '40G', 'PSM4', 'QSFP', '4x10G breakout, 1310nm'),
  spec('QSF-506T', '40G', 'PSM4', 'QSFP', '4x10G breakout, 1310nm'),
  // Q28-506T is not a catalogued SKU - only the non-TAA variant exists.
  spec('Q28-506', '100G', 'PLR4', 'QSFP', '2km'),
  spec('QDD-511', '400G', 'DR4', 'QSFP', 'singlemode'),
  spec('QDD-512', '400G', 'DR4+', 'QSFP', 'singlemode'),
];

/** 
 * TAP-M506T: 40/100G multimode BiDi tap (LC connectors, 840-910nm OM5).
 * Connects to Rx-only LC BiDi optics on the monitor side (two optics per full-duplex tapped link).
 * 
 * - 40G BiDi: QSB-501 (Rx-only, legacy)
 * - 40/100G proprietary BiDi: QSB-521 (Rx-only, legacy)
 * - 40/100G dual-rate BiDi: QSB-523T (Rx-only, TAA-compliant, current recommendation)
 * - 100G SR1.2/KP4 BiDi: QSB-531 (Rx-only, 100G only)
 * 
 * Standard QSF/Q28 SR4 MPO optics must NOT be used with TAP-M506T.
 */
const BIDI_OPTICS: TapOpticSpec[] = [
  spec('QSB-501', '40G', 'BiDi', 'QSFP', 'multimode'),
  spec('QSB-521', '100G', 'BiDi', 'QSFP', 'multimode'),
  spec('QSB-523T', '100G', 'BiDi', 'QSFP', 'multimode'),
  spec('QSB-531', '100G', 'BiDi', 'QSFP', 'multimode'),
];

/**
 * Full-duplex live-side optics corresponding to each Rx-only monitor optic:
 * - QSB-501 (40G Rx-only) <-> QSB-502 (40G Full Duplex)
 * - QSB-521 (Legacy 40/100G Rx-only) <-> QSB-522 (Legacy 40/100G Full Duplex)
 * - QSB-523T (Dual-rate 40/100G TAA Rx-only) <-> QSB-524T (Dual-rate 40/100G Full Duplex)
 * - QSB-531 (100G SR1.2 Rx-only) <-> QSB-532 (100G SR1.2 Full Duplex)
 */
export const BIDI_LIVE_SIDE_MAP: Record<string, string> = {
  'QSB-501': 'QSB-502',
  'QSB-521': 'QSB-522',
  'QSB-523T': 'QSB-524T',
  'QSB-531': 'QSB-532',
};

export type TapTerminationClass = 'multimode-lc' | 'singlemode-lc' | 'multimode-mpo' | 'singlemode-mpo' | 'bidi';

const OPTICS_BY_CLASS: Record<TapTerminationClass, TapOpticSpec[]> = {
  // TAP-M251ULT carries the same 1/10/25/40/100G range as the M251T, SWDM4
  // included. An older Hardware Guide table shows it as 1/10/25G only; the
  // current product description and newer training material supersede that.
  'multimode-lc': MULTIMODE_LC_OPTICS,
  // The singlemode ULT module takes the same LC range as the M253T; its 400G
  // capability is unreachable on any chassis without QSFP-DD cages anyway.
  'singlemode-lc': SINGLEMODE_LC_OPTICS,
  'multimode-mpo': MULTIMODE_MPO_OPTICS,
  'singlemode-mpo': SINGLEMODE_MPO_OPTICS,
  'bidi': BIDI_OPTICS,
};

/**
 * Optional LC breakout path for the MPO taps: a breakout panel sits in the
 * TAP tray alongside the module and fans its MPO output out to individual LC
 * connections, which then land on ordinary SFP/SFP28 chassis cages instead of
 * a QSFP MPO cage. This is a deployment choice, not a requirement, so it's
 * exposed separately rather than folded into the MPO optic list above.
 */
const MPO_BREAKOUT_PANEL: Record<'multimode-mpo' | 'singlemode-mpo', { sku: string; opticsWhenBrokenOut: string[] }> = {
  'multimode-mpo': { sku: 'PNL-M341T', opticsWhenBrokenOut: ['SFP-532', 'SFP-532T', 'SFP-552', 'SFP-552T'] },
  'singlemode-mpo': { sku: 'PNL-M343T', opticsWhenBrokenOut: ['SFP-533', 'SFP-533T', 'SFP-553T'] },
};

/** The breakout panel (and its resulting LC optics) available for an MPO TAP, if any. */
export function getMpoBreakoutOption(model: string, sku = ''): { sku: string; opticsWhenBrokenOut: string[] } | undefined {
  const cls = getTapTerminationClass(model, sku);
  return cls === 'multimode-mpo' || cls === 'singlemode-mpo' ? MPO_BREAKOUT_PANEL[cls] : undefined;
}

/**
 * Where the *monitored network link* is itself BiDi, a multimode LC tap is
 * terminated with the receive-only BiDi parts instead of SX/SR/SWDM4 — 40G
 * QSB-501, dual-rate 40/100G QSB-523T, or 100G QSB-531. That's a property of
 * the tapped link rather than of the TAP, which the topology model has no
 * concept of, so these are accepted if chosen but not offered by default.
 */
const BIDI_LINK_ALTERNATIVES = ['QSB-501', 'QSB-523T', 'QSB-531'];

/**
 * Classify a passive module TAP by how its monitor outputs terminate. Returns
 * undefined for TAPs this matrix doesn't govern (active SFP taps, copper taps),
 * which keep their existing optic handling.
 */
export function getTapTerminationClass(model: string, sku = ''): TapTerminationClass | undefined {
  const id = `${model} ${sku}`.toUpperCase();
  if (id.includes('M506')) return 'bidi';
  // The M251T/M253T catalogue entries carry no fiber_type field, so the model
  // number is the only signal - 253/273/453 are the singlemode families.
  // LC tap modules: M2x1 = multimode, M2x3 = singlemode; the 50/50 (M25x) and
  // 70/30 (M27x) splits share an optic range, as do ULT and non-ULT.
  if (/M2[57][13]/.test(id)) {
    return /M2[57]3/.test(id) ? 'singlemode-lc' : 'multimode-lc';
  }
  // MPO tap modules: M4x1 = multimode, M4x3 = singlemode; 50/50 (M45x) and
  // 70/30 (M47x) again share an optic range - connector and fibre type drive
  // the optic, not split ratio.
  if (/M4[57][13]/.test(id)) {
    return /M4[57]3/.test(id) ? 'singlemode-mpo' : 'multimode-mpo';
  }
  return undefined;
}

/** Speeds a chassis can physically terminate, by cage type. */
function chassisSupportsSpeed(chassisModel: string, s: TapOpticSpeed): boolean {
  // 400G needs QSFP-DD, which only the TA400 family provides.
  if (s === '400G') return chassisModel.includes('TA400');
  // TA200/TA400 are QSFP-only - no SFP cages for 1/10/25G.
  if ((s === '1G' || s === '10G' || s === '25G') && (chassisModel.includes('TA200') || chassisModel.includes('TA400'))) return false;
  return true;
}

/**
 * The optics a given TAP may be terminated into, optionally narrowed to what a
 * particular chassis can actually take.
 */
export function getCompatibleTapOptics(
  tapModel: string,
  tapSku = '',
  chassisModel?: string,
): TapOpticSpec[] {
  const cls = getTapTerminationClass(tapModel, tapSku);
  if (!cls) return [];
  const optics = OPTICS_BY_CLASS[cls];
  if (!chassisModel) return optics;
  return optics.filter(o => chassisSupportsSpeed(chassisModel, o.speed));
}

/**
 * True when `optic` is a legitimate termination for this TAP. Broader than
 * `getCompatibleTapOptics`, which is the "what to offer by default" list: a
 * multimode LC tap watching a BiDi network link is legitimately terminated with
 * a receive-only BiDi part, so those are accepted rather than flagged.
 */
export function isTapOpticCompatible(tapModel: string, tapSku: string, optic: string): boolean {
  const cls = getTapTerminationClass(tapModel, tapSku);
  if (!cls) return true; // not a TAP this matrix governs
  const firstWord = optic.split(' ')[0];
  if (OPTICS_BY_CLASS[cls].some(o => o.sku === firstWord)) return true;
  return cls === 'multimode-lc' && BIDI_LINK_ALTERNATIVES.includes(firstWord);
}

export function describeTapOptic(o: TapOpticSpec): string {
  return `${o.sku} — ${o.speed} ${o.standard} (${o.reach})${o.taa ? ' [TAA]' : ''}`;
}
