export type BffConfig = {
  backendAdminLogin?: string;
  backendAdminPassword?: string;
  backendBaseUrl: string;
  port: number;
};

export function getConfig(): BffConfig {
  return {
    backendAdminLogin: Bun.env.backend_admin_login ?? Bun.env.BACKEND_ADMIN_LOGIN,
    backendAdminPassword: Bun.env.backend_admin_password ?? Bun.env.BACKEND_ADMIN_PASSWORD,
    backendBaseUrl: normalizeBaseUrl(Bun.env.BFF_BACKEND_BASE_URL ?? "http://localhost:8080"),
    port: Number(Bun.env.BFF_PORT ?? "4200"),
  };
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}
