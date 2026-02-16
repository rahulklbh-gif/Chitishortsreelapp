import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Mode ke hisaab se environment variables load karega
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    // --- YE LINE SABSE ZAROORI HAI ---
    // Isse Vite NEXT_PUBLIC_ se shuru hone wale variables ko browser mein allow karega
    envPrefix: 'NEXT_PUBLIC_', 
    
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // ✅ ADDED: FFmpeg ko browser permission dene ke liye headers
    server: {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
    },
    // ✅ ADDED: Build ke waqt FFmpeg ko properly handle karne ke liye
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },
    define: {
      // Isse legacy compatibility bani rahegi
      'process.env': env
    },
  }
}) 
