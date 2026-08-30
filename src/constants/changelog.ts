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
    version: "1.0.697",
    date: "2026-08-30",
    summary: "Add automated flow generation with telco and mobile profile biasing (v1.0.697)",
  },
  {
    version: "1.0.696",
    date: "2026-08-29",
    summary: "Show sequential multi-link ranges (e.g. Links 1 to 6, 7 to 12) for TAP stack links (v1.0.696)",
  },
  {
    version: "1.0.695",
    date: "2026-08-29",
    summary: "Resolve TAP cluster member optics accurately on chassis connections (v1.0.695)",
  },
  {
    version: "1.0.694",
    date: "2026-08-28",
    summary: "Expand vertical and horizontal node spacing with auto-fitView in Export Diagram Mode (v1.0.694)",
  },
  {
    version: "1.0.693",
    date: "2026-08-28",
    summary: "Auto-collapse >4 TAPs and Tools into stacks during diagram and report screenshots (v1.0.693)",
  },
  {
    version: "1.0.692",
    date: "2026-08-28",
    summary: "Decouple 3D card deck background from Export Diagram description box (v1.0.692)",
  },
  {
    version: "1.0.691",
    date: "2026-08-28",
    summary: "Enforce explicit pure white #ffffff and #ff9800 border on all diagram descriptors (v1.0.691)",
  },
  {
    version: "1.0.689",
    date: "2026-08-28",
    summary: "Add architecture details overlay in Export Diagram Ready Mode for TAP and Tool clusters (v1.0.689)",
  },
  {
    version: "1.0.688",
    date: "2026-08-28",
    summary: "Center collapsed cluster cards vertically to align with chassis (v1.0.688)",
  },
  {
    version: "1.0.687",
    date: "2026-08-28",
    summary: "Position cluster cards strictly at member nodes bounding box (v1.0.687)",
  },
  {
    version: "1.0.686",
    date: "2026-08-28",
    summary: "Preserve parallel and clustered links across restoreState and grouping operations (v1.0.686)",
  },
  {
    version: "1.0.685",
    date: "2026-08-28",
    summary: "Restore tool and tap link terminations during expand/collapse cycles (v1.0.685)",
  },
  {
    version: "1.0.684",
    date: "2026-08-28",
    summary: "Add stacked cluster cards with expand/collapse for TAPs and Tools (v1.0.684)",
  },
  {
    version: "1.0.683",
    date: "2026-08-28",
    summary: "Sync manually overridden and racked M200T trays to Bill of Materials (v1.0.683)",
  },
  {
    version: "1.0.682",
    date: "2026-08-28",
    summary: "Add TAP tray allocation preference and manual M200T override support (v1.0.682)",
  },
  {
    version: "1.0.681",
    date: "2026-08-28",
    summary: "Prevent optic doubling on TA25E and chassis by tagging TAP reallocated optics as isAutoAdded (v1.0.681)",
  },
  {
    version: "1.0.680",
    date: "2026-08-28",
    summary: "Resolve optic and port allocation misalignment and orphan fitted optics on modular chassis (v1.0.680)",
  },
  {
    version: "1.0.679",
    date: "2026-08-28",
    summary: "Map GFM-FM000-SW-TM to perpetual GFM-FM000 in license mode conversions and quotes (v1.0.679)",
  },
  {
    version: "1.0.678",
    date: "2026-08-28",
    summary: "Replace HTL AHR with Traditional Support SKUs (GSS-FYS-*, GSS-RNL-*) in Perpetual deals (v1.0.678)",
  },
  {
    version: "1.0.677",
    date: "2026-08-28",
    summary: "Display % (A) for auto-generated discounts in quote line items and reports (v1.0.677)",
  },
];
