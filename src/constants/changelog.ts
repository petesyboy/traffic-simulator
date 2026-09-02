/**
 * changelog.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GENERATED FILE - do not edit by hand. Regenerated from git history by
 * `scripts/generate-changelog.mjs`, which runs automatically before every build.
 *
 * To change an entry's wording, or to describe work that isn't committed yet,
 * edit `scripts/changelog.manual.json` instead.
 */

export interface ChangelogEntry {
  version: string;
  date: string;
  summary: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.718",
    date: "2026-09-02",
    summary: "Fixed TAP cluster port and optic overcounting: corrected validation and port allocation for multi-member TAP stacks connected across single or multiple chassis, eliminating false 'insufficient optics' (384 optics demanded) and 'out of physical ports' errors.",
  },
  {
    version: "1.0.717",
    date: "2026-09-02",
    summary: "Ingested Worldwide Price List (WWPL Sept 2026) updates: clarified CCv1/CCv2 compatibility across HC3 bypass and port modules, updated EOS/EOL dates and replacement SKU mappings for QSB-504, IBP-TAC40, GTP-ATX02, GTP-ASF02, and G-TAP M Series modules.",
  },
  {
    version: "1.0.716",
    date: "2026-09-01",
    summary: "Paired standalone VMware and virtual cloud source estates with their connected aggregation chassis in site architecture sub-diagrams, ensuring full feed context is illustrated rather than orphaned nodes.",
  },
  {
    version: "1.0.715",
    date: "2026-09-01",
    summary: "Isolated site topology capture in state store: strictly filtered active canvas nodes and links during site sub-diagram captures to eliminate stray links, foreign TAPs, and external interconnects.",
  },
  {
    version: "1.0.714",
    date: "2026-09-01",
    summary: "Fixed site diagram screenshot framing and multi-site layout capture: eliminated cross-site TAP auto-bundling and adjusted viewport padding and zoom for balanced, centered site sub-diagrams.",
  },
  {
    version: "1.0.713",
    date: "2026-09-01",
    summary: "Updated packet-consuming tools catalogue: replaced FortiNDR, Arista NDR, NetWitness, and Trend Micro with Armis (2 Gbps sensor profile) beneath Nozomi, including full appliance profiling and PDF report purpose descriptions.",
  },
  {
    version: "1.0.712",
    date: "2026-09-01",
    summary: "Omitted unfinished Uplink report from active Report Generator modal and 'Dump All to Folder' solution deliverables package, focusing exports on Signal Path, Patch Sheet, and Crossover formats.",
  },
  {
    version: "1.0.711",
    date: "2026-09-01",
    summary: "Fleshed out advanced Systems Engineer Reference Guide (README_advanced.md) with comprehensive source traffic modelling, optical TAP architectures, double-optic rules, multi-link trunks, and BOM diagnostics.",
  },
  {
    version: "1.0.710",
    date: "2026-09-01",
    summary: "Integrated native File System Access API choosers for PDF reports, formal quotes, and diagram exports, streaming files directly to user-selected folders.",
  },
  {
    version: "1.0.709",
    date: "2026-09-01",
    summary: "Added Australia & New Zealand (AU/ANZ) deployment region support with automatic PCD-00007 / PCD-00A27 power cord mapping for TAPs and chassis.",
  },
  {
    version: "1.0.708",
    date: "2026-09-01",
    summary: "Streamlined GigaSMART traffic map auto-insertion when dropping traffic maps onto existing tool links.",
  },
  {
    version: "1.0.707",
    date: "2026-09-01",
    summary: "Added Multi-Edition build pipelines (Internal vs Partner), GigaSMART reduction metrics, tool cluster load balancing, and dynamic site input improvements.",
  },
  {
    version: "1.0.700",
    date: "2026-08-30",
    summary: "Added link utilisation level selector for traffic generation.",
  },
  {
    version: "1.0.699",
    date: "2026-08-30",
    summary: "Preserved traffic flow through collapsed TAP clusters in simulation engine.",
  },
  {
    version: "1.0.698",
    date: "2026-08-30",
    summary: "Added resizable columns and optimized table space in Live Traffic Injector.",
  },
  {
    version: "1.0.697",
    date: "2026-08-30",
    summary: "Added automated flow generation with telco and mobile profile biasing.",
  },
  {
    version: "1.0.696",
    date: "2026-08-29",
    summary: "Showed sequential multi-link ranges (e.g. Links 1 to 6, 7 to 12) for TAP stack links.",
  },
  {
    version: "1.0.695",
    date: "2026-08-29",
    summary: "Resolved TAP cluster member optics accurately on chassis connections.",
  },
  {
    version: "1.0.694",
    date: "2026-08-28",
    summary: "Expanded vertical and horizontal node spacing with auto-fitView in Export Diagram Mode.",
  },
  {
    version: "1.0.693",
    date: "2026-08-28",
    summary: "Auto-collapsed >4 TAPs and Tools into stacks during diagram and report screenshots.",
  },
];
