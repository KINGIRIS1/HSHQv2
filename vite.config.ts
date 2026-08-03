
import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ESM environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const customLogger = createLogger();
const originalInfo = customLogger.info;
customLogger.info = (msg, options) => {
  // Lọc bỏ log 304 Not Modified của các file component/static
  if (msg.includes('304') || msg.includes('.tsx') || msg.includes('.ts')) return;
  originalInfo(msg, options);
};

// https://vitejs.dev/config/
export default defineConfig({
  customLogger,
  plugins: [react()],
  // Base path for web application deployment
  base: '/', 
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      buffer: 'buffer',
    },
  },
  define: {
    'global': 'globalThis',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'charts';
            }
            if (id.includes('docx') || id.includes('docxtemplater') || id.includes('pizzip') || id.includes('jszip')) {
              return 'docx-utils';
            }
            if (id.includes('xlsx-js-style') || id.includes('file-saver')) {
              return 'excel-utils';
            }
          }
        }
      }
    }
  },
  server: {
    port: 5173,
  }
});
