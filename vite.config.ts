
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ESM environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // QUAN TRỌNG: Dùng './' để hỗ trợ mọi đường dẫn con (GitHub Pages, Subfolder, Electron)
  base: './', 
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      buffer: 'buffer',
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
