/**
 * nodeStyles.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared hooks, helpers, and style utilities used by individual node components.
 */

import { useStore } from '../../store/store';
import type { MapCondition } from '../../store/types';

/** Returns the glow CSS class when a node is being highlighted in presentation mode. */
export const useGlowClass = (id: string): string => {
  const glowingNodeId = useStore((state) => state.glowingNodeId);
  return glowingNodeId === id ? 'node-presentation-glow' : '';
};

/** Derives optical TAP metadata (media, split ratio, wavelength, ULT flag) from a SKU/model string pair. */
export const getTapDetails = (sku: string, model: string) => {
  const isULT = sku.includes('ULT') || model.includes('ULT');
  const isActiveTap = model.includes('A-TX') || model.includes('A-SF') || sku.startsWith('GTP-A');
  const isMM = sku.includes('251') || sku.includes('271') || sku.includes('451') || model.toLowerCase().includes('multi-mode') || model.toLowerCase().includes('mm');
  const isSM = sku.includes('253') || sku.includes('273') || sku.includes('453') || model.toLowerCase().includes('single-mode') || model.toLowerCase().includes('sm');

  let media = '';
  let splitRatio = '';
  let wavelength = '';

  if (isMM) {
    media = 'MMF (OM5)';
    wavelength = '850nm';
  } else if (isSM) {
    media = 'SMF (OS2)';
    wavelength = '1310nm';
  }

  // Active TAPs don't have a split ratio — they're electrically powered, not passive optical splitters
  if (!isActiveTap) {
    splitRatio = '50/50';
    if (sku.includes('271') || sku.includes('273')) {
      splitRatio = '70/30';
    } else if (sku.includes('451') || sku.includes('453')) {
      splitRatio = '60/40';
    }
  }

  return { media, splitRatio, wavelength, isULT };
};

/** Generates a concise human-readable summary of a list of map conditions. */
export const getConditionsSummary = (conditions: MapCondition[]) => {
  if (!conditions || conditions.length === 0) return 'No rules';
  return conditions.map((c) => {
    let fieldLabel: string;
    switch (c.field) {
      case 'vlan': fieldLabel = 'VLAN'; break;
      case 'protocol': fieldLabel = 'Proto'; break;
      case 'portdst': fieldLabel = 'Dst Port'; break;
      case 'portsrc': fieldLabel = 'Src Port'; break;
      case 'ipdst': fieldLabel = 'Dst IP'; break;
      case 'ipsrc': fieldLabel = 'Src IP'; break;
      case 'ipver': fieldLabel = 'IP Ver'; break;
      default: fieldLabel = c.field;
    }
    return c.value ? `${fieldLabel}(${c.value})` : fieldLabel;
  }).join(', ');
};
