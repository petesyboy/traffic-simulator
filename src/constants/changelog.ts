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
  {
    version: "1.0.646",
    date: "2026-08-26",
    summary: "Dynamically sanitize and enforce module category and discount on all line calculations (v1.0.646)",
  },
  {
    version: "1.0.645",
    date: "2026-08-26",
    summary: "Add semantic English description validation for hardware vs software category resolution (v1.0.645)",
  },
  {
    version: "1.0.644",
    date: "2026-08-26",
    summary: "Ensure hardware modules (PRT-*-HW, SMT-*-HW) are classified as Module rather than Software (v1.0.644)",
  },
  {
    version: "1.0.643",
    date: "2026-08-26",
    summary: "Complete 100% pricing audit across all active SKUs and HTL hardware/software components (v1.0.643)",
  },
  {
    version: "1.0.642",
    date: "2026-08-26",
    summary: "Add list prices for GFM, Gen2 GigaSMART and TA upgrade term licences with hyphen normalization (v1.0.642)",
  },
  {
    version: "1.0.641",
    date: "2026-08-26",
    summary: "Preserve and convert manually added ad-hoc SKUs between HTL and Perpetual modes (v1.0.641)",
  },
  {
    version: "1.0.640",
    date: "2026-08-26",
    summary: "Refactor top header navigation with dropdowns and responsive layout for Mac and laptop screens (v1.0.640)",
  },
  {
    version: "1.0.639",
    date: "2026-08-26",
    summary: "Add catalogue list prices for HC3A3/A4 & Gen3 perpetual licences, categorize GigaSMART licences as Software (v1.0.639)",
  },
  {
    version: "1.0.638",
    date: "2026-08-26",
    summary: "Honour SKU types, terms, and capital vs term pricing when switching between Perpetual and HTL (v1.0.638)",
  },
  {
    version: "1.0.637",
    date: "2026-08-26",
    summary: "Scale power cord quantities with HC3 PSU count (v1.0.637)",
  },
];
