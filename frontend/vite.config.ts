import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
