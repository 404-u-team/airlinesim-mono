import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  envDir: '../..',
  plugins: [
    tailwindcss(),
    vue(),
    federation({
      dts: false,
      manifest: false,
      name: 'shell',
      remotes: {
        eventsNews: 'http://localhost:4005/mf-manifest.json',
        financeStock: 'http://localhost:4003/mf-manifest.json',
        fleetOps: 'http://localhost:4002/mf-manifest.json',
        hrFacilities: 'http://localhost:4006/mf-manifest.json',
        map: 'http://localhost:4001/mf-manifest.json',
        networkPlanner: 'http://localhost:4004/mf-manifest.json'
      },
      shared: {
        '@airlinesim/air-ui': {
          singleton: true
        },
        '@airlinesim/api-contracts': {
          singleton: true
        },
        '@airlinesim/event-bus': {
          singleton: true
        },
        '@airlinesim/game-sdk': {
          singleton: true
        },
        'vue': {
          requiredVersion: '^3.5.32',
          singleton: true
        }
      }
    })
  ],
  server: {
    cors: true,
    port: 4000,
  },
})
