import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite configuration for GitHub Pages Landing Page & Live Demo
export default defineConfig({
  root: path.resolve(__dirname, 'website'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-pages'),
    emptyOutDir: true,
  },
});
