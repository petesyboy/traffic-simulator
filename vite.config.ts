/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'))

function getGitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

// Stamps the built HTML with <meta> tags for the app version, build timestamp,
// and git commit — visible directly in GitHub's file view (or any text editor)
// on dist/index.html / traffic-reduction-simulator.html without running the app.
// Also appends the version to <title> so it shows in the browser tab and window
// title without opening the file at all.
function buildInfoPlugin(): Plugin {
  return {
    name: 'inject-build-info',
    transformIndexHtml(html: string) {
      const meta = [
        `<meta name="build-version" content="${pkg.version}" />`,
        `<meta name="build-date" content="${new Date().toISOString()}" />`,
        `<meta name="build-commit" content="${getGitCommit()}" />`,
      ].join('\n    ')
      return html
        .replace('</head>', `    ${meta}\n  </head>`)
        .replace(/<title>(.*?)<\/title>/, `<title>$1 (v${pkg.version})</title>`)
    },
  }
}

// Replace 'traffic-simulator' with your exact repository name if it differs
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    buildInfoPlugin(),
  ],
  base: './', // Use relative path for standalone opening
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})