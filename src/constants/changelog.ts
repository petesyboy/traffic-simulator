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
  {
    version: "1.0.542",
    date: "2026-08-19",
    summary: "Ship v1.0.542: optic multipack BOM optimization",
  },
  {
    version: "1.0.541",
    date: "2026-08-19",
    summary: "Ship v1.0.541: fix HC3/HC1-Plus Slot 1 optic-marker positioning",
  },
  {
    version: "1.0.540",
    date: "2026-08-19",
    summary: "Ship v1.0.540: Tidy Layout auto-arrange button",
  },
  {
    version: "1.0.539",
    date: "2026-08-19",
    summary: "Ship v1.0.539: Markdown support in the report executive summary",
  },
  {
    version: "1.0.538",
    date: "2026-08-19",
    summary: "Ship v1.0.538: refreshed SKU catalogue from the real price list",
  },
  {
    version: "1.0.537",
    date: "2026-08-19",
    summary: "Ship v1.0.537: executive-summary report field + TA200/TA200E licensing fix",
  },
  {
    version: "1.0.536",
    date: "2026-08-19",
    summary: "Add an optional executive-summary field to the solution report export",
  },
];
