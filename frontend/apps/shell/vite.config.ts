import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 4000,
    cors: true,
  },
  plugins: [
    tailwindcss(),
    vue(),
    federation({
      name: 'shell',
      manifest: false,
      remotes: {
        map: 'http://localhost:4001/mf-manifest.json'
      },
      shared: {
        'vue': {
          singleton: true,
          requiredVersion: '^3.5.32'
        }
      },
      dts: false
    })
  ],
})
