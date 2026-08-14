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
    version: "1.0.521",
    date: "2026-08-14",
    summary: "Mission Demo now has a visible payoff at the pipeline: it drops a legacy VLAN 999 noise stream and deduplicates the rest (25%) on its own onboard engine, so the node's In/Out numbers and the dashboard's Deduped/Filtered figures actually move. Also removed the \"HC1-Plus\" model label from the pipeline node for this demo, since it's meant to represent the concept, not a specific appliance.",
  },
  {
    version: "1.0.520",
    date: "2026-08-14",
    summary: "Mission Demo polish: the Deep Observability Pipeline node is now bigger with its own zoomed-in reveal so its label is actually readable; suppressed the false \"Ingest Overloaded\" warnings the ten generic tool nodes triggered the instant traffic started (they had no vendor ingest profile, so they defaulted to a 10 Gbps ceiling against the demo's ~27 Gbps fan-out); hid the Bill of Materials button while the demo is running; and made the Mission Demo button visible in Standard View so it no longer requires switching to Advanced Mode first.",
  },
  {
    version: "1.0.519",
    date: "2026-08-14",
    summary: "Mission Demo: the infrastructure and tool icons were too small to read at the initial zoom level, so the camera now zooms into readable-sized groups (routers/core/dist switches, then Access1-8, then the first 5 tools, then the remaining 5) with a status line naming each one, before pulling back to show the full before/after transformation.",
  },
  {
    version: "1.0.518",
    date: "2026-08-14",
    summary: "Added a second auto-playing demo, \"Mission Demo\", based on the \"Our Long-Time Mission\" sales slide: animates a chaotic network (routers, core/dist/access switches wired directly to 10 separate point security tools with crossing connections) collapsing into a single Gigamon Deep Observability Pipeline with one clean connection per tool, then runs the traffic simulation to show it working end to end before looping. Toggled independently from the existing Auto Demo via a new header button in Advanced Mode.",
  },
  {
    version: "1.0.517",
    date: "2026-08-11",
    summary: "Fixed GigaSMART compatibility rules that wrongly refused combining FlowVUE with GTP Flow Filtering/Whitelisting/Flow Sampling on the same Gen3 card - per Gigamon's KB, they're separate entitlements that can coexist. Also modelled the licensing correctly: GTP whitelisting always needs both GTPMAX and FlowVUE, and GTP flow sampling needs both for any sample rate strictly between 0% and 100% (0% or 100% needs GTPMAX alone) - added a sample-rate control to the GigaSMART app panel that shows the licensing impact live.",
  },
  {
    version: "1.0.516",
    date: "2026-08-11",
    summary: "Added IP FlowVUE and GTP Flow Filtering to the Applications palette, so they can be dragged onto an HC chassis like any other GigaSMART function and picked up correctly in the Bill of Materials.",
  },
  {
    version: "1.0.515",
    date: "2026-08-11",
    summary: "Renamed the disk save/load buttons to Export and Import, to better describe what they do (Browser Save/Browser Load are unchanged).",
  },
  {
    version: "1.0.514",
    date: "2026-08-11",
    summary: "Fixed the BOM silently omitting a license when a GigaSMART app was set to IP FlowVUE or any GTP function (Flow Filtering, Rotational Sampling, Whitelisting, Flow Sampling) - the SKUs existed but the BOM engine had no mapping for those functions. Now correctly quotes the FlowVUE or GTP Filtering & Correlation (GTPMAX) license per chassis and license mode.",
  },
  {
    version: "1.0.513",
    date: "2026-08-11",
    summary: "Extended the front-panel optic-occupancy overlay to GigaVUE-HC1-Plus and the GigaVUE-HC3 module family (PRT-HC3-X24, PRT-HC3-C16, PRT-HC3-C08Q08, SMT-HC3-C08, SMT-HC3-C05). Also switched the \"fitted\" marker from a green outline to a blue box with a checkmark, so it reads clearly under red-green colour vision deficiency and doesn't rely on colour alone.",
  },
  {
    version: "1.0.512",
    date: "2026-08-10",
    summary: "Fixed a bug where installing optics against a chassis module (e.g. a second board in Slot 3) could silently land them on a different, currently-fitted module's still-empty cages instead (e.g. Slot 2) - the port assignment logic mistook an installed-but-optic-free board for one that had been swapped out. Also added an optic-occupancy overlay to the HC1 front-panel graphic in the chassis summary dialog, showing which cages are actually fitted (currently calibrated for the base chassis plus the PRT-HC1-Q04X08 and PRT-HC1-X12 modules).",
  },
  {
    version: "1.0.511",
    date: "2026-08-10",
    summary: "Fixed the HC1-Plus, HC3 and HCT \"Maximum Possible Capacity\" figures in the chassis summary dialog, which understated 100G/40G capacity (built-in HC1-Plus ports were mistyped as non-25G/100G-capable) and 10G/25G capacity (didn't account for feeding QSFP cages through an external MPO breakout panel, 4 lanes per cage - the same technique Gigamon's own datasheet uses for its higher figures). All four HC chassis now match the published datasheet exactly.",
  },
  {
    version: "1.0.510",
    date: "2026-08-09",
    summary: "Fixed the real cause of the missing-optic error coming back after a fix: adding an optic to cover a port with no transceiver could get silently merged into (and then discarded by) the chassis's auto-managed optic pool on the next save/reload, capping the total at whatever the TAP-derived requirement alone needed. Manually-added optics are now kept separate from that pool and always count in full.",
  },
  {
    version: "1.0.509",
    date: "2026-08-08",
    summary: "The Tapped Links panel and hardware node config panel now read SKU descriptions through the same price-list-aware lookup the BOM uses, so an uploaded price list updates them immediately instead of only affecting BOM output. Also fixed a crash when expanding a chassis's Hardware Specifications (a port-count field was rendered as a raw object instead of a summary), and added lint and test steps to the GitHub Pages deploy workflow so a broken build no longer ships.",
  },
  {
    version: "1.0.508",
    date: "2026-08-08",
    summary: "Restyled the General/Optics/GigaSMART Apps tabs on a chassis node's config panel (both TA and HC series) as proper underlined tabs with larger, bolder text, instead of small hard-to-notice pill buttons.",
  },
  {
    version: "1.0.507",
    date: "2026-08-08",
    summary: "Simplified the hardware node configuration panel in Standard View: it now shows just the node label, a compact model/SKU line, and Traffic Map filter rules, with a note pointing to Expert Designer (Advanced Mode) for board slots, chassis/licensing settings, deployment site, optics, and GigaSMART apps. Advanced Mode is unchanged.",
  },
  {
    version: "1.0.506",
    date: "2026-08-08",
    summary: "Decluttered Standard View: Duplicate, Auto Demo, Screenshot and Generate Report have moved to Expert Designer (Advanced Mode) only, so the header stays focused on basic simulation and save/load in simple mode. All four remain exactly where they were in Advanced Mode.",
  },
  {
    version: "1.0.505",
    date: "2026-08-08",
    summary: "Fixed a chassis port-assignment bug where a link with no pinned port (e.g. a SPAN feed sharing a chassis with pinned/TAP-fed optics) could silently land on a different physical port every time the topology was saved and reloaded - stranding a manually-fitted transceiver and moving the \"missing transceiver\" BOM warning to a new port each time instead of staying put. Port assignments now stay put across reloads unless the topology actually changes.",
  },
  {
    version: "1.0.504",
    date: "2026-08-08",
    summary: "Fixed two PDF report gaps: a tool's \"Traffic originates from\" line now credits a TAP modelled as its own hardware unit alongside any SPAN/other inputs feeding the same tool (it was being silently dropped), and GigaSMART functions running as an onboard app on a chassis or GSA tool (e.g. deduplication configured directly on an HC1) now get their own description in the GigaSMART Processing section instead of being omitted entirely.",
  },
  {
    version: "1.0.503",
    date: "2026-08-08",
    summary: "The PDF report's Hardware section now shows each TA/HC chassis's front-panel photo, with installed modules composited into their real slot positions, underneath its description - the same graphic shown in the on-canvas hardware summary popup.",
  },
  {
    version: "1.0.502",
    date: "2026-08-07",
    summary: "Fixed the PDF report's Traffic Maps count: every TA/HC chassis runs its own onboard flow map even without a separate Map node dragged out for it, so each one now counts alongside any explicit Traffic Map nodes. Also removed the Total Simulated Traffic line from the Executive Summary.",
  },
];
