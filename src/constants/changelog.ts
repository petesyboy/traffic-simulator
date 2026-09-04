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
  {
    version: "1.0.737",
    date: "2026-09-03",
    summary: "Redundant links into the DWDM optical ring are now accepted. A second link between the same chassis and the ring was treated as an accidental duplicate and silently dropped, which made a 1+1 protected ring impossible to draw - the working and protection paths run between exactly the same pair of endpoints. Parallel links to the transport ring are now allowed, so each site can take its own working and protection pair in both directions, drawn as separate fanned curves and labelled Link 1/2 and Link 2/2. There is no fixed limit on how many a ring can carry.",
  },
  {
    version: "1.0.736",
    date: "2026-09-03",
    summary: "The data centre title bar is now a handle for the whole site. Drag it to carry every device in that data centre across the canvas together, or click it to select the site so the flow direction control turns all of its equipment round at once - no more dragging or picking equipment one piece at a time. A drag is a single undo step, and clicking to select never enters the history at all.",
  },
  {
    version: "1.0.735",
    date: "2026-09-03",
    summary: "Restored smooth curved links in right-to-left layouts. A link that ran against its own flow was routed as a stepped path looping under the row, but that was decided purely on the source sitting to the right of the target - which in a mirrored layout is every link, so they all turned square and collided. It now reads the side the source's egress handle sits on, so a mirrored link flowing right-to-left keeps the curve it had before, and a genuine backhaul link still loops under whichever way round the layout reads.",
  },
  {
    version: "1.0.734",
    date: "2026-09-03",
    summary: "Tidy Layout now understands mirrored nodes, and the configuration panel works on a whole selection. Laying out a right-to-left node used to put it in its usual left-to-right column, so every link into it doubled back; a mirrored chain is now laid out with its sources on the right and its tools on the left, the order its handles actually point in. Mirroring one node pulls the neighbours it feeds the same way round, so the picture stays consistent, and locking a node left-to-right pins the boundary. Selecting several nodes now opens a panel showing what is selected and lets you set the flow direction for all of them at once.",
  },
  {
    version: "1.0.733",
    date: "2026-09-03",
    summary: "Added a flow direction control for the whole selection: hold Ctrl (or Shift-drag a box) to pick several nodes, then set them all left-to-right, right-to-left or Auto in one click from the canvas toolbar. The control shows how many nodes it will change, and highlights a direction only when the whole selection already agrees, so a mixed selection is obvious at a glance.",
  },
  {
    version: "1.0.732",
    date: "2026-09-02",
    summary: "Fixed mirrored nodes so their links actually follow the handles: flipping a node between left-to-right and right-to-left now forces ReactFlow to re-measure that node, so every connected link re-routes to the new side instead of continuing to point at where the handle used to be.",
  },
  {
    version: "1.0.731",
    date: "2026-09-02",
    summary: "Added left-to-right / right-to-left flow direction for nodes: any node's input and output handles can now be mirrored so a pipeline reads either way, via a Flow Direction control in the node configuration panel, a Mirror button on the canvas toolbar, and the M keyboard shortcut for the current selection. A hand-picked direction is locked so automatic layout leaves that choice alone.",
  },
];
