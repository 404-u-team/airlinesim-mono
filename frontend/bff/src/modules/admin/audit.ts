import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { getUserAuthorization } from "../../auth";

export type AdminAuditEntry = {
  action: string;
  capability: "world.manage";
  entity_id?: string;
  entity_type: string;
  id: string;
  import_job_id?: string;
  occurred_at: string;
  success: boolean;
  user_id: string;
};

const auditPath = resolve(import.meta.dir, "../../../data/game-state/admin-audit.json");

export function adminActorId(request: Request): string {
  const token = getUserAuthorization(request)?.slice("Bearer ".length);
  const payload = token?.split(".")[1];

  if (!payload) {
    return "authenticated-user";
  }

  try {
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))) as Record<string, unknown>;
    const id = decoded.sub ?? decoded.user_id ?? decoded.id;

    return typeof id === "string" && id ? id : "authenticated-user";
  } catch {
    return "authenticated-user";
  }
}

export async function listAdminAudit(): Promise<AdminAuditEntry[]> {
  try {
    const payload = JSON.parse(await readFile(auditPath, "utf8")) as unknown;

    return Array.isArray(payload) ? payload as AdminAuditEntry[] : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function recordAdminAudit(entry: Omit<AdminAuditEntry, "id" | "occurred_at">): Promise<void> {
  const entries = await listAdminAudit();
  const next: AdminAuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    occurred_at: new Date().toISOString(),
  };
  await mkdir(dirname(auditPath), { recursive: true });
  const temporaryPath = `${auditPath}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify([next, ...entries].slice(0, 1000), null, 2));
  await rename(temporaryPath, auditPath);
}
