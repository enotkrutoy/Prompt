import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Use '.' as root instead of process.cwd() to avoid TypeScript errors if Node types are missing
  const env = loadEnv(mode, '.', '');
  const apiKey = process.env.API_KEY || env.API_KEY;

  return {
    plugins: [react()],
    // Обеспечиваем совместимость process.env для библиотек, ожидающих Node.js окружение
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey || ''),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            genai: ['@google/genai'],
            markdown: ['react-markdown', 'remark-gfm'],
            d3: ['d3'],
            utils: ['uuid', 'clsx', 'tailwind-merge']
          }
        }
      }
    },
    server: {
      port: 3000,
      host: true
    }
  };
});