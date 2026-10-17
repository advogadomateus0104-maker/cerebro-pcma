import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// BASE: caminho do site no GitHub Pages (https://<usuario>.github.io/cerebro-pcma/).
export default defineConfig({
  base: process.env.SITE_BASE ?? '/cerebro-pcma/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
  // Somente para testes locais (PostgREST na porta 3001).
  preview: { proxy: { '/rest/v1': { target: 'http://localhost:3001', rewrite: (path) => path.replace(/^\/rest\/v1/, '') } } },
});
