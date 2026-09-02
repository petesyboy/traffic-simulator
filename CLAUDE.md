# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive visual orchestration tool for demonstrating Gigamon network visibility pipelines. It simulates traffic flows through physical/logical hardware topologies, generates a Bill of Materials (BOM), and produces commercial quotes and PDF reports. It ships in two **editions** (see [Editions](#editions) below) and each build's output is a standalone single-file HTML app (no server required).

## Commands

```bash
npm run dev            # Start Vite dev server
npm run build           # Build the internal edition → dist/internal/ (alias for build:internal)
npm run build:internal  # Full internal edition: pricing, quoting, budgetary exports
npm run build:partner   # Sanitised partner/salesperson edition: BOM only, no pricing
npm run build:all       # Build both editions
npm run lint            # ESLint on TS/TSX
npm run test            # Vitest test suite
npm run format           # Prettier on src/
npm run format:check    # Check Prettier compliance
npm run preview          # Preview production build
npm run generate:data    # Regenerate src/data/skus.json from the WWPL price list (internal edition)
npm run checksums <path> # Checksum an arbitrary file on demand
```

Run a single test file:
```bash
npx vitest run src/utils/simulation.test.ts
```

`npm run build` runs `scripts/build-edition.mjs <edition>`, which: regenerates the changelog, ingests SKU data for that edition (`scripts/parse-skus.js --edition=...`), runs `tsc -b && vite build` with `VITE_APP_EDITION` set, then copies the single-file output into `dist/<internal|partner-edition>/traffic-reduction-simulator.html` (+ `index.html`) and checksums it. Building `partner` afterwards restores the internal SKU dataset and internal `dist/index.html` so the working tree is left in its normal (internal) dev state. `postbuild` also checksums the root `dist/index.html` via `scripts/generate-checksums.mjs`.

## Code Style

Prettier config (`.prettierrc`): single quotes, trailing commas, 120-char line width, 2-space indent, semicolons.

## Architecture

### Editions

`src/constants/edition.ts` defines `APP_EDITION: 'internal' | 'partner'`, baked in at build time from `import.meta.env.VITE_APP_EDITION` (defaults to `'internal'` in dev). Use `isInternalEdition()` / `isPartnerEdition()` to gate UI and logic:
- **internal** — full edition: BOM + commercial quotation engine (worldwide list pricing, discount schedule, budgetary quote PDF exports).
- **partner** — sanitised salesperson/partner demo edition: pure BOM/equipment manifest, no pricing or quoting surfaces.

`src/data/skus.json` is edition-specific — it's regenerated per build by `scripts/parse-skus.js --edition=<edition>` and is *not* meant to be hand-edited or assumed identical between editions.

### State Management (Zustand — sliced pattern)

`src/store/store.ts` composes 6 slices:

| Slice | File | Owns |
|-------|------|------|
| `GraphSlice` | `graphSlice.ts` | ReactFlow nodes, edges, canvas UI state |
| `SimulationSlice` | `simulationSlice.ts` | isRunning, speed, nodeMetrics, edgeMetrics, active/blocked/encrypted edges |
| `TrafficSlice` | `trafficSlice.ts` | Traffic stream definitions (bandwidth, VLAN, IP, port, protocol) |
| `SettingsSlice` | `settingsSlice.ts` | advancedMode, licenseMode (HTL/Perpetual), region, term duration |
| `UISlice` | `uiSlice.ts` | activeView (canvas/rack), demo step state, theme |
| `HistorySlice` | `historySlice.ts` | undo/redo stack over graph state |

### Node Type System

`src/constants/nodeTypes.ts` is the single source of truth for node type and action type string constants.

Nine node types: `inputNode` (SPAN/TAP/vTAP sources), `mapNode` (traffic map conditions), `filterNode`, `gigaSmartNode` (dedup, slicing, SSL decrypt, etc.), `gigaStreamNode` (load balancer), `toolNode` (Vectra/Splunk/S3 destinations), `groupNode`, `hardwareNode` (physical chassis), `clusterNode` (multi-chassis cluster). `MissionCloudNode`/`MissionPipelineNode` are presentation-only node renderers used by the guided Mission Demo, not entries in `NODE_TYPES`.

~40 GigaSMART action types defined as `ACTION_TYPES` in the same file.

### Simulation Engine

`src/utils/simulation.ts` — `calculateSimulationStep(nodes, edges, trafficStreams)` is the core function. It:
1. Initializes per-node metrics (rxMbps, txMbps, packets, dropped)
2. BFS-traverses the edge graph from each input node
3. Applies per-node processors from `src/utils/simulation/processors/` at each hop
4. Returns `SimulationStepResult` with metrics + sets of active/blocked/encrypted/decrypted edge IDs

