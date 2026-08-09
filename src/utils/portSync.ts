/**
 * Re-derives which physical ports each edge occupies.
 *
 * Follows the same discipline as `syncOpticsOnTapConnection` in the BOM
 * generator: a pure function over (nodes, edges) that recomputes a physical
 * fact from the graph on every mutation, so port assignments can never drift
 * out of step with the topology. User-pinned assignments are carried through
 * untouched; everything else is reallocated deterministically.
 */
import type { Edge } from '@xyflow/react';
import type { ChassisPort, CustomNode, HardwareNodeData, PortLink } from '../store/types';
import {
  allocatePorts,
  getChassisPorts,
  getOpticCage,
  getPortOpticMap,
  getRequiredPortCount,
  getTapPortIds,
  isTapNode,
} from './ports';
import { isBreakoutPanelModel } from './hardwareUtils';

/** A node only has allocatable catalogue ports if it's a non-TAP chassis. */
function chassisPortsFor(node: CustomNode | undefined, cache: Map<string, ChassisPort[]>): ChassisPort[] {
  if (!node || node.type !== 'hardwareNode') return [];
  const cached = cache.get(node.id);
  if (cached) return cached;
  const ports = getChassisPorts(String(node.data?.model || ''), node.data as HardwareNodeData);
  cache.set(node.id, ports);
  return ports;
}

/**
 * The cage a link into this node should land on. Driven by the optic the peer
 * TAP is using where there is one, so a 10G tapped link takes an SFP cage and a
 * 100G one takes a QSFP cage rather than whatever happens to be free first.
 */
function preferredCage(peer: CustomNode | undefined): ChassisPort['cage'] | undefined {
  if (!peer) return undefined;
  // A breakout panel's MPO side always takes a parallel optic, which is
  // always QSFP-family regardless of speed tier (40G/100G/400G) or MM/SM.
  if (peer.type === 'hardwareNode' && isBreakoutPanelModel(String(peer.data?.model || ''))) return 'QSFP';
  const data = peer.data as HardwareNodeData | undefined;
  const alloc = data?.tappedLinkAllocations?.[0];
  // The *tool*-side optic is the one that lands in the chassis cage, so it wins
  // over the network side - matching how syncOpticsOnTapConnection picks. A
  // passive module TAP also records its network side as a descriptive label
  // ("Passive Optical Splitter (Multimode)") that carries no speed at all, and
  // reading that would wrongly place a 100G link into an SFP cage.
  const optic = alloc?.toolOptic || alloc?.optic || data?.tappedLinkOptic;
  if (!optic || String(optic).startsWith('Passive Optical Splitter')) return undefined;
  return getOpticCage(String(optic));
}

/**
 * Which cage family a breakout panel's own port should come from, based on
 * what's on the other end of the link: a real chassis needs the panel's MPO
 * side (one physical trunk per link), while a tool or TAP needs its LC side.
 */
function panelCagePreference(peer: CustomNode | undefined): ChassisPort['cage'] {
  const isRealChassis = peer?.type === 'hardwareNode' &&
    !isBreakoutPanelModel(String(peer.data?.model || '')) &&
    !isTapNode(peer);
  return isRealChassis ? 'MPO' : 'SFP';
}

function sameLinks(a: PortLink[] | undefined, b: PortLink[]): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every((link, i) =>
    link.sourcePortId === b[i].sourcePortId &&
    link.targetPortId === b[i].targetPortId &&
    link.opticSku === b[i].opticSku &&
    !!link.pinned === !!b[i].pinned,
  );
}

/**
 * Recompute `edge.data.portLinks` for every edge.
 *
 * Returns the *same array reference* when nothing changed, so callers can drop
 * it into the store without triggering a needless re-render - the same
 * no-op-stability contract used by the simulation slice's peak tracking.
 */
