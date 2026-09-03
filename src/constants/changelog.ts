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
    version: "1.0.734",
    date: "2026-09-03",
    summary: "Tidy Layout now understands mirrored nodes, and the configuration panel works on a whole selection. Laying out a right-to-left node used to put it in its usual left-to-right column, so every link into it doubled back; a mirrored chain is now laid out with its sources on the right and its tools on the left, the order its handles actually point in. Mirroring one node pulls the neighbours it feeds the same way round, so the picture stays consistent, and locking a node left-to-right pins the boundary. Selecting several nodes now opens a panel showing what is selected and lets you set the flow direction for all of them at once.",
  },
  {
    version: "1.0.733",
    date: "2026-09-03",
    summary: "Added a flow direction control for the whole selection: hold Ctrl (or Shift-drag a box) to pick several nodes, then set them all left-to-right, right-to-left or Auto in one click from the canvas toolbar. The control shows how many nodes it will change, and highlights a direction only when the whole selection already agrees, so a mixed selection is obvious at a glance.",
  },
  {
    version: "1.0.732",
    date: "2026-09-02",
    summary: "Fixed mirrored nodes so their links actually follow the handles: flipping a node between left-to-right and right-to-left now forces ReactFlow to re-measure that node, so every connected link re-routes to the new side instead of continuing to point at where the handle used to be.",
  },
  {
    version: "1.0.731",
    date: "2026-09-02",
    summary: "Added left-to-right / right-to-left flow direction for nodes: any node's input and output handles can now be mirrored so a pipeline reads either way, via a Flow Direction control in the node configuration panel, a Mirror button on the canvas toolbar, and the M keyboard shortcut for the current selection. A hand-picked direction is locked so automatic layout leaves that choice alone.",
  },
  {
    version: "1.0.730",
    date: "2026-09-02",
    summary: "Fixed GigaVUE-TA200E front panel optic overlay alignment: recalibrated the 64 QSFP28 port cage coordinates across 16 columns and 4 rows (2 tiers of stacked 2x2 cages), resolving the horizontal left-offset that caused port markers to render over the status LEDs and chassis bezel.",
  },
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
];
