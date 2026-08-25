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
    version: "1.0.627",
    date: "2026-08-25",
    summary: "Add sticky table headers, dedicated table scroll container, and collapsible discount matrix (v1.0.627)",
  },
  {
    version: "1.0.626",
    date: "2026-08-25",
    summary: "Use async file.text(), defer input reset, and add canvas drag-and-drop scenario load (v1.0.626)",
  },
  {
    version: "1.0.625",
    date: "2026-08-25",
    summary: "Switch to synchronous W3C FileReader import for file:// origin and macOS (v1.0.625)",
  },
  {
    version: "1.0.624",
    date: "2026-08-25",
    summary: "Support File System Access API and fix macOS Safari hidden input click (v1.0.624)",
  },
  {
    version: "1.0.623",
    date: "2026-08-25",
    summary: "Scope SPAN-only optic halving to TAP-termination links, add Accessories discount, fix ERSPAN tunnel ID reset (v1.0.623)",
  },
  {
    version: "1.0.622",
    date: "2026-08-25",
    summary: "Use project-wide Master BOM aggregation and multipack optimization (v1.0.622)",
  },
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
];
