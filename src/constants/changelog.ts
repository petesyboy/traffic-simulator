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
  {
    version: "1.0.676",
    date: "2026-08-28",
    summary: "Allow combining FlowVUE and GTP-Max correlation/filtering on a single HC3 GigaSMART card (v1.0.676)",
  },
  {
    version: "1.0.675",
    date: "2026-08-28",
    summary: "Introduce dedicated .gvp project file format with full quote state persistence (v1.0.675)",
  },
  {
    version: "1.0.674",
    date: "2026-08-28",
    summary: "Prevent phantom high-speed uplink optics when interconnecting chassis (v1.0.674)",
  },
  {
    version: "1.0.673",
    date: "2026-08-28",
    summary: "Add sticky totals footer for Cost Before/After Discount in quote table (v1.0.673)",
  },
  {
    version: "1.0.672",
    date: "2026-08-28",
    summary: "Add Cost Before/After Discount columns to quote & reset CPQ metadata defaults (v1.0.672)",
  },
  {
    version: "1.0.671",
    date: "2026-08-28",
    summary: "Add GigaSMART Tunneling & ERSPAN Decapsulation app and licensing (v1.0.671)",
  },
  {
    version: "1.0.670",
    date: "2026-08-28",
    summary: "Add New Project menu action, quotation workspace reset, and project naming prompt before generation",
  },
  {
    version: "1.0.667",
    date: "2026-08-27",
    summary: "Add 20-pack vs discrete optics toggle in QuoteModal (v1.0.667)",
  },
  {
    version: "1.0.666",
    date: "2026-08-27",
    summary: "Add AHR qualification badge to eligible hardware in QuoteModal (v1.0.666)",
  },
  {
    version: "1.0.664",
    date: "2026-08-27",
    summary: "Align commercial quote and PDF generator with Salesforce CPQ format (v1.0.664)",
  },
  {
    version: "1.0.663",
    date: "2026-08-27",
    summary: "Standardize solution deliverable package to 6 canonical files and streamline export notifications (v1.0.663)",
  },
];
