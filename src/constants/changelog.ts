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
  {
    version: "1.0.480",
    date: "2026-08-06",
    summary: "Rack View now shows real chassis photos with installed boards instead of generic bars. TAP-M100T/M200T trays can be racked and individual tap modules dropped into their bays.",
  },
  {
    version: "1.0.479",
    date: "2026-08-06",
    summary: "Fixed the GigaVUE-HCT front-panel graphic - installed modules now composite onto the chassis photo like HC1/HC1-Plus/HC3, instead of leaving the blanking mesh visible.",
  },
  {
    version: "1.0.478",
    date: "2026-08-05",
    summary: "Node configuration sections are now much easier to tell apart - every section heading (hardware, module slots, cages, optics, power) uses one larger amber style with an underline and icon.",
  },
  {
    version: "1.0.477",
    date: "2026-08-05",
    summary: "Fixed HC1/HC1-Plus/HC3 canvas nodes showing the chassis photo twice - the small header icon now only appears for hardware without a front-panel graphic (e.g. TA-series).",
  },
  {
    version: "1.0.476",
    date: "2026-08-05",
    summary: "The build info dialogue now shows a larger version number and just the last two changes.",
  },
];
