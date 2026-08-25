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
    version: "1.0.621",
    date: "2026-08-25",
    summary: "Apply screen font scaling zoom and improve quote table typography (v1.0.621)",
  },
  {
    version: "1.0.620",
    date: "2026-08-25",
    summary: "Separate Packet Slicing and Advanced Flow Slicing and default traffic panel to minimized (v1.0.620)",
  },
  {
    version: "1.0.618",
    date: "2026-08-25",
    summary: "Add tooltips and SKU badges to GigaSMART sidebar elements (v1.0.618)",
  },
  {
    version: "1.0.617",
    date: "2026-08-25",
    summary: "Adjust PDF quote table column widths and margins to fit within printable page (v1.0.617)",
  },
  {
    version: "1.0.616",
    date: "2026-08-25",
    summary: "Add commercial quotation engine, SPAN-only mode, and power cord discounting (v1.0.616)",
  },
  {
    version: "1.0.611",
    date: "2026-08-25",
    summary: "Label HC tier as Deep Observability instead of Aggregation in signal path schematic",
  },
  {
    version: "1.0.610",
    date: "2026-08-24",
    summary: "Optimize Mission Demo and canvas edge colours for crisp light and dark theme contrast",
  },
  {
    version: "1.0.609",
    date: "2026-08-24",
    summary: "Ensure Total Ingest Traffic value uses theme variable for high contrast in light theme",
  },
  {
    version: "1.0.608",
    date: "2026-08-24",
    summary: "Stagger network nodes and add multi-directional handles to prevent node and edge occlusion",
  },
  {
    version: "1.0.607",
    date: "2026-08-24",
    summary: "Suppress ingest overload warnings on mission demo tool nodes",
  },
  {
    version: "1.0.606",
    date: "2026-08-24",
    summary: "Add individual dedicated tool links and enable active traffic reduction metrics in Mission Demo",
  },
  {
    version: "1.0.605",
    date: "2026-08-24",
    summary: "Expand layout spacing and adjust fitView zoom to prevent node overlap and HUD collision",
  },
  {
    version: "1.0.604",
    date: "2026-08-24",
    summary: "Revamp Mission Demo to showcase Deep Observability Pipeline presentation",
  },
  {
    version: "1.0.598",
    date: "2026-08-24",
    summary: "Project workspace maintenance: cleaned up stale root scratchpads (work_log.md), removed obsolete .claude worktrees, cleared temporary test coverage artifacts, and committed a clean git release state.",
  },
  {
    version: "1.0.597",
    date: "2026-08-24",
    summary: "Streamlined Report Generator UI: focused format selector options exclusively on Signal Path (Technical Specification) and Uplink (Executive Brief), while preserving underlying template engines for future format activation.",
  },
  {
    version: "1.0.596",
    date: "2026-08-24",
    summary: "Fixed font registration in Patch Sheet report: replaced unbundled 'Courier' font reference with browser VFS-registered 'Roboto' default font and uppercase monospace styling, resolving runtime missing font error when generating Patch Sheet PDFs.",
  },
  {
    version: "1.0.595",
    date: "2026-08-24",
    summary: "Implemented the Fabric report suite expansion, introducing three new specialized report formats alongside Signal Path in the Report Generator: (1) Uplink for budget holders and executive sponsors featuring milestone progression charts and outcome reframes; (2) Patch Sheet for install and commissioning technicians featuring monospace work-order document control and concrete field checklists; (3) Crossover for architectural decision-makers featuring side-by-side trade-off comparisons with verdict takeaways.",
  },
  {
    version: "1.0.594",
    date: "2026-08-24",
    summary: "Updated Bill of Materials export filenames: both the SKU BOM CSV export and the Physical Deployment CSV export now clearly prefix the exported files with 'BOM_' (e.g. BOM_Tusass_Greenland.csv, BOM_Tusass_Greenland_deployment_report.csv, BOM.csv).",
  },
  {
    version: "1.0.593",
    date: "2026-08-24",
    summary: "Deduplicated Signal Path Schematics in PDF reports: when multiple deployment sites share identical architectures (e.g. Site A and Site B), renders a single consolidated representative schematic strip under the overview diagram instead of duplicating identical SVGs under each site sub-diagram. Preserves separate per-site schematics whenever site configurations differ.",
  },
  {
    version: "1.0.592",
    date: "2026-08-24",
    summary: "Fixed TAP link capacity resolution: getTapNodeLinks() now queries the merged SKU catalogue description and multi-link model heuristics (e.g. 6 links for TAP-M251T/M253T/M271T/M273T), accurately producing 96 monitored links and 192 optical feeds for 16 six-link TAP modules. Added automatic Scope Considerations warning notice plate conversion in executive summary.",
  },
];
