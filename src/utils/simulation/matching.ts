/**
 * Convert a dotted-decimal IPv4 string to a 32-bit unsigned integer.
 */
export const ipv4ToInt = (ip: string): number => {
  const parts = ip.split('.');
  if (parts.length !== 4) return NaN;
  let result = 0;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) return NaN;
    result = (result << 8) | num;
  }
  return result >>> 0;
};

/**
 * CIDR-aware IP subnet matching (IPv4).
 */
export const matchesIp = (streamIp: string | undefined, filterIp: string | undefined): boolean => {
  if (!filterIp || !streamIp) return false;

  const cleanFilter = filterIp.trim().toLowerCase();
  const cleanStream = streamIp.trim().toLowerCase();

  if (!cleanFilter.includes('/')) {
    return cleanStream === cleanFilter;
  }

  const [networkStr, prefixStr] = cleanFilter.split('/');
  const prefixLen = parseInt(prefixStr, 10);

  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;

  if (networkStr.includes(':')) {
    const streamBlocks = cleanStream.split(':');
    const networkBlocks = networkStr.split(':');
    const numBlocksToMatch = Math.floor(prefixLen / 16);
    for (let i = 0; i < numBlocksToMatch; i++) {
      if ((streamBlocks[i] || '0') !== (networkBlocks[i] || '0')) return false;
    }
    const remainingBits = prefixLen % 16;
    if (remainingBits > 0 && streamBlocks[numBlocksToMatch] && networkBlocks[numBlocksToMatch]) {
      const s = parseInt(streamBlocks[numBlocksToMatch], 16) || 0;
      const n = parseInt(networkBlocks[numBlocksToMatch], 16) || 0;
      const mask = (0xFFFF << (16 - remainingBits)) & 0xFFFF;
      return (s & mask) === (n & mask);
    }
    return true;
  }

  const networkInt = ipv4ToInt(networkStr);
  const streamInt  = ipv4ToInt(cleanStream.split('/')[0]);

  if (isNaN(networkInt) || isNaN(streamInt)) return false;

  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (networkInt & mask) === (streamInt & mask);
};

/** Match VLAN IDs: filter value is comma-separated, e.g. "100, 200, 300" */
export const matchesVlan = (streamVlan: string | undefined, filterVlan: string | undefined): boolean => {
  if (!filterVlan) return false;
  const allowed = filterVlan.split(',').map((s) => s.trim());
  return allowed.includes(String(streamVlan || '').trim());
};

/** Match destination/source ports: filter value is comma-separated, e.g. "80, 443" */
export const matchesPort = (streamPort: string | undefined, filterPort: string | undefined): boolean => {
  if (!filterPort) return false;
  const allowed = filterPort.split(',').map((s) => s.trim());
  return allowed.includes(String(streamPort || '').trim());
};
