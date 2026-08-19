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
  {
    version: "1.0.522",
    date: "2026-08-14",
    summary: "Removed the misleading \"Delivered to Tools\" figure from the Global Pipeline Dashboard - it summed traffic across every packet-consuming tool, so it inflated with fan-out (5 tools receiving the same stream looked like 5x the traffic). Traffic Volume Reduction is now calculated directly from what's actually deduped/filtered relative to ingest, instead of ingest-minus-delivered, which also fixes it being stuck at 0.0% even when real reduction was happening.",
  },
  {
    version: "1.0.521",
    date: "2026-08-14",
    summary: "Mission Demo now has a visible payoff at the pipeline: it drops a legacy VLAN 999 noise stream and deduplicates the rest (25%) on its own onboard engine, so the node's In/Out numbers and the dashboard's Deduped/Filtered figures actually move. Also removed the \"HC1-Plus\" model label from the pipeline node for this demo, since it's meant to represent the concept, not a specific appliance.",
  },
  {
    version: "1.0.520",
    date: "2026-08-14",
    summary: "Mission Demo polish: the Deep Observability Pipeline node is now bigger with its own zoomed-in reveal so its label is actually readable; suppressed the false \"Ingest Overloaded\" warnings the ten generic tool nodes triggered the instant traffic started (they had no vendor ingest profile, so they defaulted to a 10 Gbps ceiling against the demo's ~27 Gbps fan-out); hid the Bill of Materials button while the demo is running; and made the Mission Demo button visible in Standard View so it no longer requires switching to Advanced Mode first.",
  },
];
