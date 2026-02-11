import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Purani browsers ke bajaye modern browser target karte hain (clean build ke liye)
    target: 'esnext',
    // Badi files hone par warning limit thodi badha dete hain
    chunkSizeWarningLimit: 1000,
  },
})
