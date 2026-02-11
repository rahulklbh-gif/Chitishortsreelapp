import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss()
  ],
  resolve: {
    alias: { 
      '@': path.resolve(__dirname, './src') 
    },
  },
  // Ye headers Local Development ke liye hain
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  // Ye headers Production Preview ke liye hain
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  optimizeDeps: {
    // FFmpeg ko bundle hone se rokta hai taaki browser crash na ho
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  worker: {
    format: 'es',
    plugins: () => [react()],
  },
  build: {
    // Isse badi files handle karne mein aasani hogi
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
  }
}) 
