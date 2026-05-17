import { resolve } from 'path';
// vite.config.ts
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        emptyOutDir: true,
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            fileName: (format) => `game-sdk.${format}.js`,
            formats: ['es', 'cjs'],
            name: 'GameSDK',
        },
    },
    plugins: [
        dts({
            insertTypesEntry: true,
        }),
    ],
});