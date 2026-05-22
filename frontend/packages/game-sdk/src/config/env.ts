const defaultBackendUrl = "http://localhost:8080";

export function getBackendBaseUrl(): string {
  return getEnvValue("VITE_BACKEND_URL") ?? defaultBackendUrl;
}

export function getSocketBaseUrl(): string {
  return getEnvValue("VITE_SOCKET_URL") ?? getBackendBaseUrl();
}

function getEnvValue(key: "VITE_BACKEND_URL" | "VITE_SOCKET_URL"): string | undefined {
  return import.meta.env[key] ?? undefined;
}
