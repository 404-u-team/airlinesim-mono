import { defineConfig } from '@rsbuild/core'
import { pluginSvelte } from '@rsbuild/plugin-svelte'
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'

export default defineConfig({
  plugins: [
    pluginSvelte(),
    pluginModuleFederation({
      name: 'map',
      exposes: {
        './Map': './src/moduleFederationComponents.svelte.ts',
      },
      dts: false
    }),
  ],
  server: {
    port: 4001,
    cors: true,
  },
  output: {
    assetPrefix: 'http://localhost:4001',
  },
})