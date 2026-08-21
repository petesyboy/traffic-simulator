/**
 * sku.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * TypeScript interface definitions for Gigamon SKUs, hardware models,
 * port specifications, transceivers, and accessories.
 */

export type SkuCategory =
  | 'Chassis'
  | 'Module'
  | 'TAP'
  | 'Optic'
  | 'Transceiver'
  | 'License'
  | 'Software'
  | 'Support'
  | 'Accessory'
  | 'Cable'
  | 'Power'
  | 'Fan'
  | 'Other';

export interface PortSpec {
  count: number;
  speed: string;
  connectorType?: 'SFP+' | 'SFP28' | 'QSFP+' | 'QSFP28' | 'QSFP-DD' | 'RJ45' | 'MPO' | string;
}

export interface TransceiverSpec {
  formFactor: 'SFP' | 'SFP+' | 'SFP28' | 'QSFP+' | 'QSFP28' | 'QSFP-DD' | string;
  speed: string;
  fiberMode?: 'Singlemode' | 'Multimode' | 'Copper';
  reach?: string;
  isTaaCompliant?: boolean;
}

export interface HardwareFamily {
  name: string;
  subFamilies: string[];
}

export interface SKUItem {
  partNumber: string;
  description: string;
  category: string;
  status?: 'Active' | 'EOS' | 'EOL' | 'Discontinued' | 'Unavailable';
  isUnavailable?: boolean;
  productFamily?: string;
  productSubFamily?: string;
  countryOfOrigin?: string;
  endOfSale?: string;
  endOfLife?: string;
  eosReplacementSku?: string;
  supportAvailable?: boolean;
  listPrice?: number;
  listPriceMonthly?: number;
  portDensity?: number;
  speedsSupported?: string[];
  formFactor?: string;
  powerWatts?: number;
  isTaaCompliant?: boolean;
}
