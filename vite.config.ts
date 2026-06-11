import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Replace 'fm-simulator' with your exact repository name if it differs
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './', // Use relative path for standalone opening
})