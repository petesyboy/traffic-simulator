/**
 * trafficStreamUtils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Helpers for synthesizing live traffic streams across tapped links and ingress ports.
 * Supports biasing towards Telco & Mobile Core (GTP-U, GTP-C, 5G SBI, VoLTE SIP, RTP,
 * Diameter, FlowVUE), Enterprise & Cloud, or a balanced Mixed profile.
 */

import { type CustomNode, type TrafficStream, type HardwareNodeData, type InputNodeData, type TappedLinkAllocation } from '../store/types';
import { getOpticSpeedMbps } from './hardwareUtils';
import { getTapNodeLinks } from './report/describeTopology';
import { isAutoTrayModel } from './trayModels';

export type TrafficProfileBias = 'mixed' | 'telco' | 'enterprise';

export interface TrafficProfileDefinition {
  name: string;
  port: string;
  proto: 'tcp' | 'udp' | 'icmp';
  category: 'telco' | 'enterprise';
  description?: string;
}

export const TELCO_TRAFFIC_PROFILES: TrafficProfileDefinition[] = [
  { name: 'GTP-U User Plane Tunnel', port: '2152', proto: 'udp', category: 'telco', description: '4G/5G Subscriber User Plane (GTP Correlation & FlowVUE)' },
  { name: 'GTP-C Signalling (S11/S5)', port: '2123', proto: 'udp', category: 'telco', description: 'GTP Control Plane Session Management' },
  { name: '5G Core SBI HTTP/2 REST', port: '8080', proto: 'tcp', category: 'telco', description: '5G Service-Based Architecture (AMF/SMF/UPF/NRF)' },
  { name: 'IMS VoLTE SIP Signalling', port: '5060', proto: 'udp', category: 'telco', description: 'VoLTE & VoNR Call Setup and Tear-down' },
  { name: 'VoLTE RTP Voice Media', port: '5004', proto: 'udp', category: 'telco', description: 'EVS / AMR-WB Real-time Voice Audio Streams' },
  { name: 'Diameter Policy & Charging (Gx/Gy)', port: '3868', proto: 'tcp', category: 'telco', description: 'PCRF/PCEF & HSS Subscriber Policy Signalling' },
  { name: '5G NGAP / S1-AP Signalling', port: '38412', proto: 'tcp', category: 'telco', description: 'gNodeB / eNodeB Radio Access Control Plane' },
  { name: 'IP FlowVUE / NetFlow Collector', port: '2055', proto: 'udp', category: 'telco', description: 'IPFIX / NetFlow High-Rate Flow Telemetry' },
  { name: 'RADIUS Mobile AAA Accounting', port: '1813', proto: 'udp', category: 'telco', description: 'Mobile Subscriber Authentication & Accounting' },
  { name: 'eCPRI / O-RAN Fronthaul', port: '58312', proto: 'udp', category: 'telco', description: 'O-RAN Split 7.2x / eCPRI High-Speed Fronthaul' },
];

export const ENTERPRISE_TRAFFIC_PROFILES: TrafficProfileDefinition[] = [
  { name: 'Web HTTPS Traffic', port: '443', proto: 'tcp', category: 'enterprise', description: 'Secure Web & API Transactions' },
  { name: 'Core DB Sync (PostgreSQL)', port: '5432', proto: 'tcp', category: 'enterprise', description: 'Relational Database Replication' },
  { name: 'REST API Microservices', port: '8080', proto: 'tcp', category: 'enterprise', description: 'Internal Cloud Application Services' },
  { name: 'ERP / Core Banking Flow', port: '9000', proto: 'tcp', category: 'enterprise', description: 'Mission-critical Business Applications' },
  { name: 'DNS Recursive Queries', port: '53', proto: 'udp', category: 'enterprise', description: 'Domain Name Resolution Traffic' },
  { name: 'Video Streaming & UC', port: '5004', proto: 'udp', category: 'enterprise', description: 'Corporate Unified Communications Video' },
  { name: 'Secure Shell / Admin (SSH)', port: '22', proto: 'tcp', category: 'enterprise', description: 'Infrastructure Management & SSH' },
  { name: 'Cloud Ingest & Telemetry', port: '8443', proto: 'tcp', category: 'enterprise', description: 'Cloud SIEM & Telemetry Ingestion' },
  { name: 'Kafka Event Streaming', port: '9092', proto: 'tcp', category: 'enterprise', description: 'Distributed Event Log & Message Broker' },
  { name: 'MySQL / Aurora Queries', port: '3306', proto: 'tcp', category: 'enterprise', description: 'Application Database Query Traffic' },
];

export const ALL_TRAFFIC_PROFILES: TrafficProfileDefinition[] = [
  ...TELCO_TRAFFIC_PROFILES,
  ...ENTERPRISE_TRAFFIC_PROFILES,
];

export interface LinkSpecification {
  nodeId: string;
  nodeLabel: string;
  linkIndex: number;
  speedMbps: number;
}

/**
 * Discovers all monitored links for a specific ingress or TAP node.
 */
