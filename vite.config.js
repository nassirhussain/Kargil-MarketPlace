import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = process.env.VITE_API_BASE || env.VITE_API_BASE
  if (command === 'build' && !apiBase) {
    throw new Error('VITE_API_BASE is required for production builds. Set it to the deployed API URL ending in /api.')
  }
  return {
    plugins: [react()],
    server: { proxy: { '/api': 'http://localhost:3001' } },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/lodash/')) return 'lodash'
            if (id.includes('node_modules/recharts/')) return 'charts'
          }
        }
      }
    }
  }
})