export function syncPortAssignments(nodes: CustomNode[], edges: Edge[]): Edge[] {
  const portCache = new Map<string, ChassisPort[]>();
  const opticCache = new Map<string, Map<string, string>>();

  const opticsFor = (node: CustomNode | undefined): Map<string, string> => {
    if (!node) return new Map();
    const cached = opticCache.get(node.id);
    if (cached) return cached;
    const map = getPortOpticMap(chassisPortsFor(node, portCache), (node.data as HardwareNodeData)?.optics);
    opticCache.set(node.id, map);
    return map;
  };

  // Ports pinned by the user are reserved up front across the whole graph, so a
  // later auto-allocation can never land on top of a deliberate choice.
  const occupiedByNode = new Map<string, Set<string>>();
  const occupiedFor = (nodeId: string): Set<string> => {
    let set = occupiedByNode.get(nodeId);
    if (!set) {
      set = new Set<string>();
      occupiedByNode.set(nodeId, set);
    }
    return set;
  };

  edges.forEach(edge => {
    ((edge.data?.portLinks as PortLink[]) || []).forEach(link => {
      if (!link.pinned) return;
      if (link.sourcePortId) occupiedFor(edge.source).add(link.sourcePortId);
      if (link.targetPortId) occupiedFor(edge.target).add(link.targetPortId);
    });
  });

  // A port the user has pinned an optic to (OpticsPanel's port picker) also
  // shouldn't be handed to some *other*, unrelated link's fresh allocation -
  // but this is deliberately kept separate from occupiedByNode above rather
  // than merged into it, because an edge whose own already-assigned port
  // happens to be that exact pinned port must still be free to keep it (see
  // the reuse pass below). Folding it into occupiedByNode would make a link
  // permanently unable to sit on the one port its own optic is pinned to.
  const opticPinnedByNode = new Map<string, Set<string>>();
  nodes.forEach(node => {
    if (node.type !== 'hardwareNode') return;
    const pins = new Set<string>();
    ((node.data as HardwareNodeData)?.optics || []).forEach(optic => {
      if (optic.pinnedPortId) pins.add(optic.pinnedPortId);
    });
    if (pins.size > 0) opticPinnedByNode.set(node.id, pins);
  });

  let changed = false;
  const nextEdges = edges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    const existing = (edge.data?.portLinks as PortLink[]) || [];

    // Only links terminating on a real chassis have ports to allocate; a
    // tool-to-tool or GigaSMART-node edge is purely logical.
    const sourcePorts = chassisPortsFor(sourceNode, portCache);
    const targetPorts = chassisPortsFor(targetNode, portCache);
    const sourceIsTap = isTapNode(sourceNode);
    const targetIsTap = isTapNode(targetNode);

    if (!sourcePorts.length && !targetPorts.length && !sourceIsTap && !targetIsTap) {
      if (existing.length > 0) {
        changed = true;
        return { ...edge, data: { ...edge.data, portLinks: [] } };
      }
      return edge;
    }

    const required = getRequiredPortCount(sourceNode, targetNode);
    const pinned = existing.filter(l => l.pinned).slice(0, required);
    const autoCount = Math.max(0, required - pinned.length);

    const sourceOccupied = occupiedFor(edge.source);
    const targetOccupied = occupiedFor(edge.target);

    // A TAP's own ends aren't catalogue ports - they're its link north/south
    // feeds, so they're named rather than allocated.
    const sourceTapIds = sourceIsTap && sourceNode ? getTapPortIds(sourceNode) : [];
    const targetTapIds = targetIsTap && targetNode ? getTapPortIds(targetNode) : [];

    const sourceIsPanel = sourceNode?.type === 'hardwareNode' && isBreakoutPanelModel(String(sourceNode.data?.model || ''));
    const targetIsPanel = targetNode?.type === 'hardwareNode' && isBreakoutPanelModel(String(targetNode.data?.model || ''));

    // Only an end that actually has ports is expected to yield one. A chassis
    // wired to a leaf tool legitimately has no port at the tool end, so an
    // empty id there is normal rather than an exhausted chassis.
    const sourceExpectsPort = sourcePorts.length > 0 || sourceIsTap;
    const targetExpectsPort = targetPorts.length > 0 || targetIsTap;

    const isValidId = (
      id: string,
      expectsPort: boolean,
      occupied: Set<string>,
      ports: ChassisPort[],
      isTap: boolean,
      tapIds: string[],
    ): boolean => {
      if (!expectsPort) return !id;
      if (!id || occupied.has(id)) return false;
      return isTap ? tapIds.includes(id) : ports.some(p => p.id === id);
    };

    // A previously auto-allocated (non-pinned) link keeps its own port as long
    // as that port is still valid and free, rather than being reallocated from
    // scratch every sync. Without this, an unrelated change elsewhere on the
    // chassis (e.g. pinning a new optic) could silently reshuffle where an
    // already-fitted link lands - stranding whatever optic the user had
    // carefully matched to its old port and leaving a *different* port
    // without one, moving the "missing transceiver" error around on every
    // save/reload instead of settling anywhere.
    const existingAuto = existing.filter(l => !l.pinned);
    const keptLinks: { sourcePortId: string; targetPortId: string }[] = [];
    for (const link of existingAuto) {
      if (keptLinks.length >= autoCount) break;
      const srcId = link.sourcePortId || '';
      const tgtId = link.targetPortId || '';
      if (
        !isValidId(srcId, sourceExpectsPort, sourceOccupied, sourcePorts, sourceIsTap, sourceTapIds) ||
        !isValidId(tgtId, targetExpectsPort, targetOccupied, targetPorts, targetIsTap, targetTapIds)
      ) {
        continue;
      }
      if (srcId) sourceOccupied.add(srcId);
      if (tgtId) targetOccupied.add(tgtId);
      keptLinks.push({ sourcePortId: srcId, targetPortId: tgtId });
    }

    const remaining = autoCount - keptLinks.length;
    const sourceFreshOccupied = new Set([...sourceOccupied, ...(opticPinnedByNode.get(edge.source) || [])]);
    const targetFreshOccupied = new Set([...targetOccupied, ...(opticPinnedByNode.get(edge.target) || [])]);

    const sourceAuto = sourceIsTap
      ? sourceTapIds.filter(id => !sourceFreshOccupied.has(id)).slice(0, remaining)
      : allocatePorts(sourcePorts, sourceFreshOccupied, remaining, sourceIsPanel ? panelCagePreference(targetNode) : preferredCage(targetNode)).map(p => p.id);
    const targetAuto = targetIsTap
      ? targetTapIds.filter(id => !targetFreshOccupied.has(id)).slice(0, remaining)
      : allocatePorts(targetPorts, targetFreshOccupied, remaining, targetIsPanel ? panelCagePreference(sourceNode) : preferredCage(sourceNode)).map(p => p.id);

    const sourceOptics = opticsFor(sourceNode);
    const targetOptics = opticsFor(targetNode);

    const freshLinks: { sourcePortId: string; targetPortId: string }[] = [];
    for (let i = 0; i < remaining; i++) {
      const sourcePortId = sourceAuto[i] || '';
      const targetPortId = targetAuto[i] || '';
      // Stop rather than emit half-links once a chassis has run out of cages;
      // the shortfall surfaces as a validation error instead.
      if ((sourceExpectsPort && !sourcePortId) || (targetExpectsPort && !targetPortId)) break;
      freshLinks.push({ sourcePortId, targetPortId });
      if (sourcePortId) sourceOccupied.add(sourcePortId);
      if (targetPortId) targetOccupied.add(targetPortId);
    }

    const autoLinks: PortLink[] = [...keptLinks, ...freshLinks].map(l => ({
      sourcePortId: l.sourcePortId,
      targetPortId: l.targetPortId,
      opticSku: targetOptics.get(l.targetPortId) || sourceOptics.get(l.sourcePortId),
    }));

    const nextLinks = [...pinned, ...autoLinks];
    if (sameLinks(existing, nextLinks)) return edge;
    changed = true;
    return { ...edge, data: { ...edge.data, portLinks: nextLinks } };
  });

  return changed ? nextEdges : edges;
}
