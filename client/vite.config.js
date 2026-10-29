import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const SPA_ROUTES = ['login', 'dashboard', 'records', 'disputes', 'ledger', 'verification', 'reports', 'settings', 'rights', 'verify'];

function generateSpaRoutes() {
  return {
    name: 'generate-spa-routes',
    writeBundle(options) {
      const outDir = options.dir || path.resolve('dist');
      const index = path.join(outDir, 'index.html');
      for (const route of SPA_ROUTES) {
        const routeDir = path.join(outDir, route);
        fs.mkdirSync(routeDir, { recursive: true });
        fs.copyFileSync(index, path.join(routeDir, 'index.html'));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), generateSpaRoutes()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
