/**
 * inputFeedOptics.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Resolves the chassis-side transceiver for a *non-TAP* ingress feed - a SPAN
 * session, ERSPAN tunnel, East/West source or VMware estate.
 *
 * A TAP expresses its own optics through `tappedLinkAllocations`, so every TAP
 * path (syncOpticsOnTapConnection, deriveChassisRequiredOptics, portSync) reads
 * them from there. The other input forms carry no optic field at all - only the
 * "Port Speed" and "Media / Fibre Type" the user picked on the input node - so
 * anything needing their chassis-side optic used to fall through to the TAP
 * default of SFP-532 (10G SFP+ SR). That fitted (or reported) a 10G SFP for a
 * 400G SPAN session, and on a TA200/TA400 - which have no SFP cages at all -
 * it resolved to nothing whatsoever.
 *
 * This module is the single home for that mapping: configured speed + media ->
 * the best optic the target chassis actually supports.
 */
import type { ChassisPort, CustomNode } from '../store/types';
import { NODE_TYPES } from '../constants/nodeTypes';
import { getOpticSpeed, getOpticFiberType } from './hardwareUtils';
import { getOpticCage, isTapNode } from './ports';
import { getSupportedBoards } from './opticValidation';

export type FeedSpeed = '1G' | '10G' | '25G' | '40G' | '100G' | '400G';
export type FeedMedia = 'MM' | 'SM' | 'Copper';

/** Standard port speeds, ascending, as the input node's dropdown offers them. */
const FEED_SPEEDS: FeedSpeed[] = ['1G', '10G', '25G', '40G', '100G', '400G'];

const SPEED_MBPS: Record<FeedSpeed, number> = {
  '1G': 1000,
  '10G': 10000,
  '25G': 25000,
  '40G': 40000,
  '100G': 100000,
  '400G': 400000,
};

/**
 * True for the input forms that land on a physical chassis port but carry no
 * optic of their own: SPAN, ERSPAN, East/West and VMware. The TAP form is
 * excluded - it resolves its optics from its tapped-link allocations instead.
 */
export function isPacketFeedInput(node: CustomNode | undefined): boolean {
  if (!node || node.type !== NODE_TYPES.INPUT) return false;
  return !isTapNode(node);
}

/** The port speed configured on an input node, falling back to its simulated link speed. */
export function getInputFeedSpeed(node: CustomNode | undefined): FeedSpeed {
  const raw = String(node?.data?.portSpeed || '').toUpperCase().trim();
  const match = raw.match(/^(\d+)\s*G/);
  if (match) {
    const asSpeed = `${match[1]}G` as FeedSpeed;
    if (FEED_SPEEDS.includes(asSpeed)) return asSpeed;
  }

  // Legacy/demo nodes predate the Port Speed dropdown and only carry linkSpeed
  // (Mbps). Round up to the nearest real port speed - a 15 Gbps feed still
  // needs a 25G port, not a 10G one.
  const linkSpeedMbps = Number(node?.data?.linkSpeed);
  if (Number.isFinite(linkSpeedMbps) && linkSpeedMbps > 0) {
    return FEED_SPEEDS.find(s => SPEED_MBPS[s] >= linkSpeedMbps) || '400G';
  }
  return '10G';
}

/** The media type configured on an input node ('Media / Fibre Type'). */
export function getInputFeedMedia(node: CustomNode | undefined): FeedMedia {
  const raw = String(node?.data?.spanFiberMode || node?.data?.fiberType || node?.data?.media || '');
  if (/copper|base-?t|dac|direct attach|twinax/i.test(raw)) return 'Copper';
  if (/single|\bsm\b|\blr\b|long/i.test(raw)) return 'SM';
  return 'MM';
}

/** The cage family an ingress feed of this speed lands in on the chassis. */
export function getInputFeedCage(node: CustomNode | undefined): ChassisPort['cage'] {
  const speed = getInputFeedSpeed(node);
  return speed === '40G' || speed === '100G' || speed === '400G' ? 'QSFP' : 'SFP';
}

/** Prefer the TAA ('T'-suffix) variant, matching the rule used across the optic pickers. */
function preferTaa(candidates: string[]): string {
  return candidates.find(opt => opt.split(' ')[0].trim().endsWith('T')) || candidates[0];
}

/**
 * Picks the transceiver a chassis needs to terminate this ingress feed.
 *
 * Matches the configured speed and media against the optics the chassis
 * actually supports (honouring `portCapacity`, so a TA400 licensed for 100G
 * only never resolves to a 400G part). Falls back to the nearest supported
 * speed - stepping up first, then down - rather than returning an optic that
 * cannot physically be fitted. Returns '' when the model has no optic rules.
 */
export function resolveInputFeedOptic(
  inputNode: CustomNode | undefined,
  chassisModel: string,
  portCapacity?: string,
): string {
  const boards = getSupportedBoards(chassisModel, portCapacity);
  if (!boards.length) return '';

  const supported = Array.from(new Set(boards.flatMap(b => b.supportedOptics)));
  if (!supported.length) return '';

  const speed = getInputFeedSpeed(inputNode);
  const media = getInputFeedMedia(inputNode);

  const atSpeed = (s: FeedSpeed) => supported.filter(opt => getOpticSpeed(opt) === s);

  // Nearest supported speed: the requested one, then upwards, then downwards.
  const requestedIdx = FEED_SPEEDS.indexOf(speed);
  const speedOrder: FeedSpeed[] = [
    speed,
    ...FEED_SPEEDS.slice(requestedIdx + 1),
    ...FEED_SPEEDS.slice(0, requestedIdx).reverse(),
  ];

  for (const candidateSpeed of speedOrder) {
    const candidates = atSpeed(candidateSpeed);
    if (!candidates.length) continue;
    const onMedia = candidates.filter(opt => getOpticFiberType(opt) === media);
    if (onMedia.length) return preferTaa(onMedia);
    // The chassis carries this speed but not in the requested media (e.g. a
    // DAC/copper SPAN into a TA400, which is optical-only) - take the speed
    // match, since the wrong reach is recoverable and the wrong speed isn't.
    return preferTaa(candidates);
  }

  return '';
}

/**
 * The ingress optics a chassis needs for the non-TAP input feeds wired to it.
 * One transceiver per feed link - a mirrored session is unidirectional, unlike
 * a tapped link's north/south pair.
 */
export function deriveInputFeedOptics(
  chassisNode: CustomNode,
  nodes: CustomNode[],
  edges: { source: string; target: string }[],
  chassisModel: string,
  portCapacity?: string,
): { optic: string; qty: number; cage: ChassisPort['cage']; peerNodeId: string }[] {
  const required: { optic: string; qty: number; cage: ChassisPort['cage']; peerNodeId: string }[] = [];

  edges.forEach(edge => {
    if (edge.source !== chassisNode.id && edge.target !== chassisNode.id) return;
    const peerId = edge.source === chassisNode.id ? edge.target : edge.source;
    const peer = nodes.find(n => n.id === peerId);
    if (!isPacketFeedInput(peer)) return;

    const optic = resolveInputFeedOptic(peer, chassisModel, portCapacity);
    if (!optic) return;
    required.push({ optic, qty: 1, cage: getOpticCage(optic), peerNodeId: peerId });
  });

  return required;
}
