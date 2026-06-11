import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig, loadEnv } from "@rsbuild/core";
import { pluginVue } from "@rsbuild/plugin-vue";

import { getAppDevPorts } from "../../dev-ports";

const appPorts = getAppDevPorts("../..");
const appOrigin = (port: number): string => `http://localhost:${String(port)}`;
const mfeBaseUrl = process.env.VITE_MFE_BASE_URL?.replace(/\/+$/, "");
const appAssetPrefix = (appName: string, port: number): string =>
  mfeBaseUrl ? `${mfeBaseUrl}/mfe/${appName}/` : appOrigin(port);
const remoteManifestUrl = (appName: string, port: number): string =>
  `${appName}@${mfeBaseUrl ? `${mfeBaseUrl}/mfe/${appName}/mf-manifest.json` : `${appOrigin(port)}/mf-manifest.json`}`;
const { publicVars } = loadEnv({ cwd: "../..", prefixes: ["VITE_"] });

export default defineConfig({
  html: {
    template: "./index.html",
  },
  output: {
    assetPrefix: appAssetPrefix("fleet-ops", appPorts.fleetOps),
  },
  plugins: [
    pluginVue(),
    pluginModuleFederation({
      dts: false,
      exposes: {
        "./App": "./src/FleetOpsRemoteApp.vue",
      },
      name: "fleetOps",
      remotes: {
        map: remoteManifestUrl("map", appPorts.map),
      },
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
    port: appPorts.fleetOps,
    strictPort: true,
  },
  source: {
    define: publicVars,
    entry: {
      index: "./src/main.ts",
    },
  },
});
