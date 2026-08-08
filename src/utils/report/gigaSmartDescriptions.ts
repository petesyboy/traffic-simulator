/**
 * gigaSmartDescriptions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Plain-English "what does this GigaSMART function actually do, and how does
 * it protect downstream tools from being overwhelmed" — one sentence per
 * ACTION_TYPES entry, for the PDF report's GigaSMART Processing section.
 */
import { ACTION_TYPES } from '../../constants/nodeTypes';

export const GIGASMART_ACTION_DESCRIPTIONS: Record<string, string> = {
  [ACTION_TYPES.DEDUPLICATION]:
    'Identifies and removes duplicate copies of the same packet that arise from overlapping SPAN/TAP sources, so tools only see each packet once instead of processing (and paying to ingest) the same traffic multiple times.',
  [ACTION_TYPES.PACKET_SLICING]:
    'Truncates each packet after a configurable byte count, keeping the headers needed for protocol analysis while discarding payload — cutting the volume tools must ingest without losing visibility into who talked to whom.',
  [ACTION_TYPES.HEADER_STRIP]:
    'Removes outer tunnel/encapsulation headers (e.g. VXLAN, GRE) before forwarding, so tools that cannot parse encapsulated traffic can inspect the inner packet directly.',
  [ACTION_TYPES.SSL_DECRYPT]:
    'Decrypts SSL/TLS traffic once, centrally, and forwards cleartext to every subscribed tool — removing the need for each tool to hold its own keys or pay its own decryption overhead, and eliminating traffic that would otherwise be invisible to inspection.',
  [ACTION_TYPES.SSL_DECRYPT_INLINE]:
    'Decrypts SSL/TLS traffic inline (in the live path) so inline security tools can inspect and act on cleartext traffic in real time, then re-encrypts before forwarding it on.',
  [ACTION_TYPES.APP_METADATA]:
    'Extracts application-layer metadata (who, what, where, how) from packets instead of forwarding full payloads — giving analytics/SIEM tools rich session context at a fraction of the bandwidth and storage cost of raw packets.',
  [ACTION_TYPES.APP_VIS]:
    'Identifies the actual application generating each flow (beyond port/protocol) so downstream tools and traffic maps can make application-aware forwarding decisions.',
  [ACTION_TYPES.AMX]:
    'Generates extended application metadata records, a superset of standard metadata used by tools that need deeper session/application detail than basic flow data provides.',
  [ACTION_TYPES.AMI]:
    'Generates Application Metadata Intelligence records — structured, application-aware metadata designed for direct ingestion by SIEM/analytics platforms without needing raw packet capture.',
  [ACTION_TYPES.MASKING]:
    'Obscures or redacts sensitive fields (e.g. PII, card numbers) within packets before they reach a tool, supporting compliance requirements while still preserving traffic for analysis.',
  [ACTION_TYPES.PCAPNG]:
    'Packages captured traffic into PCAPNG format with enriched metadata, suited to forensic tools that expect richly-annotated capture files rather than raw packet streams.',
  [ACTION_TYPES.CLOUD_5G]:
    'Applies 5G Control and User Plane Separation (CUPS)-aware processing so mobile-core traffic can be filtered and forwarded correctly across split control/user plane paths.',
  [ACTION_TYPES.SBI_5G]:
    'Processes 5G Service-Based Interface (SBI) traffic between core network functions, extracting the signalling detail needed for 5G-aware monitoring tools.',
  [ACTION_TYPES.SBIPOE]:
    'Processes SBI traffic over the Packets-over-Ethernet transport used in some 5G core deployments, preserving signalling visibility for downstream 5G monitoring tools.',
  [ACTION_TYPES.GVHTTP2]:
    'Decodes HTTP/2 traffic (including multiplexed streams) so tools that only understand HTTP/1-style requests can still analyse modern application traffic.',
  [ACTION_TYPES.ADVANCED_FLOW_SLICING]:
    'Applies protocol-aware slicing that trims payload while respecting flow/session boundaries, keeping more of the analytically useful header content than fixed-byte slicing alone.',
  [ACTION_TYPES.SOURCE_ID]:
    'Tags each packet with an identifier for the physical/logical link it originated from, letting downstream tools distinguish traffic from different network segments even after it has been aggregated onto a shared path.',
  [ACTION_TYPES.HEADER_TRAILER_REMOVE]:
    'Strips proprietary or vendor-specific header/trailer bytes (e.g. switch tagging) that some capture/analysis tools cannot parse, restoring a standard frame format.',
  [ACTION_TYPES.L2GRE_ENCAP]:
    'Encapsulates traffic in an L2GRE tunnel so it can be carried across a routed network to a remote tool without losing its original Layer 2 framing.',
  [ACTION_TYPES.VXLAN_ENCAP]:
    'Encapsulates traffic in a VXLAN tunnel, allowing it to be forwarded across Layer 3 infrastructure to a remote tool while preserving the original frame inside.',
  [ACTION_TYPES.L2GRE_DECAP]:
    'Removes an L2GRE tunnel header from incoming traffic, exposing the original packet to downstream tools that cannot parse tunnelled traffic themselves.',
  [ACTION_TYPES.VXLAN_DECAP]:
    'Removes a VXLAN tunnel header from incoming traffic, exposing the original inner packet so tools see the real source/destination traffic instead of the overlay wrapper.',
  [ACTION_TYPES.ERSPAN_DECAP]:
    'Removes the ERSPAN encapsulation added by a remote switch mirror, restoring the original packet so it can be filtered and forwarded like any locally-tapped traffic.',
  [ACTION_TYPES.GRE_IN_UDP_DECAP]:
    'Removes a GRE-in-UDP tunnel wrapper from incoming traffic, exposing the original packet to tools that expect untunnelled traffic.',
  [ACTION_TYPES.HEADER_ADDITION]:
    'Inserts custom header fields (e.g. site or link tags) into forwarded packets, giving downstream tools extra context about where traffic originated without needing a separate metadata channel.',
  [ACTION_TYPES.IP_FLOWVUE]:
    'Selects a representative sample of flows by IP-based criteria rather than forwarding every flow, cutting ingest volume for tools that only need statistically representative coverage.',
  [ACTION_TYPES.GTP_FLOW_FILTERING]:
    'Filters mobile GTP tunnel traffic down to the subscriber flows that actually matter for a given tool, discarding tunnel overhead and irrelevant sessions before forwarding.',
  [ACTION_TYPES.GTP_ROTATIONAL_SAMPLING]:
    'Samples GTP subscriber sessions on a rotating basis, giving tools broad visibility across the whole subscriber population over time without needing to ingest every session concurrently.',
  [ACTION_TYPES.GTP_WHITELISTING]:
    'Forwards only GTP traffic matching an approved subscriber/IMSI whitelist, so monitoring tools see just the sessions relevant to a specific investigation or policy.',
  [ACTION_TYPES.GTP_FLOW_SAMPLING]:
    'Forwards a configurable percentage of GTP flows rather than the full subscriber population, reducing tool load while retaining statistically useful mobile traffic coverage.',
  [ACTION_TYPES.ADAPTIVE_PACKET_FILTERING]:
    'Dynamically adjusts what traffic is forwarded based on live conditions (e.g. backing off during traffic bursts), protecting downstream tools from being overwhelmed during spikes.',
  [ACTION_TYPES.APPLICATION_SESSION_FILTERING]:
    'Filters traffic at the application-session level, forwarding only sessions matching defined application criteria instead of every packet on the wire.',
  [ACTION_TYPES.APPLICATION_FILTERING_INTELLIGENCE]:
    "Uses deep application recognition to selectively forward or drop traffic by application identity, letting a tool receive only the application traffic it's licensed or built to analyse.",
  [ACTION_TYPES.NETFLOW_APP]:
    'Generates NetFlow-style flow records enriched with application identity, giving flow-analytics tools application-aware visibility without full packet capture.',
  [ACTION_TYPES.NETFLOW_TRAFFIC]:
    'Generates standard NetFlow traffic records summarising who talked to whom and how much data moved, at a fraction of the bandwidth of forwarding raw packets.',
  [ACTION_TYPES.LOAD_BALANCING_STATELESS]:
    'Distributes traffic across multiple links or tool instances on a per-packet basis, spreading load evenly so no single tool instance is overwhelmed — at the cost of not guaranteeing all packets from one session land on the same instance.',
  [ACTION_TYPES.LOAD_BALANCING_STATEFUL]:
    'Distributes traffic across multiple links or tool instances while keeping every packet from the same session on one instance, spreading load without breaking session-aware analysis.',
  [ACTION_TYPES.SIP_FLOW_SAMPLING]:
    'Samples SIP (VoIP signalling) flows rather than forwarding every call session, reducing tool load while retaining representative visibility into voice traffic.',
  [ACTION_TYPES.SIP_FLOW_WHITELIST]:
    "Forwards only SIP traffic matching an approved whitelist (e.g. specific endpoints or trunks), narrowing voice-monitoring traffic to what's actually relevant.",
  [ACTION_TYPES.UPN_MONITORING]:
    'Extracts 4G/5G User Plane Node traffic for monitoring, giving mobile-network tools visibility into subscriber data-plane traffic without needing full core access.',
  [ACTION_TYPES.TCP_TUNNEL]:
    'Carries mirrored traffic to a remote tool over a reliable TCP tunnel, useful when the path to the tool crosses infrastructure that would otherwise drop or reorder a raw mirrored stream.',
  [ACTION_TYPES.SECURE_TUNNELS]:
    'Carries mirrored traffic to a remote tool over an encrypted tunnel, protecting potentially sensitive monitored traffic in transit across untrusted or shared infrastructure.',
};

/** Fallback for any action type not yet catalogued above. */
export function describeGigaSmartFunction(actionType: string | undefined): string {
  if (!actionType) return 'Applies GigaSMART processing to optimise, protect, or scale downstream monitoring tools.';
  return (
    GIGASMART_ACTION_DESCRIPTIONS[actionType] ||
    `Applies the "${actionType}" GigaSMART function to optimise, protect, or scale downstream monitoring tools.`
  );
}
