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
  {
    version: "1.0.662",
    date: "2026-08-27",
    summary: "Conditionally omit commercial quotes from package dump unless project discounting is configured (v1.0.662)",
  },
  {
    version: "1.0.660",
    date: "2026-08-27",
    summary: "Add native directory chooser & solution package dump for all deliverables (v1.0.660)",
  },
  {
    version: "1.0.659",
    date: "2026-08-27",
    summary: "Ensure architecture PDF filename strictly defaults to Gigamon_Architecture_<solution>.pdf (v1.0.659)",
  },
  {
    version: "1.0.658",
    date: "2026-08-27",
    summary: "Standardize export and report naming across BOM, architecture PDFs, topology JSON, quotes, and diagrams (v1.0.658)",
  },
  {
    version: "1.0.657",
    date: "2026-08-27",
    summary: "Add intelligent auto-reallocation and re-alignment of optics and port links across chassis boards (v1.0.657)",
  },
  {
    version: "1.0.656",
    date: "2026-08-26",
    summary: "Refine CPQ eligibility rules and 41% calculation for GSS-HW-AHR-GMO (v1.0.656)",
  },
];
