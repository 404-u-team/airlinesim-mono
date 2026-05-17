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
      name: 'map'
    }),
  ],
  server: {
    cors: true,
    port: 4001,
  },
})