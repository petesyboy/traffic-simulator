/**
 * autoLayout.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * "Tidy Layout" - unlike Snap All to Grid (which just rounds each node's
 * *existing* position to the nearest grid point independently), this
 * re-arranges the whole topology into clean left-to-right columns by pipeline
 * stage (rank = longest path from a source node), so every TAP/TA/HC etc. at
 * the same stage lines up on both axes and edges read as a tidy left-to-right
 * flow instead of whatever tangle manual dragging produced.
 *
 * A small custom layered (Sugiyama-style) layout rather than a dependency
 * like dagre/elkjs - this app already ships as a single ~5.7MB HTML file, and
 * the graphs here are small (tens of nodes) with no need for general-purpose
 * layout features those libraries offer.
 */
import type { Edge } from '@xyflow/react';
import type { CustomNode } from '../store/types';

const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 80;
const COLUMN_GAP = 90;
const ROW_GAP = 40;
const LEFT_MARGIN = 60;
const TOP_MARGIN = 80;
const ORDERING_PASSES = 4;

interface NodeSize {
  width: number;
  height: number;
}

function nodeSize(node: CustomNode): NodeSize {
  const width = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
  const height = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;
  return { width, height };
}

/** A child (grouped) node is laid out as part of its parent, not independently. */
function layoutId(id: string, parentOf: Map<string, string>): string {
  return parentOf.get(id) ?? id;
}

function buildAdjacency(
  layoutIds: string[],
  edges: Edge[],
  parentOf: Map<string, string>,
): { succ: Map<string, string[]>; pred: Map<string, string[]> } {
  const succ = new Map<string, string[]>();
  const pred = new Map<string, string[]>();
  const idSet = new Set(layoutIds);
  layoutIds.forEach((id) => {
    succ.set(id, []);
    pred.set(id, []);
  });

  const seen = new Set<string>();
  edges.forEach((edge) => {
    const from = layoutId(edge.source, parentOf);
    const to = layoutId(edge.target, parentOf);
    if (from === to || !idSet.has(from) || !idSet.has(to)) return;
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    succ.get(from)!.push(to);
    pred.get(to)!.push(from);
  });

  return { succ, pred };
}

/** Rank = 1 + longest predecessor chain, via DFS with a cycle guard (a back edge just contributes rank 0). */
function computeRanks(layoutIds: string[], pred: Map<string, string[]>): Map<string, number> {
  const rank = new Map<string, number>();
  const visiting = new Set<string>();

  function dfs(id: string): number {
    const cached = rank.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let r = 0;
    for (const p of pred.get(id) || []) {
      r = Math.max(r, dfs(p) + 1);
    }
    visiting.delete(id);
    rank.set(id, r);
    return r;
  }

  layoutIds.forEach(dfs);
  return rank;
}

/** Barycenter-heuristic pass to reduce edge crossings, alternating forward/backward a few times. */
function orderColumns(columns: string[][], succ: Map<string, string[]>, pred: Map<string, string[]>): string[][] {
  const orderIndex = new Map<string, number>();
  columns.forEach((col) => col.forEach((id, i) => orderIndex.set(id, i)));

  for (let pass = 0; pass < ORDERING_PASSES; pass++) {
    const forward = pass % 2 === 0;
    const neighborsOf = forward ? pred : succ;
    const rankSequence = forward ? columns.map((_, i) => i) : columns.map((_, i) => i).reverse();

    for (const r of rankSequence) {
      const col = columns[r];
      if (col.length <= 1) continue;
      const scored = col.map((id) => {
        const neighbors = (neighborsOf.get(id) || []).filter((n) => orderIndex.has(n));
        const avg = neighbors.length
          ? neighbors.reduce((sum, n) => sum + orderIndex.get(n)!, 0) / neighbors.length
          : orderIndex.get(id)!;
        return { id, avg };
      });
      scored.sort((a, b) => a.avg - b.avg);
      columns[r] = scored.map((s) => s.id);
      columns[r].forEach((id, i) => orderIndex.set(id, i));
    }
  }

  return columns;
}

