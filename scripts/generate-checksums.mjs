/**
 * generate-checksums.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Computes MD5 + SHA-256 checksums for the built single-file HTML app, so
 * anyone handed a copy of it can verify their file matches what was actually
 * built/published and hasn't been altered in transit.
 *
 * Runs automatically after `npm run build` (npm's `postbuild` hook) against
 * `dist/index.html`, writing `dist/index.html.checksums.txt` alongside it.
 *
 * When shipping, copy that checksums file alongside each renamed/versioned
 * deliverable copy (see CLAUDE.md's "Checksums" convention) - they're
 * byte-identical copies of dist/index.html, so the same hashes apply; this
 * script never needs to run again for those copies.
 *
 * Usage: node scripts/generate-checksums.mjs [path-to-file]
 * Defaults to dist/index.html when no path is given.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const target = process.argv[2] || 'dist/index.html';

if (!existsSync(target)) {
  console.warn(`[checksums] ${target} does not exist yet - skipping (this is expected if the build hasn't run).`);
  process.exit(0);
}

const data = readFileSync(target);
const md5 = createHash('md5').update(data).digest('hex');
const sha256 = createHash('sha256').update(data).digest('hex');
const name = basename(target);

const out = `File:   ${name}
Size:   ${data.length} bytes
MD5:    ${md5}
SHA256: ${sha256}
`;

writeFileSync(`${target}.checksums.txt`, out);
console.log(`[checksums] Wrote ${target}.checksums.txt`);
console.log(out);
