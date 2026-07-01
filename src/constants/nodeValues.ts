/**
 * nodeValues.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Sales-focused business value propositions for various Gigamon Flow Map components
 * to help sales reps easily explain "Why Gigamon?" during presentations.
 */

import { CONFIG_TYPES, ACTION_TYPES } from './nodeTypes';

export const getNodeValueProposition = (
  type: string,
  configType?: string,
  actionType?: string
): string => {
  // 1. Input Ports & TAPs
  if (type === 'inputNode' || configType === 'TAP' || configType === 'SPAN') {
    if (configType === CONFIG_TYPES.TAP) {
      return "Provides 100% fail-safe physical visibility into network links without introducing points of failure or disrupting active production traffic.";
    }
    if (configType === CONFIG_TYPES.SPAN) {
      return "Accesses switch mirror ports to aggregate and copy packet streams, supplying analytical tools with complete network context.";
    }
    if (configType === CONFIG_TYPES.ERSPAN) {
      return "Ingests encapsulated packet streams from remote virtual layers or branch locations, centralizing remote monitoring.";
    }
    if (configType === CONFIG_TYPES.VMWARE) {
      return "Provides virtual container estate visibility, capturing east-west cloud traffic that traditional physical taps cannot reach.";
    }
    return "Establishes a visibility access point to capture and mirror live network traffic streams safely and non-disruptively.";
  }

  // 2. Traffic Maps
  if (type === 'mapNode') {
    return "Gigamon Flow Maps intelligently forward only the specific network traffic that target tools need to analyze, shielding them from noise.";
  }

  // 3. Transformations / Filters
  if (type === 'filterNode') {
    if (configType === CONFIG_TYPES.VLAN_FILTER) {
      return "Isolates traffic by VLAN boundaries, ensuring departments or secure zones are separated and directed to appropriate sensors.";
    }
    if (configType === CONFIG_TYPES.IP_FILTER) {
      return "Filters packet streams by IP Subnets to target specific network ranges, significantly reducing tool ingest load.";
    }
    return "Applies packet filters to select and route protocols or netblocks, keeping analytical tools efficient and focused.";
  }

  // 4. GigaStream Load Balancers
  if (configType === 'GigaStream' || type === 'gigaStreamNode') {
    return "Splits high-throughput packet streams across multiple physical tool instances, preventing tool overload and packet drops.";
  }

  // 5. GigaSMART Applications
  if (type === 'gigaSmartNode' || actionType) {
    if (actionType === ACTION_TYPES.DEDUPLICATION) {
      return "Eliminates duplicate packets at the visibility layer, reducing network traffic volume by 30-50% and extending downstream tool capacity.";
    }
    if (actionType === ACTION_TYPES.PACKET_SLICING) {
      return "Slices packet payloads to keep only the headers needed for protocol analysis, reducing tool bandwidth requirements by up to 80%.";
    }
    if (actionType === ACTION_TYPES.HEADER_STRIP) {
      return "Strips protocol headers (like VxLAN/VLAN tags) before forwarding, ensuring legacy analysis tools can read modern encapsulated packets.";
    }
    if (actionType === ACTION_TYPES.APP_METADATA) {
      return "Extracts L4-L7 intelligence (NetFlow, JSON) offloading tool CPU capacity by 95% while retaining visibility for security and analytics.";
    }
    if (actionType === ACTION_TYPES.SSL_DECRYPT) {
      return "Decrypts SSL/TLS traffic once and forwards the cleartext to multiple security tools, eliminating duplicate decryption overhead.";
    }
    return `Applies GigaSMART ${actionType || 'processing'} to optimize, protect, and scale downstream monitoring tools.`;
  }

  // 6. Target Tools & Storage
  if (type === 'toolNode') {
    if (configType === 'Objects') {
      return "Stores long-term network traffic archives cost-effectively in S3/Object Storage, enabling direct federated search queries.";
    }
    if (configType === 'Splunk') {
      return "Index and query log intelligence. Connecting Splunk to S3 storage sets up a visual federated search boundary to lower ingest fees.";
    }
    return "Monitors and analyzes network packets to detect threats or measure performance. Gigamon ensures it receives optimized, clean traffic.";
  }

  // 7. Hardware Chassis (Advanced Mode)
  if (configType === 'Chassis' || configType === 'HC' || configType === 'TA') {
    return "Physical Gigamon node providing high-density traffic aggregation, optical media translation, and hardware-accelerated flow mapping.";
  }

  return "A visibility pipeline node designed to collect, optimize, route, or inspect network intelligence.";
};
