import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'
import { defineConfig } from '@rsbuild/core'
import { pluginSvelte } from '@rsbuild/plugin-svelte'

export default defineConfig({
  output: {
    assetPrefix: 'http://localhost:4001',
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
        svelte: {
          requiredVersion: '^5.46.1',
          singleton: true,
        },
      },
    }),
  ],
  server: {
    cors: {
      origin: 'http://localhost:4000',
    },
    headers: {
      'Access-Control-Allow-Headers': '*',
    },
    port: 4001,
  },
})
