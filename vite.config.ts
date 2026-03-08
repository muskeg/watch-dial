import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function resolveBasePath() {
  const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];

  if (!repository || repository.toLowerCase().endsWith('.github.io')) {
    return '/';
  }

  return `/${repository}/`;
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? resolveBasePath() : '/',
  server: {
    watch: {
      usePolling: true,
    },
  },
}));