The headless `SimulationEngine.tsx` component drives the loop via `setInterval`, dispatching `updateSimulationTick` to the store.

Node processors live in `src/utils/simulation/processors/` — one file per node type. Traffic matching helpers (VLAN/IP/port) are in `src/utils/simulation/matching.ts`.

### BOM Engine

`src/utils/bomEngine.ts` re-exports from `src/utils/bom/`: `bomGenerator.ts` (maps hardware SKUs to license SKUs, applies HTL vs. Perpetual licensing mode, term duration multipliers, transceiver auto-suggestion), `configValidator.ts` (fiber-mode/optic mismatch checks), `physicalItems.ts`, `consolidateSimpleDevices.ts`, `siteValidation.ts`, and `skuUtils.ts`.

**Double-optic rule**: every tapped link is bidirectional (northbound + southbound), so each connected port requires two optics (SFP/QSFP depending on fiber type and speed) — the BOM engine always doubles optic quantity for connected ports; don't "fix" this into single-counting.

**Breakout panels**: a breakout panel (single- or multi-mode, e.g. `PNL-M341`, `PNL-M343`) occupies one slot in an M100T (3 slots) or M200T (6 slots) tray alongside optical TAPs — account for this when validating tray capacity.

**SKU/board lookups must be case-insensitive**: the same module SKU is hand-typed independently in `hardwareCatalogue.json`, `opticRules.json`, and the SKU catalogue, and casing has drifted between them before (e.g. `PRT-HC1-x12` vs `PRT-HC1-X12`, `SMT-HC3-c08` vs `SMT-HC3-C08`) — an exact-match `find` on one of these silently resolves to nothing, so an installed module adds zero ports/BOM rows with no error. Always look up a catalogue module by SKU via `findModuleBySku()` in `src/utils/hardwareUtils.ts` (or another case-insensitive comparison) rather than a fresh `===`/`.find()`. `src/utils/ports.test.ts` has a regression test that cross-checks every `opticRules.json` board name against the catalogue — run it after editing either file.

### SKU Catalogue, Pricing & Quoting

