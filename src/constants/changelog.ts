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
  {
    version: "1.0.576",
    date: "2026-08-23",
    summary: "Isolated per-site diagram captures by filtering out non-partition nodes and external edges in html-to-image to prevent overlapping graphics between sites, tightened viewport padding to zoom in closely, and prevented cross-site edge leakage.",
  },
  {
    version: "1.0.575",
    date: "2026-08-23",
    summary: "Streamlined tool group summaries to state total deployed count across sites (e.g. 20 instances deployed across 2 sites: 10 at Site A, 10 at Site B), eliminated redundant repetitive label and value proposition strings, and grouped upstream origin TAP feeds.",
  },
  {
    version: "1.0.574",
    date: "2026-08-23",
    summary: "Consolidated optical TAP modules and TAP trays into unified single summaries in the report, clearly displayed site and unit labels next to all HC and TA front panel graphics, and prevented stat blocks and diagrams from breaking across pages.",
  },
  {
    version: "1.0.573",
    date: "2026-08-23",
    summary: "Added diagram legibility detection and multi-site diagram splitting to automatically generate focused, high-resolution per-site architecture diagrams in addition to the global end-to-end overview in the PDF report.",
  },
  {
    version: "1.0.572",
    date: "2026-08-23",
    summary: "Tidied PDF report by deduplicating identical chassis and tool descriptions with deployed instance counts, auto-deploying 42U rack layouts with embedded elevation diagrams in Appendix B physical report, and automatically enabling diagram-ready descriptions for topology capture.",
  },
  {
    version: "1.0.571",
    date: "2026-08-23",
    summary: "Excluded tool nodes, packet tools, and third-party probes (such as Ericsson probes) from physical site assignment validation checks.",
  },
  {
    version: "1.0.570",
    date: "2026-08-23",
    summary: "Excluded custom tools, packet tools, and third-party monitoring probes (such as Ericsson probes) from the rackable hardware inventory and unracked equipment warnings.",
  },
  {
    version: "1.0.569",
    date: "2026-08-23",
    summary: "Updated TAP-M200T tray height to 1 RU and TAP-M100T to 0.5 RU across catalogue, heuristics, and 42U Rack Elevation View.",
  },
];