export function getMonitoredLinksForNode(node: CustomNode): LinkSpecification[] {
  const isHardware = node.type === 'hardwareNode';
  const model = String(node.data?.model || '');
  const sku = String(node.data?.sku || '');

  // Skip auto-tray chassis containers (e.g. TAP-M100T, TAP-M200T)
  if (isHardware && isAutoTrayModel(model, sku)) {
    return [];
  }

  // Only consider input nodes or hardware TAP modules
  const isTap = isHardware && (model.includes('TAP') || sku.includes('TAP') || (node.data as HardwareNodeData)?.isHardwareTap);
  const isInputNode = node.type === 'inputNode';

  if (!isTap && !isInputNode) {
    return [];
  }

  const nodeLabel = String(node.data?.label || model || sku || 'Ingress Port');
  const links: LinkSpecification[] = [];

  const hwData = node.data as HardwareNodeData;
  const inputData = node.data as InputNodeData;

  const allocations: TappedLinkAllocation[] = (hwData?.tappedLinkAllocations || inputData?.tappedLinkAllocations || []) as TappedLinkAllocation[];

  if (allocations && allocations.length > 0) {
    let currentIdx = 1;
    allocations.forEach((alloc) => {
      const opticName = alloc.toolOptic || alloc.optic || '';
      let speedMbps = getOpticSpeedMbps(opticName);
      if (!speedMbps || speedMbps <= 0) {
        speedMbps = 10000; // Default to 10G
      }
      const qty = Math.max(1, alloc.qty || 1);
      for (let i = 0; i < qty; i++) {
        links.push({
          nodeId: node.id,
          nodeLabel,
          linkIndex: currentIdx++,
          speedMbps,
        });
      }
    });
    return links;
  }

  // If no explicit allocations, evaluate scalar links count or catalogue link capacity
  const totalLinksCount = isTap ? getTapNodeLinks(node) : ((inputData?.tappedLinksCount as number) || 1);
  
  // Resolve default speed
  let defaultSpeedMbps = 10000;
  if (isTap) {
    const isSMTap = sku.includes('253') || sku.includes('273') || sku.includes('453') ||
      model.toLowerCase().includes('single-mode') || model.toLowerCase().includes('sm');
    const isM506T = model.includes('M506T') || sku.includes('M506T');
    const isATX = model.includes('A-TX') || sku.startsWith('TAP-A-TX');

    if (isM506T) {
      defaultSpeedMbps = 40000;
    } else if (isATX) {
      defaultSpeedMbps = 1000;
    } else if (hwData?.tappedLinkOptic) {
      defaultSpeedMbps = getOpticSpeedMbps(hwData.tappedLinkOptic as string) || 10000;
    } else {
      defaultSpeedMbps = isSMTap ? 10000 : 10000;
    }
  } else {
    const portSpeedStr = String(inputData?.portSpeed || '');
    if (portSpeedStr === '1G') defaultSpeedMbps = 1000;
    else if (portSpeedStr === '10G') defaultSpeedMbps = 10000;
    else if (portSpeedStr === '25G') defaultSpeedMbps = 25000;
    else if (portSpeedStr === '40G') defaultSpeedMbps = 40000;
    else if (portSpeedStr === '100G') defaultSpeedMbps = 100000;
    else if (portSpeedStr === '400G') defaultSpeedMbps = 400000;
    else if (typeof inputData?.linkSpeed === 'number' && inputData.linkSpeed > 0) {
      defaultSpeedMbps = inputData.linkSpeed;
    } else if (inputData?.tappedLinkOptic) {
      defaultSpeedMbps = getOpticSpeedMbps(inputData.tappedLinkOptic as string) || 10000;
    }
  }

  for (let i = 1; i <= Math.max(1, totalLinksCount); i++) {
    links.push({
      nodeId: node.id,
      nodeLabel,
      linkIndex: i,
      speedMbps: defaultSpeedMbps,
    });
  }

  return links;
}

export type TrafficUtilisationLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'max'
  | 'full'
  | '10' | '20' | '25' | '30' | '40' | '50' | '60' | '70' | '75' | '80' | '90' | '95' | '100';

export interface GenerateStreamsOptions {
  profileBias?: TrafficProfileBias;
  utilisationLevel?: TrafficUtilisationLevel;
  targetNodeIds?: string[];
  utilizationMin?: number; // e.g. 0.42 (42%)
  utilizationMax?: number; // e.g. 0.58 (58%)
}

/**
 * Synthesizes realistic traffic streams for all tapped links and ingress ports.
 * Applies link utilisation presets (low 10%, medium 50%, high 80%, max 95%, full 100%)
 * or discrete percentages with natural variation and requested profile bias.
 */
