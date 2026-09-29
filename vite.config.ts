import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
    include: process.env.DIAG ? ['scripts/**/*.test.ts'] : ['src/**/*.test.ts'],
  },
})