function assignPositions(columns: string[][], sizeOf: Map<string, NodeSize>): Map<string, { x: number; y: number }> {
  const colWidths = columns.map((col) => Math.max(DEFAULT_NODE_WIDTH, ...col.map((id) => sizeOf.get(id)!.width)));
  const colX: number[] = [];
  let x = LEFT_MARGIN;
  columns.forEach((_col, i) => {
    colX[i] = x;
    x += colWidths[i] + COLUMN_GAP;
  });

  const colTotalHeight = columns.map(
    (col) => col.reduce((sum, id) => sum + sizeOf.get(id)!.height, 0) + Math.max(0, col.length - 1) * ROW_GAP,
  );
  const maxTotalHeight = Math.max(0, ...colTotalHeight);

  const positions = new Map<string, { x: number; y: number }>();
  columns.forEach((col, i) => {
    let y = TOP_MARGIN + (maxTotalHeight - colTotalHeight[i]) / 2;
    col.forEach((id) => {
      positions.set(id, { x: colX[i], y });
      y += sizeOf.get(id)!.height + ROW_GAP;
    });
  });

  return positions;
}

/**
 * Re-arranges top-level nodes (anything without a `parentId`, i.e. not
 * nested inside a group) into tidy left-to-right columns by pipeline stage.
 * Grouped child nodes are left untouched - their position is relative to
 * their parent, which moves with the rest of its column as a single unit.
 */
export function computeTidyLayout(nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  const topLevelNodes = nodes.filter((n) => !n.parentId);
  if (topLevelNodes.length === 0) return nodes;

  const parentOf = new Map<string, string>();
  nodes.forEach((n) => {
    if (n.parentId) parentOf.set(n.id, n.parentId);
  });

  const layoutIds = topLevelNodes.map((n) => n.id);
  const sizeOf = new Map<string, NodeSize>(topLevelNodes.map((n) => [n.id, nodeSize(n)]));

  const { succ, pred } = buildAdjacency(layoutIds, edges, parentOf);
  const rank = computeRanks(layoutIds, pred);

  const maxRank = Math.max(0, ...Array.from(rank.values()));
  const columns: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  // Stable initial order within each column follows current vertical position,
  // so a "tidy up" reads as a gentle cleanup of the existing arrangement
  // rather than a random reshuffle.
  const byCurrentY = [...topLevelNodes].sort((a, b) => a.position.y - b.position.y);
  byCurrentY.forEach((n) => columns[rank.get(n.id)!].push(n.id));

  orderColumns(columns, succ, pred);
  const positions = assignPositions(columns, sizeOf);

  return nodes.map((n) => {
    const pos = positions.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}

/**
 * Automatically adjusts the vertical spacing of nodes in columns so that
 * description boxes rendered below nodes in Export Diagram Mode never overlap
 * or obscure nodes below them.
 */
export function autoSpaceNodesForExport(nodes: CustomNode[]): CustomNode[] {
  const topLevelNodes = nodes.filter((n) => !n.parentId);
  if (topLevelNodes.length <= 1) return nodes;

  // Measure or estimate height for each node with export description box
  function getNodeHeight(n: CustomNode): number {
    const domEl =
      typeof document !== 'undefined'
        ? (document.querySelector(`[data-id="${n.id}"]`) as HTMLElement)
        : null;
    if (domEl && domEl.offsetHeight > 50) {
      return domEl.offsetHeight;
    }
    const model = String(n.data?.model || '').toUpperCase();
    const isChassis = (model.includes('HC') || model.includes('TA')) && !model.includes('TAP');
    const isTap = model.includes('TAP');
    if (isChassis) return 290;
    if (isTap) return 140;
    if (n.type === 'toolNode') return 160;
    return n.measured?.height || 150;
  }

  // Cluster nodes into columns based on X position (within 110px tolerance)
  const columns: CustomNode[][] = [];
  const sortedByX = [...topLevelNodes].sort((a, b) => a.position.x - b.position.x);

  sortedByX.forEach((node) => {
    let placed = false;
    for (const col of columns) {
      const avgX = col.reduce((sum, n) => sum + n.position.x, 0) / col.length;
      if (Math.abs(node.position.x - avgX) < 110) {
        col.push(node);
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([node]);
    }
  });

  const newPositions = new Map<string, { x: number; y: number }>();
  const VERTICAL_GAP = 30;

  columns.forEach((col) => {
    // Sort vertically by current Y position
    col.sort((a, b) => a.position.y - b.position.y);

    let currentY = col[0].position.y;
    col.forEach((node, idx) => {
      if (idx === 0) {
        newPositions.set(node.id, { x: node.position.x, y: node.position.y });
        currentY = node.position.y + getNodeHeight(node) + VERTICAL_GAP;
      } else {
        const targetY = Math.max(node.position.y, currentY);
        newPositions.set(node.id, { x: node.position.x, y: targetY });
        currentY = targetY + getNodeHeight(node) + VERTICAL_GAP;
      }
    });
  });

  return nodes.map((n) => {
    const pos = newPositions.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}

