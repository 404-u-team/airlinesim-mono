import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: (format) => `event-bus.${format}.js`,
      formats: ["es", "cjs"],
      name: "EventBus",
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
});
