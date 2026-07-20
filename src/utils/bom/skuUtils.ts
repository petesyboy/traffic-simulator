import skusData from '../../constants/skus.json';

const skus: Record<string, string> = skusData as Record<string, string>;

// Maps SUPPORTED_TAP_OPTICS picker values (src/constants/nodeTypes.ts) to the
// real Gigamon transceiver SKU. Every value in that list must have an entry
// here — otherwise resolveOpticSku falls through to its legacy fallback and
// leaks the raw picker value (e.g. "10G-SFP-SR") into the BOM as if it were
// a real part number.
const TAP_OPTIC_SKU_MAP: Record<string, string> = {
  '1G-SFP-SX': 'SFP-502',
  '1G-SFP-LX': 'SFP-503',
  '1G-SFP-CU': 'SFP-501',
  '10G-SFP-SR': 'SFP-532',
  '10G-SFP-LR': 'SFP-533',
  '10G-SFP-CU6': 'SFP-531',
  '25G-SFP28-SR': 'SFP-552',
  '25G-SFP28-LR': 'SFP-553T', // no non-TAA SFP-553 exists
  '40G-QSFP-SR4': 'QSF-502',
  '40G-QSFP-SWDM4': 'QSF-508',
  '40G-QSFP-LR4': 'QSF-503T', // no non-TAA QSF-503 exists
  '40G-QSFP-PSM4': 'QSF-506',
  '100G-QSFP28-SR4': 'Q28-502T', // no non-TAA Q28-502 exists
  '100G-QSFP28-SWDM4': 'Q28-508',
  '100G-QSFP28-LR4': 'Q28-503',
};

export function resolveOpticSku(opticStr: string, chassisModel: string): string {
  if (TAP_OPTIC_SKU_MAP[opticStr]) return TAP_OPTIC_SKU_MAP[opticStr];

  const name = opticStr.toUpperCase();
  if (name.includes('1G COPPER')) return name.includes('SFP-501T') || name.includes('(TAA)') ? 'SFP-501T' : 'SFP-501';
  if (name.includes('1G MULTIMODE SX') || name.includes('1G MM SX')) return name.includes('SFP-502T') || name.includes('(TAA)') ? 'SFP-502T' : 'SFP-502';
  if (name.includes('1G SINGLEMODE LX') || name.includes('1G SM LX')) return name.includes('SFP-503T') || name.includes('(TAA)') ? 'SFP-503T' : 'SFP-503';
  if (name.includes('10G COPPER')) return name.includes('SFP-531T') || name.includes('(TAA)') ? 'SFP-531T' : 'SFP-531';
  if (name.includes('10G MULTIMODE SR') || name.includes('10G MM SR')) return name.includes('SFP-532T') || name.includes('(TAA)') ? 'SFP-532T' : 'SFP-532';
  if (name.includes('10G SINGLEMODE LR') || name.includes('10G SM LR')) return name.includes('SFP-533T') || name.includes('(TAA)') ? 'SFP-533T' : 'SFP-533';
  if (name.includes('25G MULTIMODE SR') || name.includes('25G MM SR')) return 'SFP-552';
  if (name.includes('25G SINGLEMODE LR') || name.includes('25G SM LR') || name.includes('SFP-553T')) return 'SFP-553T';
  if (name.includes('40G MULTIMODE SR4') || name.includes('40G MM SR4')) return 'QSF-502';
  if (name.includes('40G SINGLEMODE LR4') || name.includes('40G SM LR4')) return 'QSF-503T'; // no non-TAA QSF-503 exists
  if (name.includes('100G MULTIMODE SR4') || name.includes('100G MM SR4')) return 'Q28-502T'; // no non-TAA Q28-502 exists
  if (name.includes('100G SINGLEMODE LR4') || name.includes('100G SM LR4') || name.includes('Q28-503T')) return 'Q28-503T';
  if (name.includes('Q28-503') || name.includes('QSFP28-503')) return 'Q28-503';
  if (name.includes('SFP-553')) return 'SFP-553T'; // no non-TAA SFP-553 exists

  const firstWord = opticStr.split(' ')[0];
  if (firstWord === 'Cable') {
    if (chassisModel.includes('TA200') || chassisModel.includes('HC3')) {
      return 'CBL-505';
    } else if (chassisModel.includes('TA400')) {
      return 'CBL-602';
    }
    return 'CBL-205';
  }
  const taaSku = firstWord + 'T';
  if (skus[taaSku]) {
    return taaSku;
  }
  return firstWord;
}

export function getSkus() {
  return skus;
}
