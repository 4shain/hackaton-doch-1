import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API is proxied so the browser talks to a single origin.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_PROXY ?? 'http://localhost:8000',
    },
  },
})
