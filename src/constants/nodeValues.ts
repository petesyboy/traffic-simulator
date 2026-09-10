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
  actionType?: string,
  toolName?: string,
  model?: string,
  sku?: string,
  skuDescription?: string,
): string => {
  const modelUpper = (model || '').toUpperCase();
  const skuUpper = (sku || '').toUpperCase();

  // 1. Hardware TAPs & Breakout Panels (Advanced Mode & Input Nodes)
  if (
    modelUpper.includes('TAP') ||
    skuUpper.includes('TAP') ||
    skuUpper.startsWith('GTP') ||
    modelUpper.startsWith('G-TAP') ||
    modelUpper.startsWith('PNL-') ||
    skuUpper.startsWith('PNL-')
  ) {
    // Active TAPs (G-TAP A Series)
    if (modelUpper.startsWith('G-TAP') || skuUpper.startsWith('GTP')) {
      return "1RU active network TAP delivering continuous full-duplex traffic monitoring for high-speed copper or optical links with zero packet loss, redundant power supplies, and fail-safe hardware bypass protection.";
    }

    // Breakout Panels
    if (modelUpper.startsWith('PNL-') || skuUpper.startsWith('PNL-')) {
      return "High-density optical breakout panel (occupies 1 slot in an M100T or M200T tray) converting multi-fibre MPO parallel optics into discrete LC simplex/duplex connections for clean tap routing.";
    }

    // TAP Chassis / Trays
    if (modelUpper.includes('TAP-M100T') || modelUpper.includes('TAP-M200T') || modelUpper.includes('TAP-M202ULT')) {
      return "Modular rack-mount chassis housing passive optical TAP modules and breakout panels with high-density front-panel cable management.";
    }

    // Passive Optical TAP Modules (e.g. TAP-M271ULT, TAP-M251T, etc.)
    if (skuDescription) {
      return `${skuDescription} Provides 100% passive, fail-safe physical inline visibility into live network links without introducing latency, power overheads, or points of network failure.`;
    }
    return "High-density passive optical TAP module providing 100% fail-safe physical inline visibility across live network links with zero packet loss, zero latency, and no active power requirements.";
  }

  // 2. Hardware Chassis (HC Series & TA Series)
  if (type === 'hardwareNode' || configType === 'Hardware' || configType === 'Chassis' || configType === 'HC' || configType === 'TA') {
    if (modelUpper.includes('TA25')) {
      return "GigaVUE-TA25E: High-density 1RU traffic aggregator with 48x 10/25GbE SFP28 and 8x 40/100GbE QSFP28 uplink ports. Consolidates access-layer TAP and SPAN feeds for wire-speed forwarding to tools or GigaSMART nodes without onboard processing overhead.";
    }
    if (modelUpper.includes('TA400')) {
      return "GigaVUE-TA400(E): Ultra-high-density 1RU traffic aggregator equipped with 32x 400GbE QSFP-DD ports, engineered for next-generation data centre backbones and service-provider line rates.";
    }
    if (modelUpper.includes('TA200')) {
      return "GigaVUE-TA200(E): High-density 1RU/2RU core traffic aggregator offering 64x 40/100GbE QSFP28 ports to aggregate massive core or data centre traffic volumes without packet drops.";
    }
    if (modelUpper.includes('HCT')) {
      return "GigaVUE-HCT: Compact top-of-rack 1RU Visibility Fabric node combining high-speed port aggregation with onboard GigaSMART processing, purpose-built for space-constrained edge and rack deployments.";
    }
    if (modelUpper.includes('HC1-PLUS') || modelUpper.includes('HC1P')) {
      return "GigaVUE-HC1-Plus: High-performance 1RU Visibility Fabric node with 8x 25GbE SFP28 ports and 2 modular expansion bays supporting up to 100G, combining wire-speed aggregation with advanced GigaSMART intelligence.";
    }
    if (modelUpper.includes('HC1')) {
      return "GigaVUE-HC1: Modular 1RU Visibility Fabric node combining port aggregation (4x 1GbE RJ45 + 12x 1/10GbE SFP+) with onboard GigaSMART processing (deduplication, slicing, masking, SSL decryption, AMI metadata) across 2 modular expansion bays.";
    }
    if (modelUpper.includes('HC3')) {
      return "GigaVUE-HC3: Modular 3RU Visibility Fabric node combining high-density traffic aggregation with multi-engine GigaSMART processing across 4 line cards, built for large enterprise core and carrier environments.";
    }
    if (modelUpper.includes('HC2')) {
      return "GigaVUE-HC2: Modular 2RU Visibility Fabric node supporting up to 4 line cards with flexible port aggregation and GigaSMART processing.";
    }
    if (modelUpper.includes('GSA') || toolName === 'GigaSMART Appliance') {
      return "GigaSMART Appliance (GSA): Dedicated high-throughput hardware appliance running specialised GigaSMART processing engines for compute-intensive SSL/TLS decryption, deduplication, and application metadata generation.";
    }
    if (skuDescription) {
      return skuDescription;
    }
    return "Physical Gigamon node providing high-density traffic aggregation, optical media translation, and hardware-accelerated flow mapping.";
  }

  // 3. Input Ports & Demonstration TAPs
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

  // 4. Traffic Maps
  if (type === 'mapNode') {
    return "Gigamon Flow Maps intelligently forward only the specific network traffic that target tools need to analyse, shielding them from noise.";
  }

  // 5. Transformations / Filters
  if (type === 'filterNode') {
    if (configType === CONFIG_TYPES.VLAN_FILTER) {
      return "Isolates traffic by VLAN boundaries, ensuring departments or secure zones are separated and directed to appropriate sensors.";
    }
    if (configType === CONFIG_TYPES.IP_FILTER) {
      return "Filters packet streams by IP Subnets to target specific network ranges, significantly reducing tool ingest load.";
    }
    return "Applies packet filters to select and route protocols or netblocks, keeping analytical tools efficient and focused.";
  }

  // 6. GigaStream Load Balancers
  if (configType === 'GigaStream' || type === 'gigaStreamNode') {
    return "Splits high-throughput packet streams across multiple physical tool instances, preventing tool overload and packet drops.";
  }

  // 7. GigaSMART Applications
  if (type === 'gigaSmartNode' || actionType) {
    if (actionType === ACTION_TYPES.DEDUPLICATION) {
      return "Eliminates duplicate packets at the visibility layer, reducing network traffic volume by 30-50% and extending downstream tool capacity.";
    }
    if (actionType === ACTION_TYPES.PACKET_SLICING) {
      return "Slices packet payloads to keep only the headers needed for protocol analysis, reducing tool bandwidth requirements by up to 80%.";
    }
    if (actionType === ACTION_TYPES.HEADER_STRIP) {
      return "Strips outer protocol headers (such as VXLAN, MPLS, or VLAN tags) before forwarding, ensuring security and analysis tools receive standard normalised packets without encapsulation overhead.";
    }
    if (actionType === ACTION_TYPES.GTP_FLOW_FILTERING) {
      return "Statefully correlates mobile control (GTP-C) and user plane (GTP-U) traffic to filter sessions by subscriber IMSI, IMEI, or APN, offloading carrier monitoring tools.";
    }
    if (actionType === ACTION_TYPES.GTP_WHITELISTING) {
      return "Prioritises and isolates high-value VIP subscriber sessions by IMSI or APN, ensuring critical traffic is forwarded to security tools while discarding bulk noise.";
    }
    if (actionType === ACTION_TYPES.GTP_FLOW_SAMPLING) {
      return "Performs subscriber-aware session sampling across mobile carrier traffic, preserving complete multi-packet session integrity for sampled subscribers.";
    }
    if (actionType === ACTION_TYPES.IP_FLOWVUE) {
      return "Provides intelligent subscriber flow sampling for mobile networks, reducing tool ingest bandwidth while maintaining complete visibility into sampled sessions.";
    }
    if (actionType === ACTION_TYPES.APP_METADATA) {
      return "Application metadata captures who, what, where and how apps are used, helping organisations improve visibility, strengthen security, speed troubleshooting, and make smarter decisions about performance, risk, cost, and compliance overall.";
    }
    if (actionType === ACTION_TYPES.SSL_DECRYPT) {
      return "Decrypts SSL/TLS traffic once and forwards the cleartext to multiple security tools, eliminating duplicate decryption overhead.";
    }
    if (
      actionType === ACTION_TYPES.ERSPAN_DECAP ||
      actionType === ACTION_TYPES.TUNNELING ||
      actionType === ACTION_TYPES.L2GRE_DECAP ||
      actionType === ACTION_TYPES.VXLAN_DECAP ||
      actionType === 'Tunneling' ||
      actionType === 'Tunneling (ERSPAN Decap)'
    ) {
      return "Terminates and decapsulates ERSPAN, L2GRE, and VXLAN tunnels at wire speed, stripping tunnel headers to allow tools to inspect genuine inner payload traffic from remote branches and cloud environments.";
    }
    return `Applies GigaSMART ${actionType || 'processing'} to optimise, protect, and scale downstream monitoring tools.`;
  }

  // 8. Target Tools & Storage
  if (type === 'toolNode') {
    if (toolName === 'Splunk') {
      return "Transforms raw data into searchable events, indexes it, and stores the results in an index. Connecting Splunk to S3 storage sets up a visual federated search boundary to lower ingest fees.";
    }
    if (configType === 'Objects' || toolName === 'Objects' || toolName === 'S3 / Object Storage') {
      return "Stores long-term network traffic archives cost-effectively in S3/Object Storage, enabling direct federated search queries.";
    }
    if (toolName === 'GigaSMART Appliance') {
      return "Dedicated high-throughput hardware appliance running specialised GigaSMART processing engines for compute-intensive SSL/TLS decryption, deduplication, and application metadata generation.";
    }
    return "Monitors and analyses network packets to detect threats or measure performance. Gigamon ensures it receives optimised, clean traffic.";
  }

  return "A visibility pipeline node designed to collect, optimise, route, or inspect network intelligence.";
};
