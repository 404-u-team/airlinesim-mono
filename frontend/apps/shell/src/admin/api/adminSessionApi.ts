import { apiClient } from "../../api";

export type AdminSession = {
  authenticated: boolean;
  authorized: boolean;
  capabilities: string[];
};

export async function getAdminSession(): Promise<AdminSession> {
  return apiClient.get<AdminSession>("/admin/session");
}
