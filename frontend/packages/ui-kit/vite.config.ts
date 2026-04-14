import { resolve } from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'UiKit',
            fileName: 'index',
            formats: ['es'],
        },
        rollupOptions: {
            external: ['vue'],
        },
        emptyOutDir: true,
    },
    plugins: [
        vue({
            customElement: true,
        }),
        dts({ rollupTypes: true })
    ],
});