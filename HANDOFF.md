# Handoff — GigaSMART Licensing, HC Capacity/Optics Calibration, UI Polish

**Date:** 2026-08-11
**Repo state:** clean, all work committed and pushed to `origin/main`
**Current version:** `1.0.517` (see `package.json`)
**Latest commit:** `2d25205` — "Fix FlowVUE/GTP licensing: allow combining, model the real per-mode rule"
**Full commit range this handoff covers:** `53456c8..2d25205` — `git log --oneline 53456c8..HEAD` for the complete list; details of each change live in the commit messages themselves (all descriptive, not `wip`/`fix` one-liners), not repeated here.

This file supersedes the previous `HANDOFF.md` (which stopped at `53456c8` / v1.0.508). Read `CLAUDE.md` first for architecture/conventions — this file is session memory, not a spec.

---

## What shipped since the last handoff (v1.0.509 → v1.0.517)

One-line-each; see the commit for the full story:

| Version | Commit | What |
|---|---|---|
| 1.0.509 | `0b5e0f1` | Routed remaining direct `skus.json` imports through `getMergedSkus()`, added lint+test to the deploy workflow, fixed a hardware-panel crash rendering array-typed port specs |
| 1.0.510 | `923c321` | Fixed manually-added optics getting silently absorbed into (and discarded from) the auto-managed optic pool on the next sync |
| 1.0.511 | `f3b4ad6` | Fixed HC1-Plus/HC3 "Maximum Possible Capacity" figures; taught the calculator to model MPO breakout panel fan-out (1 QSFP cage → 4 lanes), matching Gigamon's own datasheet |
| 1.0.512 | `09aec79` | Fixed `getPortOpticMap`'s cross-board fallback landing optics on the wrong module; added the first optic-occupancy overlay to the HC1 front-panel graphic |
| 1.0.513 | `f473323` | Extended the overlay to HC1-Plus + the HC3 module family; switched the "fitted" marker from a green outline to a blue box + checkmark (colour-vision accessibility) |
| 1.0.514 | `919b70b` | Fixed BOM silently omitting a licence for IP FlowVUE / GTP GigaSMART functions (SKUs existed, engine had no mapping) |
| 1.0.515 | `88d0899` | Renamed disk Save/Load buttons to Export/Import |
| — | `0f647e0` | Stopped tracking `.obsidian/*` vault state files (repo doubles as the user's Obsidian vault) |
| 1.0.554 | `49208a1` | Added site assignment consistency verification modal before generating BOM or PDF reports |
| 1.0.555 | `0a8c2f1` | Implemented isolated core math engine (`calculator.ts`), build-time CSV data ingestion pipeline (`parse-skus.js`), typed data service (`skuService.ts`), Vitest test suite with coverage, and CI/CD test automation |

---

## Open items / likely next asks

1. **Front-panel optic overlay coverage is partial.** Calibrated: `GigaVUE-HC1` (base + `PRT-HC1-Q04X08` + `PRT-HC1-X12`), `GigaVUE-HC1-Plus` (base), `PRT-HC3-X24`, `PRT-HC3-C16`/`SMT-HC3-C16`, `PRT-HC3-C08Q08`/`SMT-HC3-C08Q08`, `SMT-HC3-C08`, `SMT-HC3-C05`. **Not calibrated**: `GigaVUE-HCT`, any TA-series chassis, and the `BPS-HC1-*`/`BPS-HC3-*` bypass modules (their images show fixed bypass connectors, not standard pluggable cages — deliberately skipped rather than guessed). If asked to extend further, the method that worked: load the catalogue PNG into an in-browser `<canvas>`, run connected-component blob detection to find exact cage pixel bounds (see `f473323`'s description and the earlier turns in this conversation for the technique), don't eyeball coordinates.
2. **`PRT-HC3-C08Q08`'s upper/lower row split was initially guessed wrong** (left/right cluster instead of the real upper-8/lower-8 physical layout) and had to be corrected once the user supplied the real Gigamon KB text. If another module's QSFP28/QSFP+ split is ambiguous from the image alone, ask rather than guess a plausible-looking split — this class of assumption is easy to get backwards.
3. **`GTP Rotational Sampling` has no canonical GSOP name** in `getCanonicalGsopName()` (`src/constants/gigaSmartRules.ts`) — `areActionsCompatible()` treats it as compatible with everything via the "unknown action" fallback, and it wasn't included in the FlowVUE-dependency fix in v1.0.517 (the user only described whitelisting and flow-sampling's licensing rule, not rotational sampling's). If asked to make it behave like the other three, that's the pattern to extend.
4. **Applications palette still only exposes 8 of 40+ `ACTION_TYPES`** as drag targets (`appsList` in `src/components/Sidebar.tsx`): Application Metadata, Deduplication, Load Balancing, Masking, Slicing, SSL Decrypt, IP FlowVUE, GTP Flow Filtering. GTP Whitelisting and GTP Flow Sampling — despite now having full BOM/compatibility support — still have **no way to be dragged onto a chassis at all**. The user explicitly scoped v1.0.516 to just FlowVUE + GTP Flow Filtering; if they come back needing the other two GTP variants, it's the same `appsList` + `AppIcon` (`src/components/Icons.tsx`) pattern.
5. **Carried forward, still true, still unaddressed** (from the previous handoff): `ToolNodePanel.tsx` GSA-specific fields aren't gated to Advanced Mode in Standard View; `syncOpticsOnTapConnection` doesn't count chassis-to-chassis/chassis-to-map link optic needs (by design, flagged as a gap); `filterNodeCount` doesn't get the same TA/HC-chassis-implies-a-filter credit that `mapNodeCount` does; bundle size is still ~5.6MB.

---

## Key gotchas (durable — still true, worth knowing before touching this code again)

- **A TAP can be modelled two ways** (standalone `inputNode` vs. a `hardwareNode` with `"TAP"` in its model) — anything walking nodes looking for TAPs must check both. Bit the report code three times across sessions.
- **Two independent port-fill algorithms** (`getPortOpticMap()` in `ports.ts` decides optic→port; `syncPortAssignments()`/`allocatePorts()` in `portSync.ts` decides edge/link→port) only agree via explicit pinned-port reservations each checks separately. `getPortOpticMap`'s non-pinned fallback logic was the source of the v1.0.512 bug (checked "do *other* boards have optics of their own" instead of "does *this* optic's own board still exist") — if a future bug looks like optics landing on the wrong board/module, start here.
- **SKU/board lookups must stay case-insensitive** — always `findModuleBySku()`, never a raw `===`/`.find()` (`hardwareUtils.ts`).
- **GigaSMART licensing is per-card, not per-action** — `resolveGsLicenseSkus()` in `bomGenerator.ts` (added v1.0.517) dedupes via a `Set<string>` before calling `addRow`, specifically so an implied dependency (e.g. FlowVUE required alongside GTPMAX) doesn't get double-counted if the user *also* explicitly adds the dependency as its own app. Any future "action X implies licence Y" rule should go through this same Set-based path, not a second `addRow` call.
- **Catalogue data (`hardwareCatalogue.json`, `opticRules.json`, `skus.json`) drifts from itself** — this whole session was largely spent finding and fixing places where these three hand-maintained files disagreed (wrong port types/speeds, missing SKU mappings, wrong compatibility rules). When a user reports something that "should just work" per Gigamon's real behaviour, check whether the three files actually agree with each other before assuming the bug is in application logic.

---

## Testing/verification environment gotchas (this session, likely to recur)

- **`computer{action:"screenshot"}` does not work in this sandbox** ("Browser pane is not displayed"). Don't rely on it.
- **Dynamically importing `store.ts` via `javascript_tool`'s `import()` creates a disconnected Zustand instance**, even without a `?fresh` cache-busting param — state mutations through it silently don't affect the live page. This cost significant debugging time this session before being identified. For anything that needs to actually change the live app's rendered state (adding nodes, toggling `advancedMode`, etc.), use **real synthetic DOM events** instead:
  - Drag-and-drop: build a `DataTransfer`, dispatch `dragstart` on the source element, then `dragover`+`drop` on the **actual drop target container** (e.g. `.react-flow__pane` directly — `document.elementFromPoint()` can hit an inner SVG layer that doesn't bubble to the right handler, as happened mid-session).
  - Toggling `advancedMode`: the real 4-click-in-2-seconds gesture is hard to hit reliably via scripted clicks; the workaround used was temporarily flipping the *default* in `settingsSlice.ts` (`advancedMode: true, advancedModeUnlocked: true`), reloading, doing the real work with genuine clicks/drags, then reverting the default before shipping. Always verify the revert with `git diff` before committing.
- **Read-only calculations are fine via the disconnected-instance import** (e.g. calling exported pure functions like `getMaxChassisCapacityBySpeed`) — the gotcha only bites when you need the mutation to show up in the live DOM.
- **Visual verification pattern that worked well**: for pixel-calibrated overlays, build a standalone HTML file compositing the real catalogue images + computed overlay boxes (Node script reading the PNGs as base64, no browser needed), publish via the `Artifact` tool, and send it to the user alongside a plain-English description of what to check. Faster and more reliable than fighting the live app for a screenshot.

---

## Standing project conventions (from `CLAUDE.md`, unchanged)

- Version bump every change (`package.json`), changelog entry in `scripts/changelog.manual.json`.
- Ship sequence: bump version → changelog entry → `npm run build` → update `traffic-reduction-simulator.html` + versioned `-<rev>.html` (delete old, add new) → copy to `D:\Users\msn\OneDrive - Gigamon\OneDrive - Gigamon Inc\SE Tools\traffic-reduction-simulator.html` → `git add` **specific files only** (repo root has unrelated Obsidian-vault files — `.obsidian/` is now gitignored as of `0f647e0`, but `references/icons/`, `support programs/` etc. are still untracked-on-purpose, leave them alone) → commit with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` → **push only when explicitly asked**, separately from "ship it".
- `npx tsc -b`, `npm run test`, `npm run lint` before every ship. This session added no new prettier drift issues; the pre-existing CRLF drift noted in the previous handoff is still there and still not this session's concern.
- British English in all user-facing copy.

---

## Suggested skills for the next session

- **`run`** — for launching the dev server and driving the app to verify a change actually works, rather than reasoning about it from source alone. Given the store-import gotcha above, prefer this (or direct `preview_start` + real DOM events) over any approach that imports `store.ts` for mutation.
- **`artifact-design`** — if the next task involves building another visual verification aid (overlay checks, before/after comparisons) — the pattern established this session (composite real assets into a standalone HTML page, publish as an Artifact) is worth reusing rather than re-deriving.
- **`review`** (or `/code-review ultra` for a bigger multi-file change) — worth running before shipping if the next session's change touches the licensing/compatibility logic again (`gigaSmartRules.ts`, `bomGenerator.ts`) given how many subtle correctness bugs turned up there this session — a second pass is cheap insurance in this specific area.
