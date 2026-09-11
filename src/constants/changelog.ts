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
    version: "1.0.774",
    date: "2026-09-10",
    summary: "Redesign cover page co-branding lockup and eliminate vector interference (v1.0.774)",
  },
  {
    version: "1.0.773",
    date: "2026-09-10",
    summary: "Separate co-branded partner logo from Gigamon wordmark on report cover (v1.0.773)",
  },
  {
    version: "1.0.772",
    date: "2026-09-10",
    summary: "Show a confirmation modal with the saved filename after report generation (v1.0.772)",
  },
  {
    version: "1.0.771",
    date: "2026-09-10",
    summary: "Add partner-brandable report templates, deprecate Patch Sheet/Crossover formats (v1.0.771)",
  },
  {
    version: "1.0.770",
    date: "2026-09-10",
    summary: "Add multi-select batch property editing and cluster group configuration for TAPs, Tools, and datacentre locations",
  },
  {
    version: "1.0.769",
    date: "2026-09-10",
    summary: "Ensure location tag and data centre enclosure encompass collapsed and expanded tap clusters",
  },
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
];
