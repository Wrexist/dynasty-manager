import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'framer-motion': ['framer-motion'],
          'recharts': ['recharts'],
          'radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-slot',
          ],
        },
      },
    },
  },
}));
