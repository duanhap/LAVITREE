import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // AI Agent SSE streaming endpoint (Agent Service on port 8001)
      '/api/v1/agent': {
        target: 'http://localhost:8001',
        changeOrigin: true
      },
      // Core API backend endpoints (port 5000)
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
