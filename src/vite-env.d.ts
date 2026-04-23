/// <reference types="vite/client" />

// Injected by Vite's `define` in vite.config.ts. In test (vitest) it's not
// injected — src/utils/sentry.ts guards with `typeof` and falls back to 'dev'.
declare const __APP_VERSION__: string;
