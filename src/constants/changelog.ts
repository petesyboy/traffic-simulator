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
  {
    version: "1.0.556",
    date: "2026-08-21",
    summary: "Unified SKU data layer into a single source of truth backed by src/data/skus.json, updated skuService and skuOverrides to maintain automatic previous backups with rollback capabilities, and synced SKU lookup pipelines.",
  },
  {
    version: "1.0.555",
    date: "2026-08-21",
    summary: "Implemented Vitest unit test suite with coverage, isolated pure math engine (calculator.ts), build-time reference CSV catalog ingestion pipeline (scripts/parse-skus.js), typed SKU service data layer (skuService.ts), and CI/CD test automation.",
  },
  {
    version: "1.0.554",
    date: "2026-08-21",
    summary: "Added site assignment consistency verification modal before generating Bill of Materials or PDF Solution Reports, preventing unintentional discrepancies from partially tagged physical topologies.",
  },
  {
    version: "1.0.553",
    date: "2026-08-21",
    summary: "Added an advisory notice and vendor verification disclaimer to the solution report and tool descriptions for tool/sensor ingest ratings, clarifying that rated capacities (e.g. 5 Gbps, 10 Gbps) are baseline simulation estimates and advising customers to confirm exact sustained and peak limits with the tool manufacturer.",
  },
  {
    version: "1.0.552",
    date: "2026-08-21",
    summary: "Added comprehensive Physical Rack & Deployment specifications to the solution report (Appendix B), rendering both a side-by-side per-site breakdown and a master aggregated deployment table with full RU, dimension, weight, power, heat dissipation, and airflow metrics.",
  },
  {
    version: "1.0.551",
    date: "2026-08-20",
    summary: "Enhanced the Link Resolution Engine to intelligently upgrade lower-speed transceivers to match higher-speed peers (e.g. upgrading 1G to 10G/25G instead of downgrading) and cleanly replace mismatched optics in the chassis inventory and port map.",
  },
  {
    version: "1.0.550",
    date: "2026-08-20",
    summary: "Added one-click 'Resolve Connection Problem' diagnostic feature to the Link Detail panel, automatically detecting missing, mismatched, or unassigned link transceivers and fitting matching TAA-compliant optics with one click.",
  },
  {
    version: "1.0.549",
    date: "2026-08-20",
    summary: "Added interactive Link Details side panel when selecting any link on the canvas, showing source and target appliances, fitted transceiver SKUs, link speed, physical media, traffic purpose, and live simulation throughput.",
  },
  {
    version: "1.0.548",
    date: "2026-08-20",
    summary: "Enabled multi-link connections between hardware nodes and tools on canvas with parallel curved routing, allowing multiple parallel physical links between the same appliances.",
  },
  {
    version: "1.0.546",
    date: "2026-08-20",
    summary: "Add Header Stripping and GTP Call Correlation interactive visualisations and simulation",
  },
  {
    version: "1.0.544",
    date: "2026-08-20",
    summary: "Ship v1.0.544: consolidate standalone single-line BOM devices",
  },
  {
    version: "1.0.543",
    date: "2026-08-20",
    summary: "Ship v1.0.543: project-wide optic pack optimization + surplus notes",
  },
];
