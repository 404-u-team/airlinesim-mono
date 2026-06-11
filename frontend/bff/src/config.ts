import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type BffConfig = {
  backendAdminLogin?: string;
  backendAdminPassword?: string;
  backendAuthTimeoutMs?: number;
  backendBaseUrl: string;
  backendMaxSafeAttempts?: number;
  backendMutationTimeoutMs?: number;
  backendReadTimeoutMs?: number;
  idleTimeoutSeconds?: number;
  port: number;
};

export function getConfig(): BffConfig {
  loadFrontendEnv();

  return {
    backendAdminLogin: Bun.env.backend_admin_login ?? Bun.env.BACKEND_ADMIN_LOGIN,
    backendAdminPassword: Bun.env.backend_admin_password ?? Bun.env.BACKEND_ADMIN_PASSWORD,
    backendAuthTimeoutMs: Number(Bun.env.BFF_BACKEND_AUTH_TIMEOUT_MS ?? "1500"),
    backendBaseUrl: normalizeBaseUrl(
      Bun.env.BFF_BACKEND_BASE_URL ?? "https://api.master.stand.airlinesim.ms0ur.dev/",
    ),
    backendMaxSafeAttempts: Number(Bun.env.BFF_BACKEND_MAX_SAFE_ATTEMPTS ?? "2"),
    backendMutationTimeoutMs: Number(Bun.env.BFF_BACKEND_MUTATION_TIMEOUT_MS ?? "5000"),
    backendReadTimeoutMs: Number(Bun.env.BFF_BACKEND_READ_TIMEOUT_MS ?? "1500"),
    idleTimeoutSeconds: Number(Bun.env.BFF_IDLE_TIMEOUT_SECONDS ?? "120"),
    port: Number(Bun.env.BFF_PORT ?? "4200"),
  };
}

function loadFrontendEnv(): void {
  const frontendEnvPath = resolve(import.meta.dir, "../../.env");

  if (!existsSync(frontendEnvPath)) {
    return;
  }

  for (const line of readFileSync(frontendEnvPath, "utf8").split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed || Bun.env[parsed.key] !== undefined) {
      continue;
    }

    Bun.env[parsed.key] = parsed.value;
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function parseEnvLine(line: string): null | { key: string; value: string } {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const rawValue = trimmed.slice(separatorIndex + 1).trim();
  const value =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1)
      : rawValue;

  return { key, value };
}
