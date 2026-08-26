import { skuService } from '../../services/skuService';

// Maps SUPPORTED_TAP_OPTICS picker values (src/constants/nodeTypes.ts) to the
// real Gigamon transceiver SKU. Every value in that list must have an entry
// here — otherwise resolveOpticSku falls through to its legacy fallback and
// leaks the raw picker value (e.g. "10G-SFP-SR") into the BOM as if it were
// a real part number.
const TAP_OPTIC_SKU_MAP: Record<string, string> = {
  '1G-SFP-SX': 'SFP-502T',
  '1G-SFP-LX': 'SFP-503T',
  '1G-SFP-CU': 'SFP-501T',
  '10G-SFP-SR': 'SFP-532T',
  '10G-SFP-LR': 'SFP-533T',
  '10G-SFP-CU6': 'SFP-531T',
  '25G-SFP28-SR': 'SFP-552T',
  '25G-SFP28-LR': 'SFP-553T',
  '40G-QSFP-SR4': 'QSF-502T',
  '40G-QSFP-SWDM4': 'QSF-508',
  '40G-QSFP-LR4': 'QSF-503T',
  '40G-QSFP-PSM4': 'QSF-506T',
  '100G-QSFP28-SR4': 'Q28-502T',
  '100G-QSFP28-SWDM4': 'Q28-508',
  '100G-QSFP28-LR4': 'Q28-503T',
  'QSB-501': 'QSB-501',
  'QSB-521': 'QSB-521',
  'QSB-523T': 'QSB-523T',
  'QSB-531': 'QSB-531',
};

export function resolveOpticSku(opticStr: string, chassisModel: string): string {
  if (!opticStr) return '';
  const trimmed = opticStr.trim();
  const firstWord = trimmed.split(' ')[0].toUpperCase();

  // If the first word is already an exact, orderable SKU in the catalog, preserve it exactly!
  // This allows explicit non-TAA selections (e.g. SFP-533, SFP-532, QSF-502) as well as TAA (SFP-533T, SFP-532T)
  if (skuService.getSKUByPartNumber(firstWord)) {
    return firstWord;
  }

  if (TAP_OPTIC_SKU_MAP[trimmed]) return TAP_OPTIC_SKU_MAP[trimmed];
  if (TAP_OPTIC_SKU_MAP[firstWord]) return TAP_OPTIC_SKU_MAP[firstWord];

  const name = trimmed.toUpperCase();
  if (name.includes('1G COPPER')) return 'SFP-501T';
  if (name.includes('1G MULTIMODE SX') || name.includes('1G MM SX')) return 'SFP-502T';
  if (name.includes('1G SINGLEMODE LX') || name.includes('1G SM LX')) return 'SFP-503T';
  if (name.includes('10G COPPER')) return 'SFP-531T';
  if (name.includes('10G MULTIMODE SR') || name.includes('10G MM SR')) return 'SFP-532T';
  if (name.includes('10G SINGLEMODE LR') || name.includes('10G SM LR')) return 'SFP-533T';
  if (name.includes('25G MULTIMODE SR') || name.includes('25G MM SR')) return 'SFP-552T';
  if (name.includes('25G SINGLEMODE LR') || name.includes('25G SM LR') || name.includes('SFP-553T')) return 'SFP-553T';
  if (name.includes('40G MULTIMODE SR4') || name.includes('40G MM SR4')) return 'QSF-502T';
  if (name.includes('40G SINGLEMODE LR4') || name.includes('40G SM LR4')) return 'QSF-503T';
  if (name.includes('100G MULTIMODE SR4') || name.includes('100G MM SR4')) return 'Q28-502T';
  if (name.includes('100G SINGLEMODE LR4') || name.includes('100G SM LR4') || name.includes('Q28-503T'))
    return 'Q28-503T';
  if (name.includes('Q28-503') || name.includes('QSFP28-503')) return 'Q28-503T';
  if (name.includes('SFP-553')) return 'SFP-553T';

  if (firstWord === 'CABLE') {
    if (chassisModel.includes('TA200') || chassisModel.includes('HC3')) {
      return 'CBL-505';
    } else if (chassisModel.includes('TA400')) {
      return 'CBL-602';
    }
    return 'CBL-205';
  }

  const taaSku = firstWord + 'T';
  if (skuService.getSKUByPartNumber(taaSku)) {
    return taaSku;
  }
  return firstWord;
}

export function getSkus(): Record<string, string> {
  const map: Record<string, string> = {};
  skuService.getAllSKUs().forEach((item) => {
    map[item.partNumber.toUpperCase()] = item.description;
  });
  return map;
}
