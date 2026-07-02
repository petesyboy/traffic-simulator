# Antigravity IDE Agents Rules

## Versioning
- **CRITICAL RULE**: Anytime we make a change to the software, increment the release number in `package.json` (e.g., from `1.0.0` to `1.0.1`, `1.0.2`, etc.). The user specifically requested to increment the release number by `1.01`, `1.02`, `1.03` etc., which maps to standard SemVer patch increments like `1.0.1`, `1.0.2`, `1.0.3`.

## Commit Messages
- **CRITICAL RULE**: After each change, give the user a summary for a commit message.


## Hardware Node Rules
- **CRITICAL RULE**: Every tapped link produces two outputs. A simplex cable is required to go into an SFP or QSFP depending upon fiber type and speed on a TA or HC unit. Because traffic is northbound and southbound, there are two optics required for each tapped link.

## React Number Inputs
- **CRITICAL RULE**: Do not aggressively validate integer bounds inside `onChange` handlers for React `<input type="number">` fields. When a user deletes a number, the value temporarily becomes an empty string, which evaluates to `NaN` and triggers a fallback reset if validated immediately. Instead, track the input state as a raw string and defer `parseInt()` and bounds validation to form submission (e.g., button clicks) or use a `<select>` dropdown for small bounded ranges.

## British English Spelling
- **CRITICAL RULE**: For all tooltips on the nodes and anywhere else in this project, use British English spelling conventions (e.g., "analyse" instead of "analyze", "optimise" instead of "optimize", "colour" instead of "color", etc.).
