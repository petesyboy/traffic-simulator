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
  {
    version: "1.0.636",
    date: "2026-08-26",
    summary: "Add 2 vs 4 PSU chassis configuration for GigaVUE-HC3 (v1.0.636)",
  },
  {
    version: "1.0.635",
    date: "2026-08-26",
    summary: "Add bulk replace transceivers with connected TAP media synchronisation (v1.0.635)",
  },
  {
    version: "1.0.634",
    date: "2026-08-26",
    summary: "Add persistent Save and Load Commercial Quote JSON feature with solution naming (v1.0.634)",
  },
  {
    version: "1.0.633",
    date: "2026-08-26",
    summary: "Display live dollar and percentage savings indicators under top toggles (v1.0.633)",
  },
  {
    version: "1.0.632",
    date: "2026-08-26",
    summary: "Track raw string state for table row inputs to allow smooth editing and backspacing (v1.0.632)",
  },
  {
    version: "1.0.630",
    date: "2026-08-25",
    summary: "Expand line items table to naturally fill modal vertical space (v1.0.630)",
  },
  {
    version: "1.0.629",
    date: "2026-08-25",
    summary: "Classify term software licenses before support and apply full software discounts (v1.0.629)",
  },
  {
    version: "1.0.628",
    date: "2026-08-25",
    summary: "Pre-seed built-in HC3/HC/TA list prices and fix hardware chassis category mapping (v1.0.628)",
  },
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
];
