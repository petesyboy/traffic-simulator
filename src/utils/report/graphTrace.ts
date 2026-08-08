/**
 * graphTrace.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Static edge-graph tracing for the PDF report — "what feeds this node" and
 * "what does this node ultimately reach" — computed directly from `nodes`/
 * `edges`, not the live simulation run.
 *
 * No shared trace utility existed anywhere in the codebase before this: the
 * BFS in simulation.ts is inlined and coupled to live stream processing, and
 * GigaSmartNode.tsx/graphUtils.ts/bomGenerator.ts/configValidator.ts each
 * hand-roll their own one-off upstream/downstream walk. This is a single,
 * pure, reusable pair instead of a sixth inline copy.
 */
import type { Edge } from '@xyflow/react';
import type { CustomNode, HardwareNodeData } from '../../store/types';
import { NODE_TYPES } from '../../constants/nodeTypes';
import { isAutoTrayModel } from '../trayModels';

/**
 * True for a node that counts as a traffic *origin* for the report's "Traffic
 * originates from" tracing — a logical `inputNode`, or a TAP modelled as its
 * own physical `hardwareNode` wired to a chassis (see describeTapLink.ts for
 * the full writeup of this two-shapes-of-TAP gotcha). Without the second
 * branch, `traceToTerminalInputs` walks straight past a hardware-modelled TAP
 * looking for further upstream nodes, finds none, and silently drops that
 * whole branch — so a report with both a SPAN input and a TAP-as-hardware
 * input would claim all traffic "originates from" the SPAN alone.
 */
const isTerminalInputNode = (node: CustomNode): boolean => {
  if (node.type === NODE_TYPES.INPUT) return true;
  if (node.type === NODE_TYPES.HARDWARE) {
    const model = String((node.data as HardwareNodeData).model || '').toUpperCase();
    return model.includes('TAP') && !isAutoTrayModel(model);
  }
  return false;
};

/** Direct (one-hop) source nodes feeding into `nodeId`. */
export function getUpstreamNodes(nodeId: string, nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  const sourceIds = new Set(edges.filter((e) => e.target === nodeId).map((e) => e.source));
  return nodes.filter((n) => sourceIds.has(n.id));
}

/** Direct (one-hop) target nodes that `nodeId` feeds. */
export function getDownstreamNodes(nodeId: string, nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  const targetIds = new Set(edges.filter((e) => e.source === nodeId).map((e) => e.target));
  return nodes.filter((n) => targetIds.has(n.id));
}

const traceToTerminal = (
  nodeId: string,
  nodes: CustomNode[],
  edges: Edge[],
  direction: 'up' | 'down',
  isTerminal: (node: CustomNode) => boolean,
): CustomNode[] => {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>([nodeId]);
  const queue: string[] = [nodeId];
  const terminals = new Map<string, CustomNode>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const neighbourIds =
      direction === 'up'
        ? edges.filter((e) => e.target === currentId).map((e) => e.source)
        : edges.filter((e) => e.source === currentId).map((e) => e.target);

    for (const neighbourId of neighbourIds) {
      if (visited.has(neighbourId)) continue;
      visited.add(neighbourId);
      const neighbour = nodeById.get(neighbourId);
      if (!neighbour) continue;
      if (isTerminal(neighbour)) {
        terminals.set(neighbour.id, neighbour);
      } else {
        queue.push(neighbourId);
      }
    }
  }

  return Array.from(terminals.values());
};

/** BFS backward from `nodeId` to every reachable traffic origin (logical `inputNode` or a TAP modelled as a `hardwareNode`), deduped. */
export function traceToTerminalInputs(nodeId: string, nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  return traceToTerminal(nodeId, nodes, edges, 'up', isTerminalInputNode);
}

/** BFS forward from `nodeId` to every reachable `toolNode` (deduped). */
export function traceToTerminalOutputs(nodeId: string, nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  return traceToTerminal(nodeId, nodes, edges, 'down', (node) => node.type === NODE_TYPES.TOOL);
}
