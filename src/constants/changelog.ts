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
    version: "1.0.785",
    date: "2026-09-11",
    summary: "Instruct Glean AI to output directly copy-and-pasteable markdown without wrapping code blocks or conversational preambles (v1.0.785)",
  },
  {
    version: "1.0.784",
    date: "2026-09-11",
    summary: "Restore data centre boundary enclosures in overview diagrams, isolate local DWDM nodes in per-site sub-diagrams, and drop simulated traffic bandwidth figures (v1.0.784)",
  },
  {
    version: "1.0.783",
    date: "2026-09-11",
    summary: "Add internal glean ai executive summary prompt generator and deliverables export",
  },
  {
    version: "1.0.782",
    date: "2026-09-11",
    summary: "Add adversarial planning protocol to agents.md and bump version to 1.0.782",
  },
  {
    version: "1.0.780",
    date: "2026-09-11",
    summary: "Reset project name on Clear Canvas, not just New Project (v1.0.780)",
  },
  {
    version: "1.0.779",
    date: "2026-09-11",
    summary: "Drop cosmetic cloud platform selector from Cloud Suite quick-add (v1.0.779)",
  },
  {
    version: "1.0.778",
    date: "2026-09-11",
    summary: "Add GigaVUE Cloud Suite (VBL) quick-add to Commercial Quote (v1.0.778)",
  },
  {
    version: "1.0.776",
    date: "2026-09-11",
    summary: "Implement top executive header bar layout and deconflict cover background graphic (v1.0.776)",
  },
  {
    version: "1.0.775",
    date: "2026-09-11",
    summary: "Make the default packet tool partner-configurable (v1.0.775)",
  },
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
];
