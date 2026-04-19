import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import fs from "fs";

/** Vite plugin that generates sw.js with a build-time cache version */
function serviceWorkerPlugin() {
  return {
    name: 'sw-cache-bust',
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir || 'dist';
      const version = Date.now();
      const sw = `const CACHE_NAME = 'dynasty-v${version}';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
`;
      fs.writeFileSync(path.resolve(outDir, 'sw.js'), sw);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    serviceWorkerPlugin(),
    process.env.ANALYZE === 'true' && visualizer({
      filename: 'stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      // AdMob plugin excluded from build until production ad IDs are configured.
      // Dynamic imports in ads.ts are guarded and never reached.
      external: [
        '@capacitor-community/admob',
      ],
      output: {
        manualChunks(id) {
          if (id.includes('framer-motion')) return 'framer-motion';
          if (id.includes('recharts')) return 'recharts';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('src/data/squads/') || id.includes('src/data/playerTemplates')) return 'squad-data';
          if (id.includes('src/data/nationalPlayerPool')) return 'national-pool';
        },
      },
    },
  },
}));
