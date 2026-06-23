
export interface ResolvedSkus {
  hwSku: string;
  swSku?: string;
}

export function resolveNodeSkus(nodeData: any, globalLicenseMode: 'HTL' | 'Perpetual'): ResolvedSkus {
  const model = nodeData.model || '';
  const baseSku = nodeData.sku || '';
  const licenseMode = nodeData.licenseModeOverride && nodeData.licenseModeOverride !== 'default'
    ? nodeData.licenseModeOverride
    : globalLicenseMode;
  const power = nodeData.powerSupply || 'AC';
  const portCapacity = nodeData.portCapacity || 'Full';

  let resolvedSku = baseSku;

  // Resolve base SKU depending on model and power
  if (model.includes('HC1') && !model.includes('HC1-Plus')) {
    resolvedSku = power === 'DC' ? 'GVS-HC102' : 'GVS-HC101';
  } else if (model.includes('HC1-Plus') || model.includes('HC1P')) {
    resolvedSku = power === 'DC' ? 'GVS-HC1P2' : 'GVS-HC1P1';
  } else if (model.includes('HC3')) {
    resolvedSku = power === 'DC' ? 'GVS-HC3A2' : 'GVS-HC3A1';
  } else if (model.includes('HCT')) {
    resolvedSku = 'GVS-HCT01';
  } else if (model.includes('TA25E')) {
    resolvedSku = power === 'DC' ? 'GVS-TAX22E' : 'GVS-TAX21E';
  } else if (model.includes('TA25') && !model.includes('TA25E')) {
    resolvedSku = power === 'DC' ? 'GVS-TAX22' : 'GVS-TAX21';
  } else if (model.includes('TA200E')) {
    resolvedSku = power === 'DC' ? 'GVS-TAC22E' : 'GVS-TAC21E';
  } else if (model.includes('TA200') && !model.includes('TA200E')) {
    resolvedSku = power === 'DC' ? 'GVS-TAC22' : 'GVS-TAC21';
  } else if (model.includes('TA400E')) {
    resolvedSku = power === 'DC' ? 'GVS-TAC42E' : 'GVS-TAC41E';
  } else if (model.includes('TA400') && !model.includes('TA400E')) {
    resolvedSku = power === 'DC' ? 'GVS-TAC42' : 'GVS-TAC41';
  } else if (model.includes('TA10') && !model.includes('TA100')) {
    resolvedSku = power === 'DC' ? 'GVS-TAX02' : 'GVS-TAX01';
  } else if (model.includes('TA100')) {
    resolvedSku = power === 'DC' ? 'GVS-TAC02' : 'GVS-TAC01';
  }

  // TAPs do not have separate HW/SW SKUs, return early
  if (model.includes('TAP')) {
    return { hwSku: resolvedSku };
  }

  // Adjust for port capacity in Perpetual mode
  if (licenseMode !== 'HTL') {
    if (model.includes('TA25E') || model.includes('TA25') || model.includes('TA200') || model.includes('TA400')) {
      if (portCapacity === 'Half') {
        resolvedSku += 'A';
      } else if (portCapacity === 'Quarter') {
        resolvedSku += 'B';
      }
    }
    return { hwSku: resolvedSku };
  }

  // HTL Mode: separate hardware SKU and software SKU
  const hwSku = resolvedSku + '-HW';
  let swSku = '';

  if (model.includes('HC1') && !model.includes('HC1-Plus')) {
    swSku = 'GVS-HC100-SW-TM';
  } else if (model.includes('HC1-Plus') || model.includes('HC1P')) {
    swSku = 'GVS-HC1P-SW-TM';
  } else if (model.includes('HC3')) {
    swSku = 'GVS-HC3A0-SW-TM';
  } else if (model.includes('HCT')) {
    swSku = 'GVS-HCT00-SW-TM';
  } else if (model.includes('TA')) {
    let baseSwSku = resolvedSku;
    if (baseSwSku.includes('TAX21')) baseSwSku = baseSwSku.replace('TAX21', 'TAX20');
    else if (baseSwSku.includes('TAX22')) baseSwSku = baseSwSku.replace('TAX22', 'TAX20');
    else if (baseSwSku.includes('TAC21')) baseSwSku = baseSwSku.replace('TAC21', 'TAC20');
    else if (baseSwSku.includes('TAC22')) baseSwSku = baseSwSku.replace('TAC22', 'TAC20');
    else if (baseSwSku.includes('TAC41')) baseSwSku = baseSwSku.replace('TAC41', 'TAC40');
    else if (baseSwSku.includes('TAC42')) baseSwSku = baseSwSku.replace('TAC42', 'TAC40');
    else {
      baseSwSku = baseSwSku.replace(/[12]/, '0');
    }

    if (portCapacity === 'Half') {
      baseSwSku += 'A';
    } else if (portCapacity === 'Quarter') {
      baseSwSku += 'B';
    }
    swSku = baseSwSku + '-SW-TM';
  }

  return { hwSku, swSku };
}
