import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      // Health check goes to LlamaFarm /health
      '/api/health': {
        target: process.env.API_URL || 'http://localhost:14345',
        changeOrigin: true,
        secure: false,
        rewrite: () => '/health',
      },
      // Document management (CRUD) goes to local server on 3001
      '/api/projects/default/regsync/documents': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/v1'),
      },
      // Digest API goes to local server
      '/api/projects/default/regsync/digest': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/v1'),
      },
      // Policy PDF files served from local server
      '/api/projects/default/regsync/policies': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/v1'),
      },
      // Everything else (chat, RAG, datasets) goes to LlamaFarm
      '/api': {
        target: process.env.API_URL || 'http://localhost:14345',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/v1'),
      },
    },
  },
})
