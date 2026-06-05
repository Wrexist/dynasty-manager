import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import fs from "fs";

// Expose the package.json version to app code at build time so Sentry can tag
// releases. Read synchronously at config-load — cheap, runs once per build.
const pkgVersion = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
).version;

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
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion),
  },
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
      open: process.env.ANALYZE_OPEN === 'true',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2020',
    // Hidden: emit .map files for Sentry upload but don't reference them
    // from the JS. Keeps dist/ lean without losing symbolicated stack traces.
    sourcemap: 'hidden',
    // Several chunks (recharts-using pages, nationalPlayerPool, league squad
    // data) are intentionally larger than the default 500 KB threshold —
    // they're lazy-loaded and stay out of the eager modulepreload set. The
    // warning is noise in CI; raise the threshold.
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      // AdMob plugin excluded from build until production ad IDs are configured.
      // Dynamic imports in ads.ts are guarded and never reached.
      external: [
        '@capacitor-community/admob',
      ],
      output: {
        manualChunks(id) {
          if (id.includes('framer-motion')) return 'framer-motion';
          if (id.includes('@radix-ui')) return 'radix';
          // Note: recharts (~414 KB raw / 111 KB gz) is intentionally NOT
          // manually chunked. Letting Rollup co-locate it with the 5 lazy
          // pages that use it (PlayerDetail via PlayerRadarChart,
          // FinancePage, ManagerProfile, TrainingPage, ComparisonPage)
          // keeps it out of the eager modulepreload list so mid-range
          // phones don't download ~111 KB of chart code they may never use.
          if (id.includes('node_modules/@sentry')) return 'sentry';
          if (id.includes('node_modules/lucide-react')) return 'lucide';
          if (id.includes('node_modules/zustand')) return 'zustand';
          if (id.includes('node_modules/react-router')) return 'router';
          if (id.includes('node_modules/@capacitor')) return 'capacitor';
          // The 7 community-pack-only league squads live in src/data/squads/
          // but must not ship in the eager `squad-data` chunk — they are
          // dynamic-imported via src/data/communityPack/cpLeagueSquads.ts.
          if (id.includes('src/data/squads/')) {
            if (/\/(arg|aus|bra|ind|kor|mls|sau)\.ts$/.test(id)) return 'cpLeagueSquads';
            return 'squad-data';
          }
          if (id.includes('src/data/communityPack/cpLeagueSquads')) return 'cpLeagueSquads';
          // Route the squad-data module into its own chunk — but NOT the lazy
          // ACCESSOR (`playerTemplatesAccess.ts`). The accessor is statically
          // imported by eager code (initGame/playerGen) and only dynamic-imports
          // the data; bundling it into `squad-data` merged the eager accessor
          // with the 2.1MB data and dragged the whole chunk into the boot
          // modulepreload graph (~386KB gz at startup), defeating the lazy load.
          if (id.includes('src/data/playerTemplates') && !id.includes('playerTemplatesAccess')) return 'squad-data';
          // NOTE: src/data/nationalPlayerPool intentionally has no manualChunks
          // rule. It's loaded exclusively via dynamic import() from
          // nationalPlayerPoolAccess.ts; letting Rollup auto-split it keeps the
          // ~2.5MB chunk out of the eager modulepreload list (same trick as
          // the recharts comment above). Manually naming it 'national-pool'
          // would put it back in <link rel=modulepreload> and undo the lazy
          // load.
        },
      },
    },
  },
}));
