import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: (format) => `i18n.${format}.js`,
      formats: ["es", "cjs"],
      name: "I18n",
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
});
