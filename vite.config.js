import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  root: '.',
  base: mode === 'production' ? '/dichroic-glass/' : '/',
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'es2020',
    minify: false
  }
}));
