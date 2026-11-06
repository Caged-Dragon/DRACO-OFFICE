import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    chunkSizeWarningLimit: 8000,
    rollupOptions: { output: { chunkFileNames: (c) => (c.name === 'engine' || c.facadeModuleId?.endsWith('engine.ts') ? 'assets/engine-[hash].js' : 'assets/[name]-[hash].js') } },
  },
  worker: { format: 'es' },
});
