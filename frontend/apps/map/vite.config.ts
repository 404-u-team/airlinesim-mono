import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { federation } from '@module-federation/vite';

export default defineConfig({
  server: {
    port: 5001, // Жестко фиксируем порт для ремоута
  },
  plugins: [
    svelte(),
    federation({
      name: 'mapRemote',
      dts: false,
      filename: 'remoteEntry.js',
      exposes: {
        './WorldMap': './src/App.svelte',
      },
      shared: ['svelte']
    })
  ],
  build: {
    target: 'esnext'
  }
});