import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@react-oauth/google'],
  },
  server: {
    proxy: {
      // Proxy ML API calls in dev to avoid CORS — forwards server-side
      '/ml-api': {
        target: 'https://lighthouse-ml-api-intex.azurewebsites.net',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/ml-api/, ''),
      },
    },
  },
})
