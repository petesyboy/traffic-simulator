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
    version: "1.0.768",
    date: "2026-09-10",
    summary: "Eliminate dual mouseovers on info icons and provide rich, accurate hardware specifications in node descriptions",
  },
  {
    version: "1.0.767",
    date: "2026-09-10",
    summary: "Fix changelog history persistence across shallow CI and deployment builds",
  },
  {
    version: "1.0.766",
    date: "2026-09-10",
    summary: "Standardise hardware graphic widths and align names in advanced mode menu",
  },
  {
    version: "1.0.764",
    date: "2026-09-10",
    summary: "Configure partner edition as default repository and GitHub Pages distribution (v1.0.764)",
  },
  {
    version: "1.0.763",
    date: "2026-09-10",
    summary: "Add focus mode to quickly hide sidebars and traffic drawer for demonstrations (v1.0.763)",
  },
  {
    version: "1.0.762",
    date: "2026-09-09",
    summary: "Add quantity stepper and bin removal controls for installed optics",
  },
  {
    version: "1.0.761",
    date: "2026-09-09",
    summary: "Implement GigaSMART tunnel decapsulation and ERSPAN remote encapsulation source",
  },
  {
    version: "1.0.760",
    date: "2026-09-09",
    summary: "Integrate G-TAP M Series Unidirectional TAP Family (ULT) with faceplate icons (v1.0.760)",
  },
  {
    version: "1.0.758",
    date: "2026-09-08",
    summary: "Fit SPAN feed optics at the configured port speed, not a 10G default (v1.0.758)",
  },
  {
    version: "1.0.757",
    date: "2026-09-04",
    summary: "Render TA25E SFP cages in 3 physical rows of 16",
  },
  {
    version: "1.0.756",
    date: "2026-09-04",
    summary: "Calibrate 3-row SFP28 and QSFP28 front panel port cage coordinates",
  },
  {
    version: "1.0.755",
    date: "2026-09-04",
    summary: "Preserve active project name and prevent reversion to stale saved slots",
  },
  {
    version: "1.0.754",
    date: "2026-09-04",
    summary: "Add human-readable specification to optic labels in export diagram mode (v1.0.754)",
  },
  {
    version: "1.0.753",
    date: "2026-09-04",
    summary: "Update passive TAP and breakout panel faceplate graphics (v1.0.753)",
  },
  {
    version: "1.0.750",
    date: "2026-09-04",
    summary: "Restore single-click selection for canvas nodes and auto-select on drop (v1.0.750)",
  },
  {
    version: "1.0.749",
    date: "2026-09-04",
    summary: "Preserve Swedish and international letters in export file names (v1.0.749)",
  },
  {
    version: "1.0.748",
    date: "2026-09-04",
    summary: "Distinguish DWDM in and out handles with I/O labels, distinct colours, and legend",
  },
  {
    version: "1.0.747",
    date: "2026-09-04",
    summary: "Anchor DWDM connector handles strictly to outer perimeter",
  },
  {
    version: "1.0.746",
    date: "2026-09-04",
    summary: "Enforce min site enclosure width to prevent obscuring single TAPs & add instant DWDM ring wizard (v1.0.746)",
  },
  {
    version: "1.0.744",
    date: "2026-09-03",
    summary: "Add 1-click conversion from central DWDM hub to per-site gateways with optical ring (v1.0.744)",
  },
];
