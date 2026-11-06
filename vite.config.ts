import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: 'client',
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${env.PORT || '3000'}` },
    },
    build: { outDir: '../dist/client', emptyOutDir: true },
  };
});
