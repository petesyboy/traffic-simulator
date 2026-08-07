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
import type { CustomNode } from '../../store/types';
import { NODE_TYPES } from '../../constants/nodeTypes';

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
  terminalType: string,
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
      if (neighbour.type === terminalType) {
        terminals.set(neighbour.id, neighbour);
      } else {
        queue.push(neighbourId);
      }
    }
  }

  return Array.from(terminals.values());
};

/** BFS backward from `nodeId` to every reachable `inputNode` (deduped). */
export function traceToTerminalInputs(nodeId: string, nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  return traceToTerminal(nodeId, nodes, edges, 'up', NODE_TYPES.INPUT);
}

/** BFS forward from `nodeId` to every reachable `toolNode` (deduped). */
export function traceToTerminalOutputs(nodeId: string, nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  return traceToTerminal(nodeId, nodes, edges, 'down', NODE_TYPES.TOOL);
}
