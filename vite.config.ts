import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import audioManifest from './vite-plugins/audioManifest'

export default defineConfig({
  plugins: [react(), audioManifest()],
  test: { include: ['src/**/*.test.ts'] },
})
