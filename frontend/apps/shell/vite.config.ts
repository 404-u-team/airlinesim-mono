import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv, type UserConfig } from 'vite'

import { getAppDevPorts } from '../../dev-ports'

const appPorts = getAppDevPorts('../..')
const appOrigin = (port: number): string => `http://localhost:${String(port)}`

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', '')
  const mfeBaseUrl = normalizeMfeBaseUrl(process.env.VITE_MFE_BASE_URL ?? env.VITE_MFE_BASE_URL)
  const bffPort = resolveBffPort(env)
  const bffTarget = `http://localhost:${bffPort}`
  const remoteManifestUrl = (appName: string, port: number): string =>
    mfeBaseUrl ? `${mfeBaseUrl}/mfe/${appName}/mf-manifest.json` : `${appOrigin(port)}/mf-manifest.json`

  return {
    envDir: '../..',
    plugins: [
      tailwindcss(),
      vue(),
      federation({
        dts: false,
        manifest: false,
        name: 'shell',
        remotes: {
          eventsNews: remoteManifestUrl('events-news', appPorts.eventsNews),
          financeStock: remoteManifestUrl('finance-stock', appPorts.financeStock),
          fleetOps: remoteManifestUrl('fleet-ops', appPorts.fleetOps),
          hrFacilities: remoteManifestUrl('hr-facilities', appPorts.hrFacilities),
          map: remoteManifestUrl('map', appPorts.map),
          networkPlanner: remoteManifestUrl('network-planner', appPorts.networkPlanner),
        },
        shared: {
          '@airlinesim/air-ui': {
            singleton: true,
          },
          '@airlinesim/api-contracts': {
            singleton: true,
          },
          '@airlinesim/event-bus': {
            singleton: true,
          },
          '@airlinesim/game-sdk': {
            singleton: true,
          },
          '@airlinesim/i18n': {
            singleton: true,
          },
          vue: {
            requiredVersion: '^3.5.32',
            singleton: true,
          },
        },
      }),
    ],
    server: createDevServerConfig(appPorts.shell, bffTarget),
  }
})

function createDevServerConfig(shellPort: number, bffTarget: string): NonNullable<UserConfig['server']> {
  return {
    cors: true,
    port: shellPort,
    proxy: {
      '/bff': {
        changeOrigin: true,
        rewrite: rewriteBffPath,
        target: bffTarget,
      },
    },
    strictPort: true,
  }
}

function normalizeMfeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim()

  if (!trimmed) {
    return undefined
  }

  return trimmed.replace(/\/+$/, '')
}

function readOptionalEnvValue(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key]?.trim()

  if (!value) {
    return undefined
  }

  return value
}

function resolveBffPort(env: Record<string, string>): string {
  return (
    readOptionalEnvValue(process.env, 'BFF_PORT') ??
    readOptionalEnvValue(env, 'BFF_PORT') ??
    '4200'
  )
}

function rewriteBffPath(path: string): string {
  const rewritten = path.replace(/^\/bff/, '')

  return rewritten || '/'
}
