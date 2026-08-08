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
    version: "1.0.500",
    date: "2026-08-07",
    summary: "Fixed the PDF report's Executive Summary showing zero Traffic Sources/TAPs whenever TAPs were modelled as their own hardware unit wired to a chassis rather than a logical TAP input node - both representations now count correctly.",
  },
  {
    version: "1.0.499",
    date: "2026-08-07",
    summary: "The PDF report now describes what each TA/HC appliance actually does (aggregation-only vs. onboard GigaSMART processing), and fixed a bug where a TAP-M100T/M200T tray - a passive mounting tray, not a fibre-terminating unit - was incorrectly shown with a multimode/singlemode fibre claim.",
  },
  {
    version: "1.0.498",
    date: "2026-08-07",
    summary: "The PDF report now explains the domain, not just the topology: each TAP lists its fibre type, SFP, and the chassis/optics it plugs into; Traffic Maps get a plain-English \"Includes / Excludes\" summary; every GigaSMART function (deduplication, SSL decrypt, header stripping, etc.) gets a full description of what it does and how it protects tools from being overwhelmed; and every destination tool gets a purpose description plus what happens if it receives more traffic than it's rated for.",
  },
  {
    version: "1.0.497",
    date: "2026-08-07",
    summary: "The PDF solution report is now far more detailed: each traffic source lists its link speed, encrypted %, matched traffic streams and what it ultimately reaches; each map/filter/GigaSMART stage lists what feeds it, what it forwards to, and (while a simulation is running) real observed throughput and reduction percentages; each destination lists which taps/SPAN sessions its traffic originates from.",
  },
  {
    version: "1.0.496",
    date: "2026-08-07",
    summary: "Added a Generate Report button - produces a customer-facing PDF describing the current topology in plain English (traffic sources, maps, filters, GigaSMART processing, destinations), with the topology diagram and a Bill of Materials appendix, plus a physical/rack deployment appendix in Advanced Mode.",
  },
  {
    version: "1.0.495",
    date: "2026-08-07",
    summary: "The Optics tab now lets you pick an exact port to install into, instead of only auto-assigning to the next free one - an optional \"Target Port\" dropdown appears once a board is chosen, and picking one there pins that specific optic to that specific port.",
  },
  {
    version: "1.0.494",
    date: "2026-08-07",
    summary: "Fixed the breakout-panel optic guard blocking unrelated SFPs: on a chassis where one board carries both SFP and QSFP cages, wiring a single QSFP cage to a breakout panel no longer restricts that board's SFP cages too - only the specific cage family actually feeding the panel is limited.",
  },
  {
    version: "1.0.493",
    date: "2026-08-07",
    summary: "The optic picker's LC-side guard now works too - once a cage is wired to one of a breakout panel's 4 lower-speed legs, only the optics matching that group's actual speed/fibre tier (derived from whatever's fitted on the panel's high-speed side) are offered.",
  },
  {
    version: "1.0.492",
    date: "2026-08-07",
    summary: "The optic picker now marks every parallel-fibre optic as \"breakout-capable\", and once a cage is wired to an MPO breakout panel it only offers the optics that panel can actually use (SR4/PLR4/PSM4/DR4/DR4+) - LR4/CWDM4/SWDM4/FR4 optics are no longer selectable there.",
  },
  {
    version: "1.0.491",
    date: "2026-08-07",
    summary: "Added MPO breakout panels (PNL-M341T multimode / PNL-M343T singlemode) as real, sidebar-placeable modules - drag one into a TAP tray alongside tap modules, wire a GigaVUE port's parallel optic to its MPO connector, and fan out to 4 independently wireable LC ports (or wire 4 lower-speed sources in to aggregate them back into one uplink). Validates parallel-optic and lane-speed rules and quotes correctly in the BOM.",
  },
  {
    version: "1.0.490",
    date: "2026-08-07",
    summary: "Fixed the \"Saved to ...\" confirmation toast rendering behind the Save/Load modal's blurred background and becoming illegible when a slot is overwritten without closing the modal.",
  },
  {
    version: "1.0.489",
    date: "2026-08-07",
    summary: "Advanced Mode has a new Update Price List button — upload the worldwide price list workbook (.xlsx/.xls/.csv) directly to refresh SKU descriptions and End of Sale/Life dates, no CSV conversion or rebuild needed.",
  },
  {
    version: "1.0.488",
    date: "2026-08-07",
    summary: "Port tooltips now say 'fitted but unused' for an optic that's installed but not linked, instead of just naming the optic as if it were connected.",
  },
  {
    version: "1.0.487",
    date: "2026-08-07",
    summary: "Fixed the grab-hand cursor bleeding onto individual ports on a chassis front panel, making it fiddly to hover precisely over one - it's a plain arrow there now.",
  },
  {
    version: "1.0.486",
    date: "2026-08-07",
    summary: "Fixed the enlarged AMI event panel still drifting off-screen on shorter windows - its height and position could disagree with each other when stacked above the compact log.",
  },
  {
    version: "1.0.485",
    date: "2026-08-07",
    summary: "TAP-M100T/M200T/M202ULT trays are no longer manually placed on the canvas - they're generated automatically to match your tap modules and only appear in Rack View.",
  },
  {
    version: "1.0.484",
    date: "2026-08-07",
    summary: "The configuration panel can now be dragged wider. Newly installed optics briefly flash on the hardware node's port map so you can spot which cage they landed in.",
  },
  {
    version: "1.0.483",
    date: "2026-08-07",
    summary: "Traffic Map nodes now show incoming bandwidth (In:) alongside the passed-through output (Out:) while the simulation is running.",
  },
  {
    version: "1.0.482",
    date: "2026-08-06",
    summary: "Chassis nodes with multiple installed boards can now be collapsed to hide the board/port details and shrink the box - click the − / + icon in the node header.",
  },
  {
    version: "1.0.481",
    date: "2026-08-06",
    summary: "TAP-M100T and TAP-M200T trays now show their real photos in the Rack View, with drop bays overlaid on top.",
  },
];
