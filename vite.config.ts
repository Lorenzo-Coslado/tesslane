import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
    rolldownOptions: { input: { dashboard: 'index.html', avatars: 'avatar-proposals.html' } },
  },
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:4317' } },
});
