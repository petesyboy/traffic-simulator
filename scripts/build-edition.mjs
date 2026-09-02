import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const targetEdition = (process.argv[2] || process.env.VITE_APP_EDITION || 'internal').toLowerCase();

console.log(`\n======================================================`);
console.log(`🚀 Building Edition: [${targetEdition.toUpperCase()}]`);
console.log(`======================================================\n`);

// 1. Generate changelog
execSync('node scripts/generate-changelog.mjs', { cwd: ROOT_DIR, stdio: 'inherit' });

// 2. Ingest SKU data for target edition
execSync(`node scripts/parse-skus.js --edition=${targetEdition}`, { cwd: ROOT_DIR, stdio: 'inherit' });

// 3. Run Vite build with target edition environment variable
const env = { ...process.env, VITE_APP_EDITION: targetEdition };
execSync('npx tsc -b && npx vite build', { cwd: ROOT_DIR, stdio: 'inherit', env });

// 4. Output edition-specific folder and standalone neutral HTML file
const editionDirName = targetEdition === 'partner' ? 'partner-edition' : 'internal';
const targetFolder = path.join(DIST_DIR, editionDirName);

if (!fs.existsSync(targetFolder)) {
  fs.mkdirSync(targetFolder, { recursive: true });
}

const srcHtml = path.join(DIST_DIR, 'index.html');
const destStandaloneHtml = path.join(targetFolder, 'traffic-reduction-simulator.html');
const destIndexHtml = path.join(targetFolder, 'index.html');

if (fs.existsSync(srcHtml)) {
  fs.copyFileSync(srcHtml, destStandaloneHtml);
  fs.copyFileSync(srcHtml, destIndexHtml);
  console.log(`\n✅ Created standalone deliverables in dist/${editionDirName}/`);
  console.log(`   - dist/${editionDirName}/traffic-reduction-simulator.html`);
  console.log(`   - dist/${editionDirName}/index.html`);
  execSync(`node scripts/generate-checksums.mjs dist/${editionDirName}/traffic-reduction-simulator.html`, { cwd: ROOT_DIR, stdio: 'inherit' });
}

// 5. If building partner, restore internal skus.json and restore internal index.html at root
if (targetEdition === 'partner') {
  console.log(`\n🔄 Restoring internal SKU dataset for active workspace development...`);
  execSync('node scripts/parse-skus.js --edition=internal', { cwd: ROOT_DIR, stdio: 'inherit' });
  const internalHtml = path.join(DIST_DIR, 'internal', 'traffic-reduction-simulator.html');
  if (fs.existsSync(internalHtml)) {
    try {
      fs.copyFileSync(internalHtml, path.join(DIST_DIR, 'index.html'));
    } catch {
      try {
        fs.writeFileSync(path.join(DIST_DIR, 'index.html'), fs.readFileSync(internalHtml));
      } catch (err) {
        console.warn(`[warning] Could not update root dist/index.html: ${err.message}`);
      }
    }
  }
}

console.log(`\n✨ Build complete for [${targetEdition.toUpperCase()}] in dist/${editionDirName}/!\n`);
