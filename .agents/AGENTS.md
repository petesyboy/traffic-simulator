# Antigravity IDE Agents Rules

## Versioning
- **CRITICAL RULE**: Anytime we make a change to the software, increment the release number in `package.json` (e.g., from `1.0.0` to `1.0.1`, `1.0.2`, etc.). The user specifically requested to increment the release number by `1.01`, `1.02`, `1.03` etc., which maps to standard SemVer patch increments like `1.0.1`, `1.0.2`, `1.0.3`.

## Commit & Push Workflow
- **CRITICAL RULE**: Anytime changes are completed, tested, and built, do NOT automatically commit or push. Instead, provide the suggested commit message and version number in the response, explicitly state that the changes have NOT been committed or pushed to GitHub yet, and ask: *"Would you like to commit and push these changes to GitHub?"*
- **CRITICAL RULE**: Only when the user confirms or requests to commit/push, stage all files (`git add .`), commit with the approved message, and push directly to `origin main` (`git push origin main`). In the confirmation response, include the commit hash, version number, and the commit message summary.


## Hardware Node Rules
- **CRITICAL RULE**: Every tapped link produces two outputs. A simplex cable is required to go into an SFP or QSFP depending upon fiber type and speed on a TA or HC unit. Because traffic is northbound and southbound, there are two optics required for each tapped link.

## React Number Inputs
- **CRITICAL RULE**: Do not aggressively validate integer bounds inside `onChange` handlers for React `<input type="number">` fields. When a user deletes a number, the value temporarily becomes an empty string, which evaluates to `NaN` and triggers a fallback reset if validated immediately. Instead, track the input state as a raw string and defer `parseInt()` and bounds validation to form submission (e.g., button clicks) or use a `<select>` dropdown for small bounded ranges.

## British English Spelling
- **CRITICAL RULE**: For all tooltips on the nodes and anywhere else in this project, use British English spelling conventions (e.g., "analyse" instead of "analyze", "optimise" instead of "optimize", "colour" instead of "color", etc.).

## Breakout Panels
- **CRITICAL RULE**: A panel, either a single mode or multi mode breakout panel (e.g. PNL-M341, PNL-M343), sits in either an M100T or an M200T tray along with optical TAPs. It consumes one of the slots (there are 3 slots in an M100T, and 6 in an M200T) within that tray.

## TAA Compliant Optics Preference
- **CRITICAL RULE**: Whenever resolving or auto-assigning transceivers (e.g. SFP-501 vs SFP-501T, SFP-532 vs SFP-532T), always prefer the TAA-compliant ('T'-suffix) optic variant if available in the chassis/board compatibility rules.

## Communication Style
- **CRITICAL RULE**: When responding to the user, DO NOT output details of the internal tools used to search for text or read files (like `grep`, `cat`, or codebase searching). Focus the response strictly on the logic applied, the actual software changes made, and what the final outcome is.
