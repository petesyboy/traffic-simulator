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
    version: "1.0.576",
    date: "2026-08-23",
    summary: "Isolated per-site diagram captures by filtering out non-partition nodes and external edges in html-to-image to prevent overlapping graphics between sites, tightened viewport padding to zoom in closely, and prevented cross-site edge leakage.",
  },
  {
    version: "1.0.575",
    date: "2026-08-23",
    summary: "Streamlined tool group summaries to state total deployed count across sites (e.g. 20 instances deployed across 2 sites: 10 at Site A, 10 at Site B), eliminated redundant repetitive label and value proposition strings, and grouped upstream origin TAP feeds.",
  },
  {
    version: "1.0.574",
    date: "2026-08-23",
    summary: "Consolidated optical TAP modules and TAP trays into unified single summaries in the report, clearly displayed site and unit labels next to all HC and TA front panel graphics, and prevented stat blocks and diagrams from breaking across pages.",
  },
  {
    version: "1.0.573",
    date: "2026-08-23",
    summary: "Added diagram legibility detection and multi-site diagram splitting to automatically generate focused, high-resolution per-site architecture diagrams in addition to the global end-to-end overview in the PDF report.",
  },
  {
    version: "1.0.572",
    date: "2026-08-23",
    summary: "Tidied PDF report by deduplicating identical chassis and tool descriptions with deployed instance counts, auto-deploying 42U rack layouts with embedded elevation diagrams in Appendix B physical report, and automatically enabling diagram-ready descriptions for topology capture.",
  },
  {
    version: "1.0.571",
    date: "2026-08-23",
    summary: "Excluded tool nodes, packet tools, and third-party probes (such as Ericsson probes) from physical site assignment validation checks.",
  },
  {
    version: "1.0.570",
    date: "2026-08-23",
    summary: "Excluded custom tools, packet tools, and third-party monitoring probes (such as Ericsson probes) from the rackable hardware inventory and unracked equipment warnings.",
  },
  {
    version: "1.0.569",
    date: "2026-08-23",
    summary: "Updated TAP-M200T tray height to 1 RU and TAP-M100T to 0.5 RU across catalogue, heuristics, and 42U Rack Elevation View.",
  },
  {
    version: "1.0.568",
    date: "2026-08-23",
    summary: "Added a dedicated Left RU Number Rail displaying permanent 1-42 slot numbers on the rack exterior regardless of hardware occupancy, and refined fitted SFP cage overlays with crisp 1px borders and enhanced background clarity.",
  },
  {
    version: "1.0.567",
    date: "2026-08-23",
    summary: "Fixed ChassisFrontPanel height scaling in Rack Elevation View (fillContainer) ensuring full 3U HC3 chassis with all 4 module bays and ports is fully visible without clipping.",
  },
  {
    version: "1.0.566",
    date: "2026-08-23",
    summary: "Fixed multi-RU chassis vertical positioning in 42U Rack Elevation View (preventing HC3 bottom truncation) and mapped all TAP module stencils to authentic orange LC connector faceplates.",
  },
  {
    version: "1.0.565",
    date: "2026-08-23",
    summary: "Added Auto-Deploy to 42U Rack Elevation View using datacenter weight/hierarchy standards (heaviest chassis at bottom, TAP trays/modules at top) and added debounced working session autosave and slot tracking.",
  },
  {
    version: "1.0.564",
    date: "2026-08-23",
    summary: "Updated TAP-M200T 2U modular tray layout to render accurately as 3 across in the top row and 3 across in the bottom row (2x3 grid).",
  },
  {
    version: "1.0.563",
    date: "2026-08-23",
    summary: "Integrated authentic Gigamon G-TAP stencil graphics from ms-vs-gigamon-g-tap-stencils.vss across canvas nodes, TAP configuration panels, and rack elevation tray bays (M-Series TAPs, ULT/TAA variants, breakout panels, and active TAPs).",
  },
  {
    version: "1.0.562",
    date: "2026-08-23",
    summary: "Added a 'Hide Labels' toggle checkbox to the 42U Rack Elevation View toolbar, enabling clean, unobstructed front-panel and TAP tray visualization.",
  },
  {
    version: "1.0.561",
    date: "2026-08-23",
    summary: "Added interactive zoom controls (step in/out, presets from 75% to 200%, Ctrl+Scroll wheel zoom) and one-click per-chassis front-panel modal inspection in the 42U Rack Elevation View.",
  },
  {
    version: "1.0.560",
    date: "2026-08-23",
    summary: "Extended physical front-panel photographic visualization and real-time cage-level optic occupancy overlays to GigaVUE-HCT, TA-series chassis (TA25E, TA200, TA200E, TA400, TA400E), and PRT-HC1-G12 across canvas nodes, summary modals, rack elevation view, and solution reports.",
  },
  {
    version: "1.0.559",
    date: "2026-08-21",
    summary: "Updated primary and SE advanced documentation (README.md and README_advanced.md) with comprehensive guides covering recent features including one-click link problem resolution, multi-site architecture, breakout panel tray modelling, optic multipack optimisations, physical deployment specifications in PDF reports, and Tidy Layout auto-arrangement.",
  },
  {
    version: "1.0.558",
    date: "2026-08-21",
    summary: "Cleaned up redundant legacy build artefacts and old versioned single-file HTML distributions from the repository root.",
  },
  {
    version: "1.0.557",
    date: "2026-08-21",
    summary: "Retained historical knowledge base for SKUs removed or omitted from subsequent price lists, automatically flagging them as Discontinued / Unavailable, and alert users during configuration validation.",
  },
];
