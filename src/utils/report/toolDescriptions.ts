/**
 * toolDescriptions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Plain-English "what is this tool for" and "what happens if it's overwhelmed"
 * text for the PDF report's Destinations & Tools section, keyed by the exact
 * `toolName` strings used in the sidebar's built-in catalogue (Sidebar.tsx).
 */
import { formatBandwidth } from '../format';
import { getDefaultIngestLimitMbps, getToolApplianceModel } from '../../constants/toolIngestLimits';

export const TOOL_PURPOSE_DESCRIPTIONS: Record<string, string> = {
  ExtraHop:
    'A network detection and response (NDR) platform that analyses wire data in real time to detect threats and performance issues without relying on agents.',
  Corelight:
    'An NDR sensor built on open-source Zeek/Suricata that turns raw traffic into structured, high-fidelity logs for threat hunting and incident response.',
  Vectra:
    'An AI-driven NDR platform that detects attacker behaviour (command-and-control, lateral movement, exfiltration) across cloud, identity, and network traffic.',
  Trellix:
    'A network security platform combining intrusion prevention and advanced threat detection to identify and block malicious traffic in real time.',
  'Cisco Secure Network Analytics':
    'A network detection and response platform that uses flow and behavioural analytics to detect threats and policy violations across the network.',
  'Arista NDR':
    'An AI-based network detection and response platform that builds a behavioural model of every device to surface anomalous or malicious activity.',
  FortiNDR:
    "A network detection and response appliance that uses AI to identify malicious files and traffic patterns across an organisation's network.",
  NetWitness:
    'A full packet capture and analytics platform for deep forensic investigation, threat detection, and incident response.',
  'Trend Micro':
    'A network-based advanced threat detection appliance (Deep Discovery Inspector) that identifies malware, exploits, and attacker communications.',
  Darktrace:
    "An AI-based cyber defence platform that learns an organisation's normal behaviour and autonomously detects and responds to anomalies.",
  'Endace Packet Capture Appliance':
    'A dedicated, high-speed full packet capture appliance that records network traffic for later forensic replay and investigation.',
  Wireshark:
    'An open-source packet analyser used for interactive, manual inspection of individual packets and protocol conversations.',
  ForeScout:
    'A network access control and device visibility platform that identifies and profiles every device connecting to the network.',
  Nozomi:
    'An OT/ICS security platform that monitors industrial control system and IoT traffic for asset visibility and threat detection.',
  Splunk:
    'A SIEM and log analytics platform that indexes machine data (including network metadata) for search, correlation, and security investigation.',
  Elastic:
    'A search and analytics platform (the Elastic Stack) commonly used for log aggregation, observability, and security analytics (SIEM).',
  Dynatrace:
    'An application and infrastructure observability platform that correlates network, application, and user-experience data for performance monitoring.',
  'Microsoft Sentinel':
    'A cloud-native SIEM and SOAR platform that aggregates security data for detection, investigation, and automated response.',
  'S3 Object Storage':
    "Cost-effective, long-term object storage for archived traffic or metadata, enabling federated search without keeping every tool's local retention window open indefinitely.",
};

const GENERIC_TOOL_PURPOSE =
  'Monitors and analyses the traffic it receives to detect threats, measure performance, or support investigations.';

export function describeToolPurpose(toolName: string | undefined): string {
  if (!toolName) return GENERIC_TOOL_PURPOSE;
  return TOOL_PURPOSE_DESCRIPTIONS[toolName] || GENERIC_TOOL_PURPOSE;
}

/**
 * "What happens if too much traffic reaches this tool" — grounded in the
 * node's own configured ingest limit if set, else the catalogue default from
 * toolIngestLimits.ts, else a soft generic line for tools with no modelled
 * ingest profile (metadata/objects tools) rather than inventing a number.
 */
export function describeToolOverloadRisk(toolName: string | undefined, nodeIngestLimitMbps?: number): string {
  const applianceModel = getToolApplianceModel(toolName);
  const limitMbps = nodeIngestLimitMbps || (applianceModel ? getDefaultIngestLimitMbps(toolName) : undefined);

  if (limitMbps) {
    const modelClause = applianceModel ? ` (modelled here as a ${applianceModel})` : '';
    return `Rated for up to ${formatBandwidth(limitMbps)}${modelClause} — sustained traffic beyond this typically causes dropped packets, an analysis backlog, or missed detections.`;
  }

  return 'If sent more traffic than it can process, this tool typically falls behind — queuing or discarding data, delaying analysis, or increasing storage/ingest cost — rather than analysing everything in real time.';
}
