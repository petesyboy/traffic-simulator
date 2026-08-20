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
    version: "1.0.543",
    date: "2026-08-20",
    summary: "Ship v1.0.543: project-wide optic pack optimization + surplus notes",
  },
  {
    version: "1.0.542",
    date: "2026-08-19",
    summary: "Ship v1.0.542: optic multipack BOM optimization",
  },
  {
    version: "1.0.541",
    date: "2026-08-19",
    summary: "Ship v1.0.541: fix HC3/HC1-Plus Slot 1 optic-marker positioning",
  },
  {
    version: "1.0.540",
    date: "2026-08-19",
    summary: "Ship v1.0.540: Tidy Layout auto-arrange button",
  },
  {
    version: "1.0.539",
    date: "2026-08-19",
    summary: "Ship v1.0.539: Markdown support in the report executive summary",
  },
  {
    version: "1.0.538",
    date: "2026-08-19",
    summary: "Ship v1.0.538: refreshed SKU catalogue from the real price list",
  },
  {
    version: "1.0.537",
    date: "2026-08-19",
    summary: "Ship v1.0.537: executive-summary report field + TA200/TA200E licensing fix",
  },
  {
    version: "1.0.536",
    date: "2026-08-19",
    summary: "Add an optional executive-summary field to the solution report export",
  },
  {
    version: "1.0.534",
    date: "2026-08-19",
    summary: "Stop claiming every chassis is \"filtering\" traffic in Export Diagram Mode",
  },
  {
    version: "1.0.533",
    date: "2026-08-19",
    summary: "Stop showing In/Out throughput on breakout panel nodes",
  },
  {
    version: "1.0.532",
    date: "2026-08-19",
    summary: "Close the breakout-panel fibre-type gap: cross-check parent optic vs panel model",
  },
  {
    version: "1.0.531",
    date: "2026-08-19",
    summary: "Confirm and lock in aggregation-direction breakout validation with tests",
  },
  {
    version: "1.0.530",
    date: "2026-08-19",
    summary: "Tie breakout-capability to Gigamon's actual supported SKU list, not a naming heuristic",
  },
  {
    version: "1.0.529",
    date: "2026-08-19",
    summary: "Fix TA200/TA400 QSFP-cage check ignoring Advanced Mode's per-link allocations",
  },
  {
    version: "1.0.528",
    date: "2026-08-19",
    summary: "Unify the two remaining hand-styled optic pickers",
  },
  {
    version: "1.0.527",
    date: "2026-08-19",
    summary: "Unify TAP termination-matrix optic labels with the rest of the app",
  },
  {
    version: "1.0.526",
    date: "2026-08-19",
    summary: "Ship v1.0.526: update deliverable HTML copies + checksums",
  },
  {
    version: "1.0.525",
    date: "2026-08-19",
    summary: "Derive TAP target-optic list directly from opticRules.json",
  },
  {
    version: "1.0.524",
    date: "2026-08-19",
    summary: "Unify TAP target-optic and chassis optic vocabularies onto real Gigamon SKUs",
  },
  {
    version: "1.0.523",
    date: "2026-08-19",
    summary: "Fix false TA200/TA400 QSFP connection refusal on high-speed tap links",
  },
];
