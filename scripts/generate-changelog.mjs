/**
 * generate-changelog.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Regenerates `src/constants/changelog.ts` from git history. Runs automatically
 * before `npm run build` (npm's `prebuild` hook).
 *
 * How a commit becomes a changelog entry
 * ─────────────────────────────────────
 * The project bumps the patch version in package.json with every change, so each
 * commit's own package.json tells us which version that commit produced. The
 * commit subject line becomes the entry summary, so **write commit subjects that
 * read well to a user** - they are the release notes.
 *
 *   Good: "Fix QSB-* BiDi optics landing in SFP cages instead of QSFP"
 *   Poor: "wip", "fix stuff", "address review comments"
 *
 * Excluding a commit
 * ──────────────────
 *   - prefix it `chore:` / `test:` / `ci:` / `docs:` / `build:` / `style:` / `refactor:`
 *   - or put `[skip changelog]` anywhere in the subject
 *
 * Overriding a commit's wording (or describing work that isn't committed yet)
 * ──────────────────────────────────────────────────────────────────────────
 * Add an entry to `scripts/changelog.manual.json`. Entries there win over the
 * generated text for the same version, so you can write better prose than a
 * commit subject allows.
 *
 * If git isn't available (e.g. a source tarball), the existing changelog.ts is
 * left untouched rather than failing the build.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'src', 'constants', 'changelog.ts');
const MANUAL_FILE = join(ROOT, 'scripts', 'changelog.manual.json');

/** How many commits back to scan, and how many entries to keep in the output. */
const SCAN_COMMITS = 60;
const KEEP_ENTRIES = 20;

/** Conventional-commit types that aren't user-facing release notes. */
const SKIP_TYPES = /^(chore|test|ci|docs|build|style|refactor)(\([^)]*\))?!?:/i;

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

/** Strips a conventional-commit type prefix and capitalises the first letter. */
function tidySubject(subject) {
  const stripped = subject.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, '');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function versionAtCommit(sha) {
  try {
    return JSON.parse(git(['show', `${sha}:package.json`])).version ?? null;
  } catch {
    return null; // package.json absent or unparseable at that commit
  }
}

function collectFromGit() {
  const log = git(['log', `-${SCAN_COMMITS}`, '--format=%H%x1f%ad%x1f%s', '--date=short']);
  if (!log) return [];

  const entries = [];
  const seenVersions = new Set();

  for (const line of log.split('\n')) {
    const [sha, date, subject] = line.split('\x1f');
    if (!sha || !subject) continue;
    if (SKIP_TYPES.test(subject) || /\[skip changelog\]/i.test(subject)) continue;

    const version = versionAtCommit(sha);
    // Only the newest commit for a given version wins - earlier commits sharing a
    // version predate the bump and are already represented by their own entry.
    if (!version || seenVersions.has(version)) continue;
    seenVersions.add(version);

    entries.push({ version, date, summary: tidySubject(subject) });
  }

  return entries;
}

function readManualEntries() {
  if (!existsSync(MANUAL_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(MANUAL_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`[changelog] ${MANUAL_FILE} is not valid JSON - ignoring it. ${err.message}`);
    return [];
  }
}

/** Descending semver-ish sort so 1.0.470 outranks 1.0.9. */
function compareVersionsDesc(a, b) {
  const pa = a.version.split('.').map(Number);
  const pb = b.version.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function render(entries) {
  const body = entries
    .map(
      (e) => `  {
    version: ${JSON.stringify(e.version)},
    date: ${JSON.stringify(e.date)},
    summary: ${JSON.stringify(e.summary)},
  },`,
    )
    .join('\n');

  return `/**
 * changelog.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GENERATED FILE - do not edit by hand. Regenerated from git history by
 * \`scripts/generate-changelog.mjs\`, which runs automatically before every build.
 *
 * To change an entry's wording, or to describe work that isn't committed yet,
 * edit \`scripts/changelog.manual.json\` instead.
 */

export interface ChangelogEntry {
  version: string;
  date: string;
  summary: string;
}

export const CHANGELOG: ChangelogEntry[] = [
${body}
];
`;
}

function main() {
  let gitEntries;
  try {
    gitEntries = collectFromGit();
  } catch (err) {
    console.warn(`[changelog] Skipping regeneration - git unavailable. ${err.message}`);
    return;
  }

  // Manual entries override generated ones for the same version.
  const byVersion = new Map(gitEntries.map((e) => [e.version, e]));
  for (const entry of readManualEntries()) {
    if (entry?.version && entry?.date && entry?.summary) byVersion.set(entry.version, entry);
  }

  const entries = [...byVersion.values()].sort(compareVersionsDesc).slice(0, KEEP_ENTRIES);
  if (entries.length === 0) {
    console.warn('[changelog] No entries found - leaving the existing changelog.ts in place.');
    return;
  }

  const next = render(entries);
  const current = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : '';
  if (current === next) {
    console.log(`[changelog] Up to date (${entries.length} entries).`);
    return;
  }

  writeFileSync(OUT_FILE, next);
  console.log(`[changelog] Wrote ${entries.length} entries, newest v${entries[0].version}.`);
}

main();
