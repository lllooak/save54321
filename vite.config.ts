import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  base: '/', // Ensure base URL is set correctly
  server: {
    historyApiFallback: true, // Enable history API fallback for client-side routing
  },
  preview: {
    historyApiFallback: true, // Enable for preview server as well
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor code into separate chunks
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Split UI libraries into separate chunks
          ui: ['@headlessui/react', 'lucide-react', 'react-hot-toast'],
        },
      },
    },
  },
});