export function generateStreamsForTopology(
  nodes: CustomNode[],
  options: GenerateStreamsOptions = {}
): TrafficStream[] {
  const {
    profileBias = 'mixed',
    utilisationLevel = 'medium',
    targetNodeIds,
  } = options;

  let uMin = options.utilizationMin;
  let uMax = options.utilizationMax;

  if (uMin === undefined || uMax === undefined) {
    switch (utilisationLevel) {
      case 'low':
      case '10':
        uMin = 0.09; uMax = 0.11; break;
      case '20':
        uMin = 0.19; uMax = 0.21; break;
      case '25':
        uMin = 0.24; uMax = 0.26; break;
      case '30':
        uMin = 0.29; uMax = 0.31; break;
      case '40':
        uMin = 0.39; uMax = 0.41; break;
      case 'medium':
      case '50':
        uMin = 0.45; uMax = 0.55; break;
      case '60':
        uMin = 0.59; uMax = 0.61; break;
      case '70':
        uMin = 0.69; uMax = 0.71; break;
      case '75':
        uMin = 0.74; uMax = 0.76; break;
      case 'high':
      case '80':
        uMin = 0.78; uMax = 0.82; break;
      case '90':
        uMin = 0.89; uMax = 0.91; break;
      case 'max':
      case '95':
        uMin = 0.93; uMax = 0.97; break;
      case 'full':
      case '100':
        uMin = 1.0; uMax = 1.0; break;
      default:
        uMin = 0.45; uMax = 0.55; break;
    }
  }

  const utilizationMin = uMin;
  const utilizationMax = uMax;

  // Filter nodes if specific target nodes were requested
  const candidateNodes = targetNodeIds && targetNodeIds.length > 0
    ? nodes.filter((n) => targetNodeIds.includes(n.id))
    : nodes;

  // Gather all monitored link specifications
  const allLinks: LinkSpecification[] = [];
  candidateNodes.forEach((node) => {
    const nodeLinks = getMonitoredLinksForNode(node);
    allLinks.push(...nodeLinks);
  });

  if (allLinks.length === 0) {
    return [];
  }

  // Select profile pool based on requested bias
  let profilePool: TrafficProfileDefinition[];
  if (profileBias === 'telco') {
    profilePool = TELCO_TRAFFIC_PROFILES;
  } else if (profileBias === 'enterprise') {
    profilePool = ENTERPRISE_TRAFFIC_PROFILES;
  } else {
    // Mixed profile: alternates between Telco/Mobile and Enterprise
    profilePool = ALL_TRAFFIC_PROFILES;
  }

  const generatedStreams: TrafficStream[] = [];
  const now = Date.now();

  allLinks.forEach((link, idx) => {
    // Select profile cyclically to ensure rich variety
    const profile = profilePool[idx % profilePool.length];

    // Compute randomised utilisation around ~50% (e.g. 42% - 58%)
    const utilVariance = utilizationMin + Math.random() * (utilizationMax - utilizationMin);
    
    // Calculate raw bandwidth in Mbps and round cleanly (to nearest 100 Mbps or discrete step)
    let bandwidthMbps = Math.round((link.speedMbps * utilVariance) / 100) * 100;
    if (bandwidthMbps < 100) bandwidthMbps = Math.max(50, Math.round(link.speedMbps * 0.5));

    const bandwidthLabel = bandwidthMbps >= 1000
      ? `${(bandwidthMbps / 1000).toFixed(1).replace('.0', '')} Gbps`
      : `${bandwidthMbps} Mbps`;

    const randomSubnet = 10 + (idx % 200);
    const randomHost = 10 + ((idx * 7) % 240);
    const vlanId = String(100 + ((idx * 10) % 900));

    const streamName = `${link.nodeLabel} - Link ${link.linkIndex} - ${profile.name} (${bandwidthLabel})`;

    const stream: TrafficStream = {
      id: `t-auto-${now}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      name: streamName,
      sourceNodeId: link.nodeId,
      vlan: vlanId,
      ipSrc: `10.${randomSubnet}.${1 + ((idx * 3) % 250)}.${randomHost}`,
      ipDst: `172.16.${1 + ((idx * 5) % 250)}.${100 + (idx % 100)}`,
      portSrc: String(40000 + ((idx * 137) % 20000)),
      portDst: profile.port,
      protocol: profile.proto,
      bandwidth: bandwidthMbps,
      active: true,
      drift: 1.0,
      lastDriftUpdate: 0,
    };

    generatedStreams.push(stream);
  });

  return generatedStreams;
}

export interface IngressSummary {
  ingressNodeCount: number;
  tapModuleCount: number;
  totalMonitoredLinks: number;
  totalPotentialBandwidthMbps: number;
}

/**
 * Aggregates summary statistics of all ingress sources and tapped links.
 */
export function getTopologyIngressSummary(nodes: CustomNode[]): IngressSummary {
  let ingressNodeCount = 0;
  let tapModuleCount = 0;
  let totalMonitoredLinks = 0;
  let totalPotentialBandwidthMbps = 0;

  nodes.forEach((node) => {
    const links = getMonitoredLinksForNode(node);
    if (links.length > 0) {
      ingressNodeCount += 1;
      const isTap = node.type === 'hardwareNode' || String(node.data?.configType || '').startsWith('TAP');
      if (isTap) tapModuleCount += 1;

      totalMonitoredLinks += links.length;
      links.forEach((l) => {
        totalPotentialBandwidthMbps += l.speedMbps;
      });
    }
  });

  return {
    ingressNodeCount,
    tapModuleCount,
    totalMonitoredLinks,
    totalPotentialBandwidthMbps,
  };
}
