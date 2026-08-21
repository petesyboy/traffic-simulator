/**
 * siteValidation.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates site tagging consistency across equipment nodes on the canvas.
 *
 * If some equipment is tagged with a physical site name/location and other
 * equipment is left unassigned, this utility identifies the discrepancy so the
 * user can be prompted for confirmation before generating a Bill of Materials
 * or solution report.
 */

import { type CustomNode } from '../../store/types';
import { NODE_TYPES } from '../../constants/nodeTypes';
import { isAutoTrayModel } from '../trayModels';

export interface SiteTaggedNodeInfo {
  id: string;
  label: string;
  site: string;
  type: string;
}

export interface SiteUntaggedNodeInfo {
  id: string;
  label: string;
  type: string;
}

export interface MixedSiteAssignmentResult {
  hasMixedSites: boolean;
  taggedSites: string[];
  taggedNodes: SiteTaggedNodeInfo[];
  untaggedNodes: SiteUntaggedNodeInfo[];
  totalEquipmentCount: number;
}

function getNodeDisplayName(node: CustomNode): string {
  if (node.data?.label && typeof node.data.label === 'string' && node.data.label.trim()) {
    return node.data.label.trim();
  }
  if (node.type === NODE_TYPES.HARDWARE) {
    return (node.data?.model as string) || (node.data?.sku as string) || 'Hardware Chassis';
  }
  if (node.type === NODE_TYPES.INPUT) {
    return (node.data?.configType as string) || 'Traffic Input';
  }
  if (node.type === NODE_TYPES.TOOL) {
    return (node.data?.configType as string) || 'Destination Tool';
  }
  return node.id;
}

/**
 * Checks if there is a mixed site assignment across physical equipment/kits.
 * Returns true if at least one piece of equipment is tagged with a site location
 * AND at least one piece of equipment is left unassigned/untagged.
 */
export function detectMixedSiteAssignment(nodes: CustomNode[]): MixedSiteAssignmentResult {
  // Filter for site-assignable physical equipment/kit nodes, ignoring auto-generated tray nodes
  const equipmentNodes = nodes.filter((n) => {
    if (n.type === NODE_TYPES.HARDWARE) {
      const model = String(n.data?.model || '');
      return !isAutoTrayModel(model);
    }
    return n.type === NODE_TYPES.INPUT || n.type === NODE_TYPES.TOOL;
  });

  const taggedNodes: SiteTaggedNodeInfo[] = [];
  const untaggedNodes: SiteUntaggedNodeInfo[] = [];
  const uniqueSites = new Set<string>();

  equipmentNodes.forEach((node) => {
    const rawSite = node.data?.site;
    const site = typeof rawSite === 'string' ? rawSite.trim() : '';
    const label = getNodeDisplayName(node);

    if (site) {
      uniqueSites.add(site);
      taggedNodes.push({
        id: node.id,
        label,
        site,
        type: node.type || 'equipment',
      });
    } else {
      untaggedNodes.push({
        id: node.id,
        label,
        type: node.type || 'equipment',
      });
    }
  });

  const hasMixedSites = taggedNodes.length > 0 && untaggedNodes.length > 0;

  return {
    hasMixedSites,
    taggedSites: Array.from(uniqueSites).sort(),
    taggedNodes,
    untaggedNodes,
    totalEquipmentCount: equipmentNodes.length,
  };
}
