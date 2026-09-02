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
    version: "1.0.729",
    date: "2026-09-02",
    summary: "Fixed Export Diagram Ready Mode vertical node clearance and chassis SPAN termination descriptions: automatically expanded vertical column spacing to prevent lower nodes from obscuring upper description boxes, distinguished SPAN sessions (1 feed per session) from physical TAP links in chassis termination text, and resolved precise fitted optic SKUs (e.g. Q28-502T) rather than falling back to default TAP optics.",
  },
  {
    version: "1.0.728",
    date: "2026-09-02",
    summary: "Enhanced report site diagram isolation with DWDM transport ring inclusion and added SPAN speed/fibre type descriptors in Export Diagram Ready Mode: each per-site report diagram now captures the isolated local data centre plus its connected DWDM ring, and SPAN nodes display configured port speed and fibre media specifications.",
  },
  {
    version: "1.0.727",
    date: "2026-09-02",
    summary: "Expanded canvas viewport zoom limits down to 2% (minZoom: 0.02) and enabled auto-fitting for large multi-site architectures: eliminated the 50% zoom restriction, added a live zoom readout and one-click Fit View control, and compacted inter-site vertical spacing.",
  },
  {
    version: "1.0.726",
    date: "2026-09-02",
    summary: "Implemented central WAN hub layout for DWDM transport networks with reserved inter-site gutters, directional 8-way handle optimisation, cycle-safe peer column ranking, and interactive data centre DWDM ring membership indicators.",
  },
  {
    version: "1.0.725",
    date: "2026-09-02",
    summary: "Refined report traffic source terminology: dynamically adapted topology diagrams, schematics, and work orders to specify 'SPAN allocations', 'TAP allocations', or 'TAP/SPAN allocations' based on actual deployed sources rather than hardcoding TAP references.",
  },
  {
    version: "1.0.724",
    date: "2026-09-02",
    summary: "Implemented site-aware tidy layout and visual data centre enclosures: clustered equipment by physical site into dedicated swimlanes with clean inter-site routing, preventing cross-site column mixing and rendering interactive glassmorphic data centre boundaries.",
  },
  {
    version: "1.0.723",
    date: "2026-09-02",
    summary: "Audited physical cage rules across all TA and HC chassis, extension modules, breakout panels, and TAP trays: normalized model and SKU lookups, added SMT-HC3-C08Q08/SMT-HC3-C16 to optic rules, and built comprehensive 69-test hardware matrix audit suite.",
  },
  {
    version: "1.0.722",
    date: "2026-09-02",
    summary: "Added DWDM Optical Transport Network node: models multi-site WAN and inter-DC interconnects over redundant 100 Gbps, 25 Gbps, and 400 Gbps optical wavelengths using optical lambda iconography.",
  },
  {
    version: "1.0.721",
    date: "2026-09-02",
    summary: "Fixed chassis and module lookup normalization: corrected cage capacity calculation on modular HC-series chassis (e.g. GigaVUE-HC1-Plus with PRT-HC1-Q04X08) allowing all 8 QSFP cages to be fully populated with 100G optics.",
  },
  {
    version: "1.0.720",
    date: "2026-09-02",
    summary: "Enforced cage-type validation during port link preservation: discarded stale QSFP assignments on SFP feeds, dynamically synchronized transceivers for collapsed TAP clusters, and auto-provisioned matching optics across connected links.",
  },
  {
    version: "1.0.719",
    date: "2026-09-02",
    summary: "Constrained TAP cluster port allocation to matching cage families (SFP vs QSFP): prevented 10G SFP TAP links from falling through to unpopulated QSFP cages (1/1/c1..c8) on hybrid chassis like GigaVUE-TA25E, eliminating false 'missing transceiver' and port shortfall errors.",
  },
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
];
