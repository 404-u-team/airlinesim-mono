import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: (format) => `api-contracts.${format}.js`,
      formats: ["es", "cjs"],
      name: "ApiContracts",
    },
    rollupOptions: {
      external: ["zod"],
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
});
