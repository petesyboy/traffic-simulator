/**
 * flowDirection.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared vocabulary for which way a node's pipeline reads on canvas. A node
 * with no direction set reads left-to-right, the classic ingress-on-the-left
 * arrangement; 'rtl' mirrors it for sites laid out to the right of a hub.
 */

export type FlowDirection = 'ltr' | 'rtl' | 'auto';

export const FLOW_DIRECTION_OPTIONS: Array<{ value: FlowDirection; label: string; title: string }> = [
  { value: 'ltr', label: '→ LTR', title: 'Ingest on the left, egress on the right (the classic pipeline direction)' },
  { value: 'rtl', label: '← RTL', title: 'Ingest on the right, egress on the left - for sites mirrored to the right of a transport hub' },
  { value: 'auto', label: 'Auto', title: 'Let the layout engine choose, and follow it on every re-tidy' },
];

/**
 * The direction a set of nodes shares, or null when they disagree.
 *
 * An unlocked node reports 'auto' rather than the direction it happens to be
 * drawn in, so a node the layout engine mirrored still groups with the other
 * nodes it is free to move.
 */
export function sharedFlowDirection(nodes: Array<{ data?: Record<string, unknown> }>): FlowDirection | null {
  if (nodes.length === 0) return null;
  const directions = new Set(
    nodes.map((n) => (n.data?.flowDirectionLocked ? ((n.data?.flowDirection as FlowDirection) || 'ltr') : 'auto')),
  );
  return directions.size === 1 ? ([...directions][0] as FlowDirection) : null;
}
