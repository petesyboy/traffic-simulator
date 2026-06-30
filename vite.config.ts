import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import fs from 'fs'
import path from 'path'

// Replace 'traffic-simulator' with your exact repository name if it differs
export default defineConfig({
  plugins: [
    react(), 
    viteSingleFile(),
    {
      name: 'rename-output',
      closeBundle() {
        const oldPath = path.resolve(__dirname, 'dist/index.html');
        const newPath = path.resolve(__dirname, 'dist/dop_illustration.html');
        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
          console.log(`Renamed dist/index.html to dist/dop_illustration.html`);
        }
      }
    }
  ],
  base: './', // Use relative path for standalone opening
})