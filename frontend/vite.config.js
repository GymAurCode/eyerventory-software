import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: "./",   // relative paths so file:// protocol works in Electron
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  }
});
