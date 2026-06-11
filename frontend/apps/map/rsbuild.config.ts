import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'
import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginSvelte } from '@rsbuild/plugin-svelte'

import { getAppDevPorts } from '../../dev-ports'

const appPorts = getAppDevPorts('../..')
const appOrigin = (port: number): string => `http://localhost:${String(port)}`
const mfeBaseUrl = process.env.VITE_MFE_BASE_URL?.replace(/\/+$/, '')
const appAssetPrefix = (appName: string, port: number): string =>
  mfeBaseUrl ? `${mfeBaseUrl}/mfe/${appName}/` : appOrigin(port)
const { publicVars } = loadEnv({ cwd: '../..', prefixes: ['VITE_'] })

export default defineConfig({
  output: {
    assetPrefix: appAssetPrefix('map', appPorts.map),
  },
  plugins: [
    pluginSvelte(),
    pluginModuleFederation({
      dts: false,
      exposes: {
        './Map': './src/moduleFederationComponents.svelte.ts',
      },
      name: 'map',
      shared: {
        '@airlinesim/air-ui': { singleton: true },
        '@airlinesim/api-contracts': { singleton: true },
        '@airlinesim/event-bus': { singleton: true },
        '@airlinesim/game-sdk': { singleton: true },
        '@airlinesim/i18n': { singleton: true },
        svelte: {
          requiredVersion: '^5.46.1',
          singleton: true,
        },
      },
    }),
  ],
  server: {
    cors: {
      origin: appOrigin(appPorts.shell),
    },
    headers: {
      'Access-Control-Allow-Headers': '*',
    },
    port: appPorts.map,
    strictPort: true,
  },
  source: {
    define: publicVars,
  },
})
