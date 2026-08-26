
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
      stream: 'stream-browserify',
    },
  },
  define: {
    'global': 'window',
    'process.env': {}
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020', // Đảm bảo tương thích tốt hơn
    rollupOptions: {
        output: {
            // Tách nhỏ file vendor để tránh lỗi load file quá lớn
            manualChunks: {
                vendor: ['react', 'react-dom'],
                utils: ['xlsx-js-style', 'docxtemplater', 'pizzip', 'file-saver'],
                icons: ['lucide-react']
            }
        }
    }
  },
  server: {
    port: 5173,
  }
});
