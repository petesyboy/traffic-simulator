/**
 * gigaSmartDescriptions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Plain-English "what does this GigaSMART function actually do, and why is it
 * worth using" — for the PDF report's GigaSMART Processing section.
 *
 * Written in our own words from Gigamon's public GigaSMART data sheet (the
 * mechanism + benefit for each Traffic/Application/Security/Subscriber
 * Intelligence feature), not copied verbatim — mapped onto this app's
 * ACTION_TYPES constants, which don't always line up one-to-one with the data
 * sheet's feature names (e.g. the data sheet's single "Advanced Tunneling"
 * entry covers our separate *_ENCAP/*_DECAP action types).
 */
import { ACTION_TYPES } from '../../constants/nodeTypes';

export const GIGASMART_ACTION_DESCRIPTIONS: Record<string, string> = {
  [ACTION_TYPES.DEDUPLICATION]:
    'Removes duplicate copies of the same packet, using a configurable comparison window, that typically arise from overlapping SPAN/TAP sources feeding the same traffic in from more than one point. This offloads the deduplication workload from every downstream tool entirely — increasing their effective capacity and letting forensics/capture tools retain more genuine data for longer instead of burning storage on repeats.',

  [ACTION_TYPES.PACKET_SLICING]:
    'Removes packet payload from a configurable Layer 2, 3, or 4 reference point onward, keeping only the header data needed for protocol analysis. Tools receive far less traffic volume per packet while still seeing every packet — improving their throughput and effectiveness — and payload removal also helps satisfy compliance requirements that restrict retention of sensitive packet content.',

  [ACTION_TYPES.ADVANCED_FLOW_SLICING]:
    "Forwards a flow's initial packets in full, then drops or slices the remainder of that flow's packets once the useful protocol/session context has already been captured. This meaningfully reduces the volume tools must ingest for long-lived flows without materially impacting visibility, since most of what a tool needs to understand a session is present at its start.",

  [ACTION_TYPES.HEADER_STRIP]:
    'Removes heavy tagging and encapsulation headers — stacked VLAN tags, VN-Tag, MPLS, GRE, GTP, GENEVE, and other custom protocols — before forwarding. This lets any monitoring tool inspect the underlying traffic normally, without needing native support for whatever tunnelling or tagging scheme happens to be in use on that link.',

  [ACTION_TYPES.HEADER_TRAILER_REMOVE]:
    'Strips proprietary or vendor-specific header and trailer bytes (e.g. switch-specific tagging) that generic capture and analysis tools cannot parse, restoring a clean, standard frame. Functionally the same de-encapsulation capability as Header Stripping, applied to non-standard framing rather than a named tunnel protocol.',

  [ACTION_TYPES.MASKING]:
    'Dynamically identifies and overwrites specific packet content (e.g. PII, payment card data) in place, without removing the rest of the payload. This helps satisfy regulatory requirements such as HIPAA and GDPR by obscuring sensitive fields before traffic leaves the fabric, while still preserving full traffic for legitimate analysis.',

  [ACTION_TYPES.SOURCE_ID]:
    "Labels every packet with the identity of the ingress port it arrived on, before it's aggregated together with traffic from other sources onto a shared uplink. This preserves traffic-brokering flexibility — a downstream Map or tool can still identify and route traffic by its true origin even after aggregation has combined many links into one.",

  [ACTION_TYPES.LOAD_BALANCING_STATELESS]:
    'Distributes traffic across multiple links or tool instances on a per-packet basis — by hashing, bandwidth, cumulative traffic, packet rate, connections, or round robin, including balancing on L2–L4 criteria inside heavily tagged or tunnelled traffic. This spreads load evenly (with custom per-tool weighting) so no single instance is overwhelmed, though it does not guarantee every packet of one session lands on the same instance.',

  [ACTION_TYPES.LOAD_BALANCING_STATEFUL]:
    'Distributes traffic across multiple links or tool instances using the same set of balancing methods as stateless load balancing, but keeps every packet belonging to one session on the same destination instance throughout. This spreads load exactly like the stateless variant while preserving the session continuity tools that reassemble or track conversations depend on.',

  [ACTION_TYPES.ADAPTIVE_PACKET_FILTERING]:
    'Filters and/or masks packets using pattern matching, including L2–L4 rules that can see inside heavily tagged or tunnelled traffic (stacked VLANs, VN-Tag, MPLS, GRE, GTP). This extends visibility into tunnelled application flows, supports compliance by obscuring sensitive data in place, and cuts tool load by forwarding traffic based on what is actually inside the packet rather than just its outer headers.',

  [ACTION_TYPES.APP_VIS]:
    'Identifies the real application generating each flow — drawing on signatures for over 4,000 known applications plus custom-defined signatures for anything unrecognised — rather than inferring it from port number alone. This surfaces top application usage by category (including unsanctioned shadow-IT traffic such as unauthorised AI, P2P, or gaming apps) and lets downstream Maps make genuinely application-aware forwarding decisions.',

  [ACTION_TYPES.APPLICATION_FILTERING_INTELLIGENCE]:
    'Filters traffic by recognised application name, application family, or application tag — including custom applications and advanced refinement rules, with the option to slice matched flows. This improves the signal-to-noise ratio reaching a tool by forwarding only traffic from the applications that actually matter to it, cutting both tool load and packet-forensics storage costs.',

  [ACTION_TYPES.APPLICATION_SESSION_FILTERING]:
    'Filters at the whole-session level using the same application-identity engine as Application Filtering Intelligence, forwarding entire matching sessions rather than filtering packet-by-packet. This keeps session context intact for tools that need it, while still discarding everything that falls outside the applications of interest.',

  [ACTION_TYPES.APP_METADATA]:
    'Extracts close to 6,000 application-layer metadata elements — including application family and tag context — instead of forwarding full packet payloads, exporting them in standard NetFlow v5/v9, IPFIX, or CEF formats. Tools can then monitor protocol and application attributes instead of raw packets, cutting SIEM/observability ingest volume dramatically while enriching logs with network-derived context that shortens investigation time.',

  [ACTION_TYPES.AMI]:
    'Generates the same rich Application Metadata Intelligence as standard metadata export — up to ~6,000 elements including application family and tag context — structured for direct ingestion by SIEM and analytics platforms, entirely without needing full packet capture at all.',

  [ACTION_TYPES.AMX]:
    'Transforms and exports application metadata — including correlated 5G mobility control-plane and user-plane metadata, and re-exported third-party NetFlow/IPFIX — in JSON or Parquet (OCSF) format over HTTPS or Kafka. This feeds cloud-native tools and data lakes for network, security, and compliance monitoring, and can further enrich VM/Kubernetes metadata with business context or Zscaler Private Access logs for zero-trust policy monitoring.',

  [ACTION_TYPES.NETFLOW_TRAFFIC]:
    'Generates full, unsampled NetFlow v5/v9, IPFIX, or CEF flow records directly from L2–L4 traffic (with extended IPFIX elements for DNS, TLS/SSL, and HTTP), exporting to up to six collectors at once. This offloads flow-record generation from routers and switches entirely — protecting their core forwarding performance — while giving analytics/forensics tools complete rather than sampled flow visibility.',

  [ACTION_TYPES.NETFLOW_APP]:
    'Generates the same NetFlow/IPFIX/CEF flow records as standard NetFlow generation, but enriched with application identity rather than just L2–L4 fields. This gives flow-analytics platforms application-aware visibility while still fully offloading flow-record generation from routers and switches.',

  [ACTION_TYPES.SSL_DECRYPT]:
    "Identifies, decrypts, and delivers TLS/SSL traffic from a single, central point out to every subscribed tool as cleartext — so encryption no longer blinds security and monitoring tools that would otherwise see nothing useful. This is what actually makes threat detection, data-exfiltration prevention, fraud detection, and regulatory-compliance inspection possible against traffic that's encrypted in transit, which today is most of it.",

  [ACTION_TYPES.SSL_DECRYPT_INLINE]:
    'Decrypts TLS/SSL traffic inline, in the live traffic path, so an inline security tool can inspect and act on cleartext traffic in real time before it is re-encrypted and forwarded on. This extends the same threat-detection and compliance visibility as out-of-band decryption to enforcement points that sit directly in the traffic path.',

  [ACTION_TYPES.CLOUD_5G]:
    'Correlates 5G control-plane and user-plane sessions together across 5G standalone and 4G/5G converged core networks (5G Control and User Plane Separation). This gives monitoring tools granular, subscriber-aware visibility into mobile infrastructure, and — combined with targeted filtering or sampling — significantly reduces the volume of mobile-core traffic reaching tools while broadening security coverage.',

  [ACTION_TYPES.SBI_5G]:
    'Processes 5G Service-Based Interface signalling traffic exchanged between core network functions, extracting the session detail needed for 5G-aware monitoring tools as part of the same control/user-plane correlation used for 5G Correlation.',

  [ACTION_TYPES.SBIPOE]:
    'Processes 5G Service-Based Interface signalling carried over the Packets-over-Ethernet transport used in some core deployments, preserving the same 5G session correlation and visibility for downstream monitoring tools.',

  [ACTION_TYPES.GTP_FLOW_FILTERING]:
    "Coherently filters GTP mobile tunnel traffic down to the subscriber sessions that actually matter for a given tool, while keeping each subscriber's control-plane and user-plane traffic together (GTP Correlation). This ensures every monitoring tool sees a complete, consistent session for a given user or domain rather than a partial view.",

  [ACTION_TYPES.GTP_ROTATIONAL_SAMPLING]:
    'Samples GTP subscriber sessions on a rotating basis while preserving GTP Correlation (control- and user-plane session pairing), giving tools broad coverage across the whole subscriber population over time without needing to ingest every session concurrently.',

  [ACTION_TYPES.GTP_WHITELISTING]:
    "Forwards only GTP traffic matching an approved subscriber/IMSI whitelist, again keeping each subscriber's control- and user-plane sessions correlated together, so monitoring tools see complete sessions for just the subscribers relevant to a specific investigation or policy.",

  [ACTION_TYPES.GTP_FLOW_SAMPLING]:
    'Forwards a configurable percentage of GTP flows rather than the full subscriber population, preserving GTP Correlation so each sampled session stays complete. This reduces tool load while retaining statistically representative mobile traffic coverage.',

  [ACTION_TYPES.IP_FLOWVUE]:
    "Statefully samples user sessions by IP address — and, combined with GTP Correlation, by subscriber ID (IMSI/SUPI), device ID (IMEI/PEI), RAN ID, or network slice — allocating separate samples per tool or tool group from one common correlated pool (FlowVUE). This achieves meaningful network monitoring without needing to monitor every single user's session, selectively reducing the traffic reaching analytic tools.",

  [ACTION_TYPES.SIP_FLOW_SAMPLING]:
    'Samples SIP (VoIP signalling) flows rather than forwarding every call session, reducing tool load while retaining representative visibility into voice traffic patterns and volumes.',

  [ACTION_TYPES.SIP_FLOW_WHITELIST]:
    "Forwards only SIP traffic matching an approved whitelist (e.g. specific endpoints or trunks), narrowing voice-monitoring traffic down to what's actually relevant to the investigation or policy at hand.",

  [ACTION_TYPES.UPN_MONITORING]:
    'Extracts 4G/5G User Plane Node traffic for monitoring, giving mobile-network tools visibility into subscriber data-plane traffic without requiring direct access to the mobile core itself.',

  [ACTION_TYPES.L2GRE_ENCAP]:
    'Initiates an L2GRE tunnel to a remote IP destination as part of Advanced Tunneling, carrying traffic across a routed network to a remote tool while preserving the original Layer 2 framing, and fragmenting/reassembling jumbo frames as needed to respect the network MTU.',

  [ACTION_TYPES.VXLAN_ENCAP]:
    'Initiates a VXLAN tunnel to a remote IP destination as part of Advanced Tunneling, forwarding traffic across Layer 3 infrastructure to a remote tool while preserving the original frame inside, with the same jumbo-frame fragmentation/reassembly handling as the other tunnel-initiation options.',

  [ACTION_TYPES.L2GRE_DECAP]:
    'Terminates an incoming L2GRE tunnel as part of Advanced Tunneling, exposing the original packet to on-premises tools that cannot parse tunnelled traffic themselves — letting multiple local tools monitor remote or virtualized traffic that would otherwise only be visible at its source.',

  [ACTION_TYPES.VXLAN_DECAP]:
    'Terminates an incoming VXLAN tunnel as part of Advanced Tunneling, exposing the original inner packet so tools see the real source/destination traffic instead of the overlay wrapper — enabling local tools to monitor remote or virtualized traffic reliably.',

  [ACTION_TYPES.ERSPAN_DECAP]:
    'Terminates an ERSPAN remote-spanning tunnel from a switch mirror as part of Advanced Tunneling, restoring the original packet so it can be filtered and forwarded exactly like locally-tapped traffic — letting on-premises tools monitor traffic mirrored in from anywhere on the network.',

  [ACTION_TYPES.GRE_IN_UDP_DECAP]:
    'Terminates an incoming GRE-in-UDP tunnel as part of Advanced Tunneling, exposing the original packet to tools that expect untunnelled traffic, with the same reliable-delivery handling as the other tunnel-termination options.',

  [ACTION_TYPES.TCP_TUNNEL]:
    'Carries mirrored traffic to a remote tool over a reliable TCP tunnel as part of Advanced Tunneling, ensuring intact delivery when the path to the tool crosses infrastructure that would otherwise drop or reorder a raw mirrored stream.',

  [ACTION_TYPES.SECURE_TUNNELS]:
    'Carries mirrored traffic to a remote tool over an encrypted tunnel as part of Advanced Tunneling, protecting potentially sensitive monitored traffic in transit across untrusted or shared infrastructure between Gigamon fabric points.',

  [ACTION_TYPES.GVHTTP2]:
    'Decodes HTTP/2 traffic, including multiplexed request/response streams over a single connection, so tools built around HTTP/1-style request/response parsing can still analyse modern web and API application traffic correctly.',

  [ACTION_TYPES.PCAPNG]:
    'Packages captured traffic into PCAPNG format with enriched, structured metadata attached to each packet, suited to forensic tools that expect richly-annotated capture files rather than a bare raw packet stream.',

  [ACTION_TYPES.HEADER_ADDITION]:
    'Inserts custom header fields (e.g. site or link identifiers) into forwarded packets, giving downstream tools extra origin context carried in-band with the traffic itself rather than needing a separate metadata channel.',

  [ACTION_TYPES.TUNNELING]:
    'Terminates and decapsulates incoming ERSPAN (Type II and Type III), L2GRE, and VXLAN tunnels at wire speed, stripping outer encapsulation headers to expose the genuine payload packets. This enables local monitoring and security tools to inspect remote or virtualised traffic feeds that were forwarded across Layer 3 network infrastructure.',

  'Tunneling':
    'Terminates and decapsulates incoming ERSPAN (Type II and Type III), L2GRE, and VXLAN tunnels at wire speed, stripping outer encapsulation headers to expose the genuine payload packets. This enables local monitoring and security tools to inspect remote or virtualised traffic feeds that were forwarded across Layer 3 network infrastructure.',

  'GTP Correlation':
    "Correlates GTP-C signalling with GTP-U user tunnels, statefully tracking mobile subscriber sessions across tool ports. This ensures every monitoring tool sees complete, consistent subscriber sessions rather than partial views.",

  'GTP-C / GTP-U Correlation':
    "Correlates GTP-C signalling with GTP-U user tunnels, statefully tracking mobile subscriber sessions across tool ports. This ensures every monitoring tool sees complete, consistent subscriber sessions rather than partial views.",
};

/** Fallback for any action type not yet catalogued above. */
export function describeGigaSmartFunction(actionType: string | undefined): string {
  if (!actionType) return 'Applies GigaSMART processing to optimise, protect, or scale downstream monitoring tools.';
  if (GIGASMART_ACTION_DESCRIPTIONS[actionType]) {
    return GIGASMART_ACTION_DESCRIPTIONS[actionType];
  }
  if (actionType.toLowerCase().includes('gtp')) {
    return GIGASMART_ACTION_DESCRIPTIONS[ACTION_TYPES.GTP_FLOW_FILTERING];
  }
  return `Applies the "${actionType}" GigaSMART function to optimise, protect, or scale downstream monitoring tools.`;
}
