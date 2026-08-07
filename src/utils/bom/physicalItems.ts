/**
 * physicalItems.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Physical rack/deployment specs (RU, dimensions, weight, power, heat, airflow)
 * derived from a topology's nodes + BOM. Shared by the BOM modal's Physical tab
 * and the PDF report's optional physical appendix — extracted here so both stay
 * in sync rather than drifting apart as separately hand-maintained spec tables.
 */
import type { CustomNode } from '../../store/types';
import type { BomRow } from './bomGenerator';
import type { HardwareNodeData } from '../../store/types';

export function parseAndConvertDimensions(dimStr: string) {
  const regex = /([\d.]+)\s*in\s*x\s*([\d.]+)\s*in\s*x\s*([\d.]+)\s*in/i;
  const match = dimStr.match(regex);
  if (match) {
    const h = parseFloat(match[1]);
    const w = parseFloat(match[2]);
    const d = parseFloat(match[3]);
    const hCm = (h * 2.54).toFixed(2);
    const wCm = (w * 2.54).toFixed(2);
    const dCm = (d * 2.54).toFixed(2);
    return {
      inches: dimStr,
      cm: `${hCm} cm x ${wCm} cm x ${dCm} cm`,
    };
  }
  return {
    inches: dimStr,
    cm: dimStr,
  };
}

export interface PhysicalItem {
  name: string;
  qty: number;
  ru: string;
  ruNum: number;
  dimensions: string;
  weight: string;
  weightNum: number;
  power: string;
  powerNum: number;
  heat: string;
  heatNum: number;
  airflow: string;
  site: string;
}

