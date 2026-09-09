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
  {
    version: "1.0.750",
    date: "2026-09-04",
    summary: "Restore single-click selection for canvas nodes and auto-select on drop (v1.0.750)",
  },
  {
    version: "1.0.749",
    date: "2026-09-04",
    summary: "Preserve Swedish and international letters in export file names (v1.0.749)",
  },
  {
    version: "1.0.748",
    date: "2026-09-04",
    summary: "Distinguish DWDM in and out handles with I/O labels, distinct colours, and legend",
  },
  {
    version: "1.0.747",
    date: "2026-09-04",
    summary: "Anchor DWDM connector handles strictly to outer perimeter",
  },
  {
    version: "1.0.746",
    date: "2026-09-04",
    summary: "Enforce min site enclosure width to prevent obscuring single TAPs & add instant DWDM ring wizard (v1.0.746)",
  },
  {
    version: "1.0.744",
    date: "2026-09-03",
    summary: "Add 1-click conversion from central DWDM hub to per-site gateways with optical ring (v1.0.744)",
  },
  {
    version: "1.0.743",
    date: "2026-09-03",
    summary: "Support per-site DWDM gateways, 2D triangular multi-site layout, and inter-DWDM transport spans (v1.0.743)",
  },
  {
    version: "1.0.742",
    date: "2026-09-03",
    summary: "Arrange TA200 QSFP cages into two stacked rows of 32 for realistic narrow chassis profile (v1.0.742)",
  },
  {
    version: "1.0.741",
    date: "2026-09-03",
    summary: "Resolve chassis collision into SPAN ports and refine multi-site column spacing (v1.0.741)",
  },
  {
    version: "1.0.740",
    date: "2026-09-03",
    summary: "2D site-aware multi-site tidy layout with central transport hub placement and site-bounded flow direction (v1.0.740)",
  },
  {
    version: "1.0.739",
    date: "2026-09-03",
    summary: "Added a Colour Vision setting for red-green colour vision deficiency. Project Settings now offers a red-green friendly palette that moves the status greens to blue, so they read against the reds they are paired with across the canvas, the node panels, the BOM and the quote. Reds are left as they are, since red stays visible - it is the red-against-green pairing that carries no information. The choice is saved for you rather than with the project, so it follows you into someone else's topology; PDF exports still use the standard palette.",
  },
  {
    version: "1.0.738",
    date: "2026-09-03",
    summary: "The DWDM ring now shows you where a link can land. Its eight ports looked identical, so there was no way to tell an ingress from an egress before letting go. Dragging a link now lights up in green, and enlarges, only the ports that can accept it - the ingress ports when you drag from a chassis output, the egress ports when you drag from an input - and dims the rest, with a prompt on the ring itself. Hovering any port names what it takes and which direction it faces.",
  },
];
