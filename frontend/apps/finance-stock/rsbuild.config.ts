import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig } from "@rsbuild/core";
import { pluginVue } from "@rsbuild/plugin-vue";

export default defineConfig({
  html: {
    template: "./index.html",
  },
  output: {
    assetPrefix: "http://localhost:4003",
  },
  plugins: [
    pluginVue(),
    pluginModuleFederation({
      dts: false,
      exposes: {
        "./App": "./src/RemoteApp.vue",
      },
      name: "financeStock",
      shared: {
        "@airlinesim/air-ui": { singleton: true },
        "@airlinesim/api-contracts": { singleton: true },
        "@airlinesim/event-bus": { singleton: true },
        "@airlinesim/game-sdk": { singleton: true },
        vue: {
          requiredVersion: "^3.5.32",
          singleton: true,
        },
      },
    }),
  ],
  server: {
    cors: {
      origin: "http://localhost:4000",
    },
    headers: {
      "Access-Control-Allow-Headers": "*",
    },
    port: 4003,
  },
  source: {
    entry: {
      index: "./src/main.ts",
    },
  },
});
