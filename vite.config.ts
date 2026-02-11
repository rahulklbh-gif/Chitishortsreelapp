import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Ye line Vite ko batati hai ki NEXT_PUBLIC_ wale variables load karne hain
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      // Isse aapka code environment variables ko process.env ya import.meta.env se utha payega
      'process.env': env
    },
  }
}) 
