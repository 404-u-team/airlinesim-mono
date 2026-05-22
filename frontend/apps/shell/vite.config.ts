import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import { getAppDevPorts } from '../../dev-ports'

const appPorts = getAppDevPorts('../..')
const appOrigin = (port: number): string => `http://localhost:${String(port)}`

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
        eventsNews: `${appOrigin(appPorts.eventsNews)}/mf-manifest.json`,
        financeStock: `${appOrigin(appPorts.financeStock)}/mf-manifest.json`,
        fleetOps: `${appOrigin(appPorts.fleetOps)}/mf-manifest.json`,
        hrFacilities: `${appOrigin(appPorts.hrFacilities)}/mf-manifest.json`,
        map: `${appOrigin(appPorts.map)}/mf-manifest.json`,
        networkPlanner: `${appOrigin(appPorts.networkPlanner)}/mf-manifest.json`
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
        '@airlinesim/i18n': {
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
    port: appPorts.shell,
    strictPort: true,
  },
})
