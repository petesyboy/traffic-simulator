/**
 * toolIngestLimits.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Default ingest-rate ceilings (in Mbps, matching the rest of the simulator's
 * bandwidth units) for well-known packet-consuming tools.
 *
 * These are illustrative, top-of-range figures published by each vendor for
 * their largest single sensor/appliance model — real-world limits vary by
 * specific model, licence tier and deployment. They exist purely to seed a
 * sensible starting point; the value is always editable per node in the
 * config panel and has no effect on licensing or the BOM.
 */
export const DEFAULT_TOOL_INGEST_LIMITS_MBPS: Record<string, number> = {
  'ExtraHop': 100000,                                 // EDA 9200/10200 series — up to 100 Gbps aggregate
  'Vectra': 10000,                                     // Vectra AI Detect sensors — up to 10 Gbps
  'Darktrace': 10000,                                  // Enterprise Immune System probe/vSensor — up to 10 Gbps
  'Corelight': 100000,                                 // Corelight Enterprise/Fleet sensors — up to 100 Gbps
  'Endace Packet Capture Appliance': 100000,           // EndaceProbe — up to 100 Gbps line-rate capture
  'Wireshark': 1000,                                   // Host NIC-limited capture, not an appliance
  'ForeScout': 1000,                                   // eyeSight monitoring via SPAN/TAP — typically 1 Gbps
  'Nozomi': 1000,                                      // Guardian sensors, entry/mid-tier — around 1 Gbps
};

// Used for custom tools and any packet tool without a known vendor default.
export const GENERIC_PACKET_TOOL_INGEST_LIMIT_MBPS = 10000;

export const getDefaultIngestLimitMbps = (toolName?: string): number => {
  if (toolName && DEFAULT_TOOL_INGEST_LIMITS_MBPS[toolName] !== undefined) {
    return DEFAULT_TOOL_INGEST_LIMITS_MBPS[toolName];
  }
  return GENERIC_PACKET_TOOL_INGEST_LIMIT_MBPS;
};