`src/data/skus.json` is the current single source of truth for SKU descriptions, pricing, and lifecycle (EOS/EOL/replacement) data — generated by `scripts/parse-skus.js` from the Worldwide Price List (WWPL) Excel workbook in `references/`, per edition. (`src/constants/skus.json`, generated by the older `scripts/parse_skus.py`, is a legacy artifact only still referenced by a couple of tests — don't treat it as current.)

- `src/services/skuService.ts` — typed access layer over the catalogue; merges in any active runtime overrides.
- `src/utils/skuOverrides.ts` — runtime override/rollback layer, driven by the Advanced Mode **price list upload** feature (an xlsx workbook parsed in-browser via `priceListParser.ts`; no rebuild needed — see `SkuUpdateModal.tsx`).
- `src/utils/pricingEngine.ts` — computes quote line pricing (discounts, term multipliers) on top of the BOM.
- `src/utils/projectQuoteStorage.ts` — persists a per-project "quote workspace" (discounts, overrides, notes) separately from the graph/BOM state; bundled into `.gvp` project exports as `quoteWorkspace`.
- `src/utils/bomToQuoteValidation.ts` — validates BOM output is quote-ready.
- These surfaces (and the `QuoteModal`/`SkuUpdateModal` header modals) are internal-edition only — see [Editions](#editions).

### Reporting Engine

`src/utils/report/` builds PDF documents via `pdfmake`, triggered from the `ReportModal` (Header). Key builders: `buildReportDocDefinition.ts` (solution package), `quotePdfReport.ts`, `patchSheetReport.ts`, `crossoverReport.ts`. `describeTopology.ts`/`describeTapLink.ts`/`gigaSmartDescriptions.ts`/`toolDescriptions.ts`/`chassisDescriptions.ts` turn graph state into narrative report text; `graphTrace.ts` walks the topology for report purposes; `markdownToPdfmake.ts` converts markdown blocks into pdfmake content nodes.

Image capture for reports uses `html-to-image`: `captureTopologyDiagram.ts` (canvas diagram), `captureRackElevation.ts` (rack view), `captureChassisFrontPanel.ts` (composited chassis photo + installed-module icons).

`uplinkReport.ts` still exists but is currently **not** wired into the active Report modal or the solution package export — don't assume it's reachable from the UI.

### Key Constants

- `src/constants/hardwareCatalogue.json` — hardware models with port capacity, power supply type
- `src/constants/gigaSmartRules.ts` — which GigaSMART actions map to which software SKUs
- `src/constants/opticRules.json` — SFP/QSFP specs, fiber modes, part numbers
- `src/constants/tapOpticRules.ts` / `gsaOptics.ts` — TAP monitor-output optic compatibility and GigaSMART-app optic rules
- `src/constants/toolIngestLimits.ts` — per-tool ingest bandwidth caps
- `src/constants/presets.ts` — pre-built demo scenarios (nodes + edges + traffic streams)
- `src/constants/edition.ts` — internal/partner edition flags (see [Editions](#editions))

### Component Layout

```
App
├── Header             — save/load slots, BOM/Quote/Report modals, settings, view toggle
├── SaveSlotModal       — multi-slot save/load (rendered at App level, not inside Header)
├── Sidebar             — drag-and-drop node palette
└── main-content
    └── ReactFlowProvider
        ├── TradeShowDemo       — guided step-by-step demo walkthrough
        ├── MissionDemo         — guided "mission" narrative demo (cloud/pipeline nodes)
        ├── CanvasArea          — ReactFlow canvas with custom node/edge renderers
        ├── ConfigPanel         — right sidebar for editing selected node properties
        ├── SimulationEngine    — headless interval loop
        ├── TrafficGenerator    — manual traffic stream UI
        └── RackElevationView   — physical rack layout (Advanced Mode only; replaces CanvasArea when activeView === 'rack')
```

Config panels for each node type are in `src/components/config-panels/`. Hardware-specific sub-panels (slots, optics, power, GigaSMART apps) are in `src/components/config-panels/hardware/`. Header modals (`src/components/header/`) include `BomModal`, `QuoteModal`, `ReportModal`, `SkuUpdateModal`, `ProjectSettingsModal`, `SaveSlotModal`, `DuplicateModal`, `MixedSiteConfirmModal`, `ProjectNamePromptModal`, `ConfirmModal`, `AboutModal`.

### Save/Load System

Canvas state auto-saves (debounced) to `localStorage['fm-simulator-autosave']`; the legacy `fm-simulator-default-file` key is still read as a fallback on first load. Named slots use `fm-simulator-slot-<name>` (up to 5), with `fm-simulator-last-slot` tracking the most recently used one. The save payload includes nodes, edges, trafficStreams, and relevant settings.

JSON export/import (`.gvp` files) is also supported for sharing topologies via file — the exported payload additionally bundles the project's quote workspace (see [SKU Catalogue, Pricing & Quoting](#sku-catalogue-pricing--quoting)) via `projectQuoteStorage.ts`.

### View Modes

- **Canvas View** — logical flow diagram (default, all users)
- **Rack View** — physical chassis elevation (`advancedMode` only)
- **Presentation Mode** — double-click any node to add pulsing orange glow; click background to clear

### Keyboard Shortcuts

- `Ctrl/Cmd+S` — open save modal
- `Ctrl/Cmd+Z` — undo
- `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` — redo
- `Space` — toggle simulation run/pause
- `M` — mirror selected nodes between left-to-right and right-to-left flow
- `Delete/Backspace` — delete selected nodes (ReactFlow native)

## Project Conventions

- **Versioning**: bump the patch version in `package.json` with every change (`1.0.x` → `1.0.x+1`).
- **Commit subjects are release notes**: `scripts/generate-changelog.mjs` runs on `prebuild` and turns each commit into a changelog entry shown in the app's About dialog (click the version number in the header). It pairs a commit with the version in *that commit's* `package.json`, so the versioning rule above is what makes it work. Write subjects that read well to a user. Exclude a commit by prefixing it `chore:`/`test:`/`ci:`/`docs:`/`build:`/`style:`/`refactor:` or adding `[skip changelog]`. To override the wording, or to describe work not yet committed, add an entry to `scripts/changelog.manual.json` — it wins over the generated text for that version. `src/constants/changelog.ts` is generated; don't hand-edit it.
- **Checksums**: builds automatically checksum their single-file HTML output (`scripts/generate-checksums.mjs`, run both via `postbuild` on `dist/index.html` and again inside `build-edition.mjs` on each edition's deliverable) so a user can verify their copy hasn't been altered or corrupted. Every shipped deliverable copy (`traffic-reduction-simulator.html`, the versioned `-<rev>.html`, and the OneDrive copy) is a byte-identical copy of the build output, so when shipping, copy the matching `.checksums.txt` alongside each one as `<filename>.checksums.txt` rather than regenerating it. Run `npm run checksums <path>` to checksum an arbitrary file on demand.
- **British English**: use British spelling in all node tooltips and user-facing copy (e.g. "analyse", "optimise", "colour").
- **Number inputs**: don't validate integer bounds inside `onChange` for `<input type="number">` — deleting a digit briefly yields `""`/`NaN` and an eager check will reset the field. Track the raw string in state and defer `parseInt`/bounds validation to submit (button click) or use a `<select>` for small bounded ranges.
