import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('jspdf') || id.includes('html2canvas')) {
            return 'vendor-pdf'
          }
          if (id.includes('gsap')) {
            return 'vendor-gsap'
          }
          if (id.includes('framer-motion')) {
            return 'vendor-motion'
          }
        },
      },
    },
  },
})