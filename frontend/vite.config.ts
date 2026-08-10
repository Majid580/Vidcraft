import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Honor a PORT assigned by the harness/preview runner; fall back to Vite's
    // default (5173) for a normal local `npm run dev`.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    proxy: {
      // Forward API calls to the Express backend (backend/src/app.js, :5000)
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