export function buildPhysicalItems(nodes: CustomNode[], bomItems: BomRow[]): PhysicalItem[] {
  const physicalItems: PhysicalItem[] = [];

  // Tray rollup per site
  const siteTrays: Record<string, { t100: number; t200: number; tUlt: number }> = {};
  bomItems.forEach((i) => {
    const siteKey = i.site || 'Global / Unassigned';
    if (!siteTrays[siteKey]) siteTrays[siteKey] = { t100: 0, t200: 0, tUlt: 0 };
    if (i.sku === 'TAP-M100T') siteTrays[siteKey].t100 += i.qty;
    if (i.sku === 'TAP-M200T' || i.sku === 'TAP-M200') siteTrays[siteKey].t200 += i.qty;
    if (i.sku === 'TAP-M200ULT' || i.sku === 'TAP-M202ULT') siteTrays[siteKey].tUlt += i.qty;
  });

  Object.entries(siteTrays).forEach(([siteKey, trays]) => {
    if (trays.t100 > 0) {
      physicalItems.push({
        name: 'TAP-M100T Chassis Tray (1/2 RU)',
        qty: trays.t100,
        ru: `${trays.t100 * 0.5} RU`,
        ruNum: trays.t100 * 0.5,
        dimensions: '0.81 in x 17.3 in x 6.10 in',
        weight: `${(trays.t100 * 3.3).toFixed(1)} lbs (${(trays.t100 * 1.5).toFixed(1)} kg)`,
        weightNum: trays.t100 * 3.3,
        power: '0 W',
        powerNum: 0,
        heat: '0 BTU/hr',
        heatNum: 0,
        airflow: 'Passive',
        site: siteKey,
      });
    }
    if (trays.t200 > 0) {
      physicalItems.push({
        name: 'TAP-M200T Chassis Tray (1 RU)',
        qty: trays.t200,
        ru: `${trays.t200 * 1} RU`,
        ruNum: trays.t200 * 1,
        dimensions: '1.72 in x 17.3 in x 6.10 in',
        weight: `${(trays.t200 * 3.8).toFixed(1)} lbs (${(trays.t200 * 1.7).toFixed(1)} kg)`,
        weightNum: trays.t200 * 3.8,
        power: '0 W',
        powerNum: 0,
        heat: '0 BTU/hr',
        heatNum: 0,
        airflow: 'Passive',
        site: siteKey,
      });
    }
    if (trays.tUlt > 0) {
      physicalItems.push({
        name: 'TAP-M202ULT Unidirectional Chassis Tray (1 RU)',
        qty: trays.tUlt,
        ru: `${trays.tUlt * 1} RU`,
        ruNum: trays.tUlt * 1,
        dimensions: '1.72 in x 17.3 in x 6.10 in',
        weight: `${(trays.tUlt * 3.8).toFixed(1)} lbs (${(trays.tUlt * 1.7).toFixed(1)} kg)`,
        weightNum: trays.tUlt * 3.8,
        power: '0 W',
        powerNum: 0,
        heat: '0 BTU/hr',
        heatNum: 0,
        airflow: 'Passive',
        site: siteKey,
      });
    }
  });

  // Hardware-node physical specs
  const hwNodes = nodes.filter((n) => n.type === 'hardwareNode');
  hwNodes.forEach((node) => {
    const d = node.data as HardwareNodeData;
    const model = String(d.model || '').toUpperCase();
    const label = d.label || model;
    const siteKey = d.site || 'Global / Unassigned';

    if (model.includes('TAP') && !model.includes('TAP-M')) {
      const isAC = !String(d.powerSupply || '').includes('DC');
      const pwr = isAC ? 337 : 308;
      const btu = isAC ? 1149 : 1050;
      physicalItems.push({
        name: `${label} (${model})`,
        qty: 1,
        ru: '1 RU',
        ruNum: 1,
        dimensions: '1.72 in x 17.3 in x 6.10 in',
        weight: '4.5 lbs (2.0 kg)',
        weightNum: 4.5,
        power: `${pwr} W`,
        powerNum: pwr,
        heat: `${btu} BTU/hr`,
        heatNum: btu,
        airflow: 'Front-to-Rear',
        site: siteKey,
      });
    } else if (model.includes('TA25')) {
      physicalItems.push({
        name: `${label} (TA25E)`,
        qty: 1,
        ru: '1 RU',
        ruNum: 1,
        dimensions: '1.75 in x 17.32 in x 19.25 in',
        weight: '19.0 lbs (8.62 kg)',
        weightNum: 19.0,
        power: '400 W',
        powerNum: 400,
        heat: '1365 BTU/hr',
        heatNum: 1365,
        airflow: 'Front-to-Rear',
        site: siteKey,
      });
    } else if (model.includes('TA200')) {
      const isE = model.includes('TA200E');
      const pwr = isE ? 800 : 1069;
      const btu = isE ? 2730 : 3645;
      physicalItems.push({
        name: `${label} (${isE ? 'TA200E' : 'TA200'})`,
        qty: 1,
        ru: '2 RU',
        ruNum: 2,
        dimensions: '3.48 in x 17.32 in x 21.25 in',
        weight: '33.6 lbs (15.24 kg)',
        weightNum: 33.6,
        power: `${pwr} W`,
        powerNum: pwr,
        heat: `${btu} BTU/hr`,
        heatNum: btu,
        airflow: 'Front-to-Rear',
        site: siteKey,
      });
    } else if (model.includes('TA400')) {
      physicalItems.push({
        name: `${label} (TA400E)`,
        qty: 1,
        ru: '1 RU',
        ruNum: 1,
        dimensions: '1.75 in x 17.32 in x 23.23 in',
        weight: '26.12 lbs (11.85 kg)',
        weightNum: 26.12,
        power: '1294 W',
        powerNum: 1294,
        heat: '4412 BTU/hr',
        heatNum: 4412,
        airflow: 'Front-to-Rear',
        site: siteKey,
      });
    } else if (model.includes('HCT')) {
      physicalItems.push({
        name: `${label} (GigaVUE-HCT)`,
        qty: 1,
        ru: '1 RU',
        ruNum: 1,
        dimensions: '1.75 in x 8.4 in x 12.5 in',
        weight: '5.8 lbs (2.63 kg)',
        weightNum: 5.8,
        power: '286 W',
        powerNum: 286,
        heat: '975 BTU/hr',
        heatNum: 975,
        airflow: 'Front-to-Rear',
        site: siteKey,
      });
    } else if (model.includes('HC1-PLUS') || model.includes('HC1P')) {
      physicalItems.push({
        name: `${label} (GigaVUE-HC1-Plus)`,
        qty: 1,
        ru: '1 RU',
        ruNum: 1,
        dimensions: '1.70 in x 17.0 in x 23.0 in',
        weight: '33.8 lbs (15.36 kg)',
        weightNum: 33.8,
        power: '650 W',
        powerNum: 650,
        heat: '2216 BTU/hr',
        heatNum: 2216,
        airflow: 'Front-to-Rear',
        site: siteKey,
      });
    } else if (model.includes('HC1') && !model.includes('HC1-PLUS') && !model.includes('HC1P')) {
      physicalItems.push({
        name: `${label} (GigaVUE-HC1)`,
        qty: 1,
        ru: '1 RU',
        ruNum: 1,
        dimensions: '1.75 in x 17.26 in x 19.5 in',
        weight: '20.88 lbs (9.47 kg)',
        weightNum: 20.88,
        power: '360 W',
        powerNum: 360,
        heat: '1227.6 BTU/hr',
        heatNum: 1227.6,
        airflow: 'Front-to-Rear',
        site: siteKey,
      });
    } else if (model.includes('HC3')) {
      physicalItems.push({
        name: `${label} (GigaVUE-HC3)`,
        qty: 1,
        ru: '3 RU',
        ruNum: 3,
        dimensions: '5.25 in x 17.26 in x 29.1 in',
        weight: '88.0 lbs (40.00 kg)',
        weightNum: 88.0,
        power: '2000 W',
        powerNum: 2000,
        heat: '6824.3 BTU/hr',
        heatNum: 6824.3,
        airflow: 'Front-to-Rear',
        site: siteKey,
      });
    }
  });

  return physicalItems;
}
