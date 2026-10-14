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
          // jspdf/html2canvas are imported dynamically by CertificateView, so
          // the bundler keeps them in lazy chunks (forcing them into one named
          // chunk made the first page load them too).
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