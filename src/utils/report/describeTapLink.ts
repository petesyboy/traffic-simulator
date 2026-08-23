/**
 * describeTapLink.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Describes a TAP's physical link for the PDF report: the fibre type (MM/SM),
 * the SFP/optic it's terminated into, and what chassis it connects to.
 *
 * A TAP can be represented two ways in this app (see graphSlice.ts's connection
 * handler and bomGenerator.ts's BOM walk, which both branch on this):
 *  - A standalone `inputNode` (configType 'Network Tap') carrying its own
 *    `tapFiberMode`/`tappedLinkOptic`/`tappedLinksCount` directly — the common
 *    case, no hardware node involved at all (see InputNodePanel.tsx, the exact
 *    logic this mirrors).
 *  - A physical `hardwareNode` whose model contains "TAP", wired to a chassis.
 *    Its fibre mode isn't stored directly; it's inferred from its model/SKU
 *    (253/273/453 or "single-mode"/"sm" substrings) — the same convention
 *    bomGenerator.ts already uses for `isHardwareTap` nodes.
 *
 * Board-level detail only: this lists the connected chassis's installed optics
 * as a whole, not the exact port the tap lands on — reproducing the full
 * port-allocation engine (ports.ts) just for descriptive text isn't warranted.
 */
import type { Edge } from '@xyflow/react';
import type { CustomNode, InputNodeData, HardwareNodeData } from '../../store/types';
import { NODE_TYPES, SUPPORTED_TAP_OPTICS } from '../../constants/nodeTypes';
import { getUpstreamNodes, getDownstreamNodes } from './graphTrace';

export function describeTapPhysicalLink(node: CustomNode, nodes: CustomNode[], edges: Edge[]): string[] {
  const bullets: string[] = [];
  const isHardwareTap = node.type === NODE_TYPES.HARDWARE;
  const data = node.data as InputNodeData & HardwareNodeData;

  let fiberMode: string;
  if (isHardwareTap) {
    const sku = String(data.sku || '');
    const model = String(data.model || '');
    const isSM =
      sku.includes('253') ||
      sku.includes('273') ||
      sku.includes('453') ||
      model.toLowerCase().includes('single-mode') ||
      model.toLowerCase().includes('sm');
    fiberMode = isSM ? 'Singlemode' : 'Multimode';
  } else {
    fiberMode = data.tapFiberMode || 'Multimode';
  }

  const opticVal = data.tappedLinkOptic;
  if (opticVal) {
    const cleanSku = opticVal.split(' ')[0];
    const matched = SUPPORTED_TAP_OPTICS.find((o) => o.value === cleanSku);
    bullets.push(`Fibre: ${fiberMode}${matched ? ` — ${matched.label}` : ` (optic: ${opticVal})`}`);
  } else {
    bullets.push(`Fibre: ${fiberMode}`);
  }

  if (data.tappedLinksCount) bullets.push(`Tapped links: ${data.tappedLinksCount}`);

  const neighbours = [...getUpstreamNodes(node.id, nodes, edges), ...getDownstreamNodes(node.id, nodes, edges)];
  const chassis = neighbours.find(
    (n) =>
      n.type === NODE_TYPES.HARDWARE &&
      !String((n.data as HardwareNodeData).model || '')
        .toUpperCase()
        .includes('TAP'),
  );
  if (chassis) {
    const chassisData = chassis.data as HardwareNodeData;
    bullets.push(`Connects into: ${chassisData.label} (${chassisData.model})`);

    const optics = chassisData.optics || [];
    if (optics.length > 0) {
      const skuCounts = new Map<string, number>();
      optics.forEach((o) => skuCounts.set(o.optic, (skuCounts.get(o.optic) || 0) + o.qty));
      const list = Array.from(skuCounts.entries())
        .map(([sku, qty]) => `${sku} ×${qty}`)
        .join(', ');
      bullets.push(`Installed optics on ${chassisData.label}: ${list}`);
    }
  }

  return bullets;
}

export function describeAggregatedTapPhysicalLink(
  group: CustomNode[],
  nodes: CustomNode[],
  edges: Edge[],
): string[] {
  if (group.length === 0) return [];
  if (group.length === 1) return describeTapPhysicalLink(group[0], nodes, edges);

  const bullets: string[] = [];
  const first = group[0];
  const isHardwareTap = first.type === NODE_TYPES.HARDWARE;
  const data = first.data as InputNodeData & HardwareNodeData;

  let fiberMode: string;
  if (isHardwareTap) {
    const sku = String(data.sku || '');
    const model = String(data.model || '');
    const isSM =
      sku.includes('253') ||
      sku.includes('273') ||
      sku.includes('453') ||
      model.toLowerCase().includes('single-mode') ||
      model.toLowerCase().includes('sm');
    fiberMode = isSM ? 'Singlemode' : 'Multimode';
  } else {
    fiberMode = data.tapFiberMode || 'Multimode';
  }

  const opticVal = data.tappedLinkOptic;
  if (opticVal) {
    const cleanSku = opticVal.split(' ')[0];
    const matched = SUPPORTED_TAP_OPTICS.find((o) => o.value === cleanSku);
    bullets.push(`Fibre: ${fiberMode}${matched ? ` — ${matched.label}` : ` (optic: ${opticVal})`}`);
  } else {
    bullets.push(`Fibre: ${fiberMode}`);
  }

  // Calculate total tapped links across all modules in the group
  let totalLinks = 0;
  group.forEach((n) => {
    const ndata = n.data as InputNodeData & HardwareNodeData;
    const links = ndata.tappedLinksCount || (String(ndata.model || '').includes('273') ? 6 : 1);
    totalLinks += links;
  });
  const avgLinks = Math.round(totalLinks / group.length);
  bullets.push(
    `Tapped links: ${totalLinks} monitored link${totalLinks !== 1 ? 's' : ''} across ${group.length} modules (${avgLinks} links per module)`,
  );

  // Find all distinct chassis connected to the modules in this group
  const connectedChassisMap = new Map<string, CustomNode>();

  group.forEach((n) => {
    const neighbours = [...getUpstreamNodes(n.id, nodes, edges), ...getDownstreamNodes(n.id, nodes, edges)];
    neighbours.forEach((nb) => {
      if (
        nb.type === NODE_TYPES.HARDWARE &&
        !String((nb.data as HardwareNodeData).model || '')
          .toUpperCase()
          .includes('TAP')
      ) {
        connectedChassisMap.set(nb.id, nb);
      }
    });
  });

  const connectedChassisLabels: string[] = [];
  const allOptics = new Map<string, number>();

  connectedChassisMap.forEach((chassis) => {
    const cdata = chassis.data as HardwareNodeData;
    const sitePrefix = cdata.site ? `${cdata.site} · ` : '';
    connectedChassisLabels.push(`${sitePrefix}${cdata.label || cdata.model}`);

    (cdata.optics || []).forEach((o) => {
      allOptics.set(o.optic, (allOptics.get(o.optic) || 0) + o.qty);
    });
  });

  if (connectedChassisLabels.length > 0) {
    bullets.push(`Connects into: ${connectedChassisLabels.join(', ')}`);
  }

  if (allOptics.size > 0) {
    const list = Array.from(allOptics.entries())
      .map(([sku, qty]) => `${sku} ×${qty}`)
      .join(', ');
    bullets.push(`Installed optics across aggregation nodes: ${list}`);
  }

  return bullets;
}
