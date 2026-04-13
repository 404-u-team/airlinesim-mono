import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { federation } from '@module-federation/vite';

export default defineConfig({
  server: {
    port: 5000,
  },
  plugins: [
    vue(),
    federation({
      name: 'shellHost',
      dts: false,
      remotes: {
        mapRemote: {
          type: 'module',
          name: 'mapRemote',
          entry: 'http://localhost:5001/remoteEntry.js',
        }
      },
      shared: ['vue']
    })
  ],
  build: {
    target: 'esnext'
  }
});