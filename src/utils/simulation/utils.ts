import { type CustomNode } from '../../store/types';

export const getHardwareOpticCapacity = (node: CustomNode): number => {
  if (node.type !== 'hardwareNode') return Infinity;
  const optics = (node.data?.optics as { optic: string, qty: number }[]) || [];
  if (optics.length === 0) return Infinity;
  
  let capacity = 0;
  for (const opt of optics) {
    if (!opt.optic) continue;
    const name = opt.optic.toUpperCase();
    let speed = 0;
    if (name.includes('400G') || name.startsWith('QDD-')) speed = 400000;
    else if (name.includes('100G') || name.startsWith('Q28-')) speed = 100000;
    else if (name.includes('40G') || name.startsWith('QSF-')) speed = 40000;
    else if (name.includes('25G') || name.startsWith('SFP-55')) speed = 25000;
    else if (name.includes('10G') || name.startsWith('SFP-53')) speed = 10000;
    else if (name.includes('1G') || name.startsWith('SFP-50')) speed = 1000;
    capacity += speed * opt.qty;
  }
  return capacity > 0 ? capacity : Infinity;
};

export const isPacketToolConfig = (configType: string): boolean => {
  const norm = configType.trim();
  return norm === 'Packet Tool' || 
         norm === 'ExtraHop' || 
         norm === 'Wireshark' || 
         norm === 'Vectra';
};

export const isMetadataToolConfig = (configType: string): boolean => {
  const norm = configType.trim();
  return norm === 'Metadata Tool' || 
         norm === 'Splunk' || 
         norm === 'Elastic Search' || 
         norm === 'Elastic';
};

export const isStorageToolConfig = (configType: string): boolean => {
  const norm = configType.trim();
  return norm === 'Storage Tool' || 
         norm === 'AWS S3 Storage' || 
         norm === 'S3' ||
         norm === 'Objects';
};
