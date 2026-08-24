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
    version: "1.0.596",
    date: "2026-08-24",
    summary: "Fixed font registration in Patch Sheet report: replaced unbundled 'Courier' font reference with browser VFS-registered 'Roboto' default font and uppercase monospace styling, resolving runtime missing font error when generating Patch Sheet PDFs.",
  },
  {
    version: "1.0.595",
    date: "2026-08-24",
    summary: "Implemented the Fabric report suite expansion, introducing three new specialized report formats alongside Signal Path in the Report Generator: (1) Uplink for budget holders and executive sponsors featuring milestone progression charts and outcome reframes; (2) Patch Sheet for install and commissioning technicians featuring monospace work-order document control and concrete field checklists; (3) Crossover for architectural decision-makers featuring side-by-side trade-off comparisons with verdict takeaways.",
  },
  {
    version: "1.0.594",
    date: "2026-08-24",
    summary: "Updated Bill of Materials export filenames: both the SKU BOM CSV export and the Physical Deployment CSV export now clearly prefix the exported files with 'BOM_' (e.g. BOM_Tusass_Greenland.csv, BOM_Tusass_Greenland_deployment_report.csv, BOM.csv).",
  },
  {
    version: "1.0.593",
    date: "2026-08-24",
    summary: "Deduplicated Signal Path Schematics in PDF reports: when multiple deployment sites share identical architectures (e.g. Site A and Site B), renders a single consolidated representative schematic strip under the overview diagram instead of duplicating identical SVGs under each site sub-diagram. Preserves separate per-site schematics whenever site configurations differ.",
  },
  {
    version: "1.0.592",
    date: "2026-08-24",
    summary: "Fixed TAP link capacity resolution: getTapNodeLinks() now queries the merged SKU catalogue description and multi-link model heuristics (e.g. 6 links for TAP-M251T/M253T/M271T/M273T), accurately producing 96 monitored links and 192 optical feeds for 16 six-link TAP modules. Added automatic Scope Considerations warning notice plate conversion in executive summary.",
  },
  {
    version: "1.0.591",
    date: "2026-08-24",
    summary: "Corrected monitored link, optical feed, and TAP counts across the PDF report: accurately calculates physical TAP units, total network links tapped, and bidirectional optical feeds (2 feeds per tapped link). Updated cover page stat, §01 stat tiles grid, §02 per-site schematic strips, and §03 TAP hardware descriptions to report both link and optical feed counts.",
  },
  {
    version: "1.0.590",
    date: "2026-08-24",
    summary: "Report fix pack: (0) dontBreakRows on all tables preventing row splits across page breaks; (1) removed forced page break before §01 so exec summary/stat strip flow on same page as TOC, fixed per-site diagram blank-space gaps via keepWithNext; (2) bumped topology diagram pixelRatio 2→3 for sharper node text, added per-site SVG signal-path schematic strip; (3) replaced unrenderable Unicode glyphs in notice plates (ℹ→i, ✕→X) with Roboto-safe ASCII; (4) Fitted Cards annotation now word-wraps at commas on multi-RU callout cards.",
  },
  {
    version: "1.0.589",
    date: "2026-08-23",
    summary: "Fixed TAP modules not appearing inside tray bays in rack elevation diagrams — getChassisImagePath() was only searching TA/HC series, so TAP module icons were not resolved. Added model-name fallback so resolveHardwareIcon() correctly matches TAP_MODEL_ALIASES for TAP-M251T, TAP-M273T, etc.",
  },
  {
    version: "1.0.588",
    date: "2026-08-23",
    summary: "Rendered full composited add-in cards (GigaSMART, PRT modules, and TAP bays) inside rack elevation diagrams, and relocated device labels and descriptions to side callout cards with leader lines to keep physical equipment faceplates completely unobscured.",
  },
  {
    version: "1.0.587",
    date: "2026-08-23",
    summary: "Consolidated hardware platform descriptions in the Solution Report to display a single representative front-panel photograph per chassis/node model, with all deployed instances, sites, and labels detailed in the text.",
  },
  {
    version: "1.0.586",
    date: "2026-08-23",
    summary: "Redesigned Solution Report Generator with 'Signal Path' design system: full-bleed dark navy cover with vector fan-in graphics, automated Table of Contents, section wayfinding kickers, hairline stat tiles with zero-value handling, multi-severity notice plates, compact rack elevations, and bespoke table styling.",
  },
  {
    version: "1.0.585",
    date: "2026-08-23",
    summary: "Fixed Light Theme styling across canvas background, header toolbars, sidebars, traffic drawer, and configuration panels for full high-contrast visibility.",
  },
  {
    version: "1.0.584",
    date: "2026-08-23",
    summary: "Added Light Theme and Dark Theme system with localStorage persistence, instant header toggle, document-ready white canvas screenshots, and crisp high-contrast node, edge, and UI tokens.",
  },
  {
    version: "1.0.583",
    date: "2026-08-23",
    summary: "Removed references to end-of-sale/end-of-life SMT-HC3-C05 cards from GigaSMART chassis expansion recommendations, prompting exclusively for SMT-HC3-C08 on GigaVUE-HC3.",
  },
  {
    version: "1.0.582",
    date: "2026-08-23",
    summary: "Fixed site diagram screenshot framing in PDF reports by enabling high-zoom (maxZoom: 3.5), removing animation delays, iteratively expanding complete multi-hop site partitions, and rendering at 2x pixel density to eliminate empty black space.",
  },
  {
    version: "1.0.581",
    date: "2026-08-23",
    summary: "Consolidated GigaSMART function descriptions across sites in the Solution Overview narrative report, cleaned repetitive title labels, and fixed broken warning glyph boxes in PDF callouts.",
  },
  {
    version: "1.0.580",
    date: "2026-08-23",
    summary: "Fixed GigaSMART module drag-and-drop validation on the canvas to evaluate multi-engine capacity and allow uncombinable single-GSOP operations across multiple installed SMT cards on GigaVUE-HC3/HC1.",
  },
  {
    version: "1.0.579",
    date: "2026-08-23",
    summary: "Aligned GigaSMART single-operation (GSOP) combinations 1:1 with Gigamon's official matrix, added multi-engine support allowing uncombinable operations when 2+ GigaSMART engines are installed, and added actionable prompts guiding users to add SMT-HC3-C08/C05 or SMT-HC1-S engines when single-operation constraints are exceeded.",
  },
  {
    version: "1.0.578",
    date: "2026-08-23",
    summary: "Fixed GigaSMART function counting in summary statistics across hosted apps and GTP correlation, and resolved tool site assignment dynamically from connected hardware to eliminate confusing 'Global' placeholders.",
  },
  {
    version: "1.0.577",
    date: "2026-08-23",
    summary: "Added non-destructive auto-spacing for Export Diagram Mode captures so that node description boxes never overlap or obscure icons below them, and restored original user canvas positions after capture.",
  },
];
