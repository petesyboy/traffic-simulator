/**
 * toolIngestLimits.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Default ingest-rate ceilings (in Mbps, matching the rest of the simulator's
 * bandwidth units) for well-known packet-consuming tools, plus the flagship
 * appliance model and its typical NIC connectivity options.
 *
 * These are illustrative, published-spec figures for each vendor's flagship
 * single sensor/appliance model — real-world limits vary by specific model,
 * licence tier and deployment. Where a vendor publishes a range or multiple
 * operating modes, the more conservative/typical figure is used as the seed
 * default. They exist purely to give a sensible starting point; the ingest
 * limit is always editable per node in the config panel and none of this has
 * any effect on licensing or the BOM.
 */
export interface ToolIngestProfile {
  applianceModel: string;
  ingestLimitMbps: number;
  connectivity: string[];
}

export const TOOL_INGEST_PROFILES: Record<string, ToolIngestProfile> = {
  'ExtraHop': {
    applianceModel: 'EDA 10300',
    ingestLimitMbps: 100000, // 100 Gbps sustained line-rate stream processing
    connectivity: ['4x 100GbE QSFP28 (Capture)', '2x 10GbE (Mgmt/Capture)', '2x 1GbE (Mgmt/Capture)'],
  },
  'Corelight': {
    applianceModel: 'AP 5000',
    ingestLimitMbps: 100000, // 100-125+ Gbps (Zeek + Suricata acceleration); 100G used as the typical figure
    connectivity: ['2x QSFP28 bays (2x100G, 2x40G, or 8x10G capture)', '4x 10GbE SFP28 (Mgmt/Data)', '2x 1GbE LOM'],
  },
  'Vectra': {
    applianceModel: 'S101 Sensor',
    ingestLimitMbps: 50000, // 50 Gbps Sensor Mode (75 Gbps in Stream Mode)
    connectivity: ['2x SFP28 (10/25GbE) or 2x QSFP/QSFP28 (40/100GbE)', '2x 1GbE Copper (Management)'],
  },
  'Trellix': {
    applianceModel: 'NS9600',
    ingestLimitMbps: 60000, // 60 Gbps single appliance (120 Gbps in a 2-node stack)
    connectivity: ['Up to 12x 100GbE QSFP28 ports', '1x 10G/1G RJ45 (Response)', '1x 10G/1G RJ45 (Management)'],
  },
  'Cisco Secure Network Analytics': {
    applianceModel: 'Flow Sensor 4240 (ST-FS4240-K9)',
    ingestLimitMbps: 80000, // 80 Gbps in 2x40G mode (40 Gbps in 4x10G mode)
    connectivity: ['2x 40GbE QSFP+ Fiber (Monitoring)', '4x 10GbE SFP+ Fiber (Monitoring)', '1x 10GbE/1GbE Copper (Sensor Mgmt)', '1x 1GbE Copper (CIMC Mgmt)'],
  },
  'Arista NDR': {
    applianceModel: 'DCA-NDR-S40',
    ingestLimitMbps: 40000, // 40 Gbps
    connectivity: ['4x 10GbE/40GbE SFP+/QSFP+', '4x 1GbE Onboard Ethernet', '1x Out-of-Band Mgmt'],
  },
  'FortiNDR': {
    applianceModel: 'FortiNDR 3500F / 3600G',
    ingestLimitMbps: 20000, // 20 Gbps
    connectivity: ['4x 10GbE SFP+', '2x 10GbE RJ45 Copper', '2x 1GbE RJ45 (Management)'],
  },
  'NetWitness': {
    applianceModel: 'Network Sensor Series 7',
    ingestLimitMbps: 10000, // 10-20 Gbps full packet capture + parsing; 10G used as the typical baseline
    connectivity: ['2x 10GbE SFP+ DA', '2x 1GbE RJ45 Copper (Management)', 'PCIe expansion slots for add-on 10G/40G NICs'],
  },
  'Trend Micro': {
    applianceModel: 'Deep Discovery Inspector 4000 / 4100',
    ingestLimitMbps: 10000, // 10 Gbps (105+ protocols + sandboxing)
    connectivity: ['4x 10GbE SFP+', '5x 1GbE BASE-T RJ45 Data Ports', '1x 1GbE RJ45 Mgmt + 1x iDRAC'],
  },
  'Darktrace': {
    applianceModel: 'DCIP-Z / DCIP-XA',
    ingestLimitMbps: 10000, // 5-10 Gbps peak sustained, FPGA pre-processed
    connectivity: ['2x 10GbE SFP+ Analysis', '2x 10GbE BASE-T Analysis', '1x 1GbE Analysis', '1x 1GbE Admin + 1x 1GbE OOB'],
  },
  'Endace Packet Capture Appliance': {
    applianceModel: 'EndaceProbe',
    ingestLimitMbps: 100000, // up to 100 Gbps line-rate capture
    connectivity: [],
  },
  'Wireshark': {
    applianceModel: 'Host NIC capture (no dedicated appliance)',
    ingestLimitMbps: 1000,
    connectivity: [],
  },
  'ForeScout': {
    applianceModel: 'eyeSight',
    ingestLimitMbps: 1000, // typical SPAN/TAP monitoring throughput
    connectivity: [],
  },
  'Nozomi': {
    applianceModel: 'Guardian (entry/mid-tier)',
    ingestLimitMbps: 1000,
    connectivity: [],
  },
  'GigaSMART Appliance': {
    applianceModel: 'GigaSMART Appliance (GSA)',
    // Both 400GbE data ports can be used for packet ingress - up to 800 Gbps
    // aggregate when running AMI/AMX-only (metadata exported via the separate
    // SFP28 bank, no packet-return path needed). If a processed-packet return
    // path back to the TA/HC is also wired up, one port is used for that
    // instead, capping ingress at 400 Gbps - editable per node either way.
    ingestLimitMbps: 800000,
    connectivity: [
      '2x 400GbE QSFP-DD data ports - both usable for packet ingress (800G aggregate, AMI/AMX metadata-only mode), or 1 ingress + 1 processed-packet return (400G) if returning packets to the TA/HC',
      '4x 10/25GbE SFP28 (metadata/NetFlow export to tools — not individually modelled yet)',
      '4x 10GBASE-T management ports (not modelled)',
    ],
  },
};

// Flat lookup kept for callers that only need the Mbps figure.
export const DEFAULT_TOOL_INGEST_LIMITS_MBPS: Record<string, number> = Object.fromEntries(
  Object.entries(TOOL_INGEST_PROFILES).map(([name, profile]) => [name, profile.ingestLimitMbps])
);

// Used for custom tools and any packet tool without a known vendor default.
export const GENERIC_PACKET_TOOL_INGEST_LIMIT_MBPS = 10000;

export const getDefaultIngestLimitMbps = (toolName?: string): number => {
  if (toolName && TOOL_INGEST_PROFILES[toolName] !== undefined) {
    return TOOL_INGEST_PROFILES[toolName].ingestLimitMbps;
  }
  return GENERIC_PACKET_TOOL_INGEST_LIMIT_MBPS;
};

export const getToolConnectivity = (toolName?: string): string[] => {
  return (toolName && TOOL_INGEST_PROFILES[toolName]?.connectivity) || [];
};

export const getToolApplianceModel = (toolName?: string): string | undefined => {
  return toolName ? TOOL_INGEST_PROFILES[toolName]?.applianceModel : undefined;
};
