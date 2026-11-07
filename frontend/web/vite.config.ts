import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // AI Agent SSE streaming chat endpoint (Agent Service on port 8001)
      '/api/v1/agent/chat': {
        target: process.env.AGENT_SERVICE_URL || 'http://localhost:8001',
        changeOrigin: true,
      },
      // Core API backend endpoints (port 5176 locally on Mac, 5000 in docker)
      '/api': {
        target: process.env.CORE_API_URL || 'http://localhost:5176',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'sonner'],
        },
      },
    },
  },
})
