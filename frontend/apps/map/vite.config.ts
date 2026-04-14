import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { federation } from '@module-federation/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    federation({
      name: 'map',
      manifest: true,
      exposes: {
        './Map': './src/moduleFederationComponents.svelte.ts'
      },
      shared: {
        'svelte': {
          singleton: true,
          requiredVersion: '^5.55.1'
        }
      }
    })
  ],
  server: {
    port: 4001,
    cors: true,
    origin: 'http://localhost:4001',
  },
})
