import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    vue(),
    federation({
      dts: false,
      manifest: false,
      name: 'shell',
      remotes: {
        map: 'http://localhost:4001/mf-manifest.json'
      },
      shared: {
        'vue': {
          requiredVersion: '^3.5.32',
          singleton: true
        }
      }
    })
  ],
  server: {
    cors: true,
    port: 4000,
  },
})
