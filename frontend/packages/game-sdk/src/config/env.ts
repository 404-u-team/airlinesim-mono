const defaultBackendUrl = "http://localhost:4200";

export function getBackendBaseUrl(): string {
  return getEnvValue("VITE_BFF_URL") ?? getEnvValue("VITE_BACKEND_URL") ?? defaultBackendUrl;
}

export function getSocketBaseUrl(): string {
  return getEnvValue("VITE_SOCKET_URL") ?? getBackendBaseUrl();
}

function getEnvValue(key: "VITE_BACKEND_URL" | "VITE_BFF_URL" | "VITE_SOCKET_URL"): string | undefined {
  return import.meta.env[key] ?? undefined;
}
