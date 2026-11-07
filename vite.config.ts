import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tauri penceresi bu portu açar (src-tauri/tauri.conf.json > build.devUrl)
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  build: {
    // Windows'taki WebView2 güncel Chromium; eski tarayıcı uyumluluğu gerekmez
    target: 'chrome120',
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
