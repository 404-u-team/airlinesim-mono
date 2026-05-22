import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig, loadEnv } from "@rsbuild/core";
import { pluginVue } from "@rsbuild/plugin-vue";

import { getAppDevPorts } from "../../dev-ports";

const appPorts = getAppDevPorts("../..");
const appOrigin = (port: number): string => `http://localhost:${String(port)}`;
const { publicVars } = loadEnv({ cwd: "../..", prefixes: ["VITE_"] });

export default defineConfig({
  html: {
    template: "./index.html",
  },
  output: {
    assetPrefix: appOrigin(appPorts.hrFacilities),
  },
  plugins: [
    pluginVue(),
    pluginModuleFederation({
      dts: false,
      exposes: {
        "./App": "./src/RemoteApp.vue",
      },
      name: "hrFacilities",
      shared: {
        "@airlinesim/air-ui": { singleton: true },
        "@airlinesim/api-contracts": { singleton: true },
        "@airlinesim/event-bus": { singleton: true },
        "@airlinesim/game-sdk": { singleton: true },
        "@airlinesim/i18n": { singleton: true },
        vue: {
          requiredVersion: "^3.5.32",
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
      "Access-Control-Allow-Headers": "*",
    },
    port: appPorts.hrFacilities,
    strictPort: true,
  },
  source: {
    define: publicVars,
    entry: {
      index: "./src/main.ts",
    },
  },
});
