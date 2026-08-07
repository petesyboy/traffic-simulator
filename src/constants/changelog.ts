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
  {
    version: "1.0.475",
    date: "2026-08-05",
    summary: "Audited every module SKU lookup for case-sensitivity bugs like the PRT-HC1-X12 fix - found and fixed the same issue on SMT-HC3-C08, and made all catalogue lookups case-insensitive so it can't recur.",
  },
  {
    version: "1.0.474",
    date: "2026-08-05",
    summary: "Fixed the PRT-HC1-X12 port module not adding its 12 ports when installed - a mismatched SKU casing kept it from being recognised.",
  },
  {
    version: "1.0.473",
    date: "2026-08-05",
    summary: "Fixed HC1/HC1-Plus/HC3 canvas nodes rendering far larger than other appliances - the front-panel graphic is now capped to a consistent size.",
  },
  {
    version: "1.0.472",
    date: "2026-08-05",
    summary: "HC1/HC1-Plus/HC3 canvas nodes now show the same front-panel graphic as the hardware summary, alongside the live port status. Fixed the title icon stretching wide chassis nodes far past others.",
  },
  {
    version: "1.0.471",
    date: "2026-08-05",
    summary: "Fitted modules now align exactly to their chassis bay on the HC1, HC1-Plus and HC3 front panels, fully covering the blanking panel's honeycomb mesh.",
  },
  {
    version: "1.0.470",
    date: "2026-08-05",
    summary: "The hardware summary's front panel is now larger, and clicking it opens a full-size view with a slot legend — big enough to count individual ports.",
  },
  {
    version: "1.0.469",
    date: "2026-08-05",
    summary: "Clicking the version number now opens build information and recent release notes instead of a GitHub link.",
  },
  {
    version: "1.0.468",
    date: "2026-08-05",
    summary: "Moved the module slot selectors from the Optics tab into the General tab, alongside the hardware specifications.",
  },
  {
    version: "1.0.467",
    date: "2026-08-05",
    summary: "Hardware summary now draws a front-panel view with each installed module pictured in its real slot position.",
  },
];
