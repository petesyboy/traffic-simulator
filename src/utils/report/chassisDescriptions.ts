/**
 * chassisDescriptions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Datasheet-style "what does this appliance actually do" text for TA/HC
 * chassis, for the PDF report's Hardware section. Matched by substring on the
 * `model` field using the same ordering convention as physicalItems.ts (check
 * the more specific model strings — HCT, HC1-Plus, TA200E, TA400E — before
 * their shorter substrings so e.g. "HC1-Plus" doesn't fall through to "HC1").
 */

const CHASSIS_PURPOSE_DESCRIPTIONS: { match: (model: string) => boolean; text: string }[] = [
  {
    match: (m) => m.includes('TA25'),
    text: 'GigaVUE-TA25E: a 1RU, high-density 25GbE traffic aggregation node (with 100GbE uplinks) that consolidates TAP and SPAN feeds from the access layer and forwards them, via flow mapping, to tools or to a GigaSMART-capable node for further processing — a cost-effective aggregation point at the network edge with no onboard GigaSMART processing of its own.',
  },
  {
    match: (m) => m.includes('TA400'),
    text: 'GigaVUE-TA400(E): a high-density 1RU traffic aggregation node with 400GbE-capable ports, built for next-generation data-centre and service-provider backbones where large volumes of traffic need aggregating and forwarding at the highest available line rates.',
  },
  {
    match: (m) => m.includes('TA200'),
    text: 'GigaVUE-TA200(E): a high-density 2RU traffic aggregation node offering dense 40/100GbE port counts, used to aggregate large volumes of core or data-centre traffic and forward it, via flow mapping, to tools or a GigaSMART-capable node for further processing.',
  },
  {
    match: (m) => m.includes('HCT'),
    text: 'GigaVUE-HCT: a compact, top-of-rack Visibility Fabric node combining port aggregation and onboard GigaSMART processing in a 1RU form factor, purpose-built for space-constrained top-of-rack or edge deployments that still need intelligent traffic optimisation, not just aggregation.',
  },
  {
    match: (m) => m.includes('HC1-PLUS') || m.includes('HC1P'),
    text: 'GigaVUE-HC1-Plus: a higher-capacity evolution of the HC1, combining port aggregation with onboard GigaSMART processing (deduplication, slicing, masking, SSL decryption, application metadata, etc.) in a compact 1RU footprint, offering greater port density and throughput for growing edge, branch, or mid-size deployments.',
  },
  {
    match: (m) => m.includes('HC1'),
    text: 'GigaVUE-HC1: a compact 1RU Visibility Fabric node combining port aggregation with onboard GigaSMART processing (deduplication, slicing, masking, SSL decryption, application metadata, etc.), suited to branch, edge, or smaller data-centre deployments that need intelligent traffic optimisation rather than just raw aggregation.',
  },
  {
    match: (m) => m.includes('HC3'),
    text: 'GigaVUE-HC3: a high-density, modular 3RU Visibility Fabric node combining port aggregation with onboard GigaSMART processing (deduplication, slicing, masking, SSL decryption, application metadata, etc.) across multiple line cards, built for large enterprise or data-centre deployments that need both scale and intelligent traffic optimisation.',
  },
];

/** Undefined for anything not a recognised TA/HC chassis (custom hardware, tap trays, tap units). */
export function describeChassisPurpose(model: string | undefined): string | undefined {
  if (!model) return undefined;
  const normalized = model.toUpperCase();
  return CHASSIS_PURPOSE_DESCRIPTIONS.find((entry) => entry.match(normalized))?.text;
}

/**
 * True for a recognised TA/HC-family Visibility Fabric node (not a tap tray,
 * tap unit, GigaSMART Appliance, or other custom hardware). Every such node
 * runs its own onboard flow map — that's the mechanism by which a physical
 * appliance gets traffic from ingress ports to tools/GigaSMART — even when
 * the user hasn't dragged out a separate Traffic Map canvas node for it, so
 * this is used to count each chassis as a map in its own right.
 */
export function isTaHcChassis(model: string | undefined): boolean {
  return describeChassisPurpose(model) !== undefined;
}
