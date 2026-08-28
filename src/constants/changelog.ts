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
  {
    version: "1.0.655",
    date: "2026-08-26",
    summary: "Allow bulk replace to non-TAA optics without being reverted by TAP sync (v1.0.655)",
  },
  {
    version: "1.0.653",
    date: "2026-08-26",
    summary: "Resolve PDF generation hanging on promise resolution and table widths (v1.0.653)",
  },
  {
    version: "1.0.652",
    date: "2026-08-26",
    summary: "Consolidate optic pack optimization across all links into unified 20-packs (v1.0.652)",
  },
  {
    version: "1.0.651",
    date: "2026-08-26",
    summary: "Synchronize master SKU catalog and all prices against latest WWPL_20260731 (v1.0.651)",
  },
  {
    version: "1.0.650",
    date: "2026-08-26",
    summary: "Support percent-of-total hardware support SKU GSS-HW-AHR-GMO (41% of covered hardware list price) (v1.0.650)",
  },
  {
    version: "1.0.649",
    date: "2026-08-26",
    summary: "Prompt for filename on quote PDF, JSON, and CSV exports to allow overwriting existing files (v1.0.649)",
  },
  {
    version: "1.0.648",
    date: "2026-08-26",
    summary: "Fix dropdown overflow clipping and click propagation for Project and Demo menus on macOS Chrome (v1.0.648)",
  },
  {
    version: "1.0.647",
    date: "2026-08-26",
    summary: "Align SMT-HC3-C08-SW-TM pricing to WWPL_20260731 (,400/mo) and add -SW normalization (v1.0.647)",
  },
];
